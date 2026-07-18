import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, CheckCircle2, Clock, Loader2, X } from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';
import { isFieldEmployeePunchedIn, uploadFieldPhoto } from '../api/attendance';
import { Camera as CapCamera } from '@capacitor/camera';
import { Geolocation as CapGeolocation } from '@capacitor/geolocation';

export const FieldPunch: React.FC = () => {
  const { currentUser } = useVariPoints();
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    checkPunchStatus();
    startCamera();
    return () => stopCamera();
  }, [currentUser]);

  const checkPunchStatus = async () => {
    if (!currentUser) return;
    try {
      const status = await isFieldEmployeePunchedIn(currentUser.id);
      setIsPunchedIn(status);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      // Request native camera permission using Capacitor explicitly
      try {
        const perm = await CapCamera.checkPermissions();
        if (perm.camera !== 'granted') {
          await CapCamera.requestPermissions({ permissions: ['camera'] });
        }
      } catch (e) {
        // Ignored, might be running in browser without capacitor plugins properly initialized
        console.warn('Capacitor Camera permission check skipped:', e);
      }

      // Prefer front camera for selfies if available on mobile
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setCameraError('Camera access denied or unavailable. Please grant permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setStream(null);
  };

  const getLocation = async (): Promise<GeolocationPosition> => {
    try {
      const perm = await CapGeolocation.checkPermissions();
      if (perm.location !== 'granted') {
        await CapGeolocation.requestPermissions();
      }
    } catch (e) {
      console.warn('Capacitor Geolocation permission check skipped:', e);
    }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handlePunch = async () => {
    if (!currentUser) return;
    
    // Capture Photo
    if (!videoRef.current || !canvasRef.current) {
      showToast('Camera not ready', 'error');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    setIsProcessing(true);

    try {
      // 1. Convert Canvas to File — resize to max 800px wide to stay under PHP upload limits
      const MAX_W = 800;
      let drawW = video.videoWidth;
      let drawH = video.videoHeight;
      if (drawW > MAX_W) {
        drawH = Math.round((MAX_W / drawW) * drawH);
        drawW = MAX_W;
      }
      canvas.width = drawW;
      canvas.height = drawH;
      ctx.drawImage(video, 0, 0, drawW, drawH);

      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.7));
      if (!blob) throw new Error('Failed to capture photo');
      const file = new File([blob], `punch_${Date.now()}.jpg`, { type: 'image/jpeg' });

      // 2. Get Location
      const pos = await getLocation();
      const locationData = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      };

      // 3. Upload and Register Punch
      const date = new Date().toISOString().split('T')[0];
      const punchType = isPunchedIn ? 'out' : 'in';
      const confidenceScore = 95; // Assuming a successful face match for mock purposes
      
      const res = await uploadFieldPhoto(currentUser.id, date, punchType, file, confidenceScore, locationData);
      
      if (res.success) {
        setIsPunchedIn(!isPunchedIn);
        showToast(`Successfully punched ${punchType}!`, 'success');
      } else {
        throw new Error(res.error || 'Failed to punch');
      }

    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'An error occurred during punch in/out.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-varistor-lime" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto pb-20 animate-[fadeInPage_250ms_ease-out]">
      <div className="bg-white rounded-2xl shadow-sm border border-varistor-border overflow-hidden">
        
        {/* Header */}
        <div className="bg-varistor-surface p-6 border-b border-varistor-border text-center">
          <h2 className="text-2xl font-bold text-brand-ink">Field Attendance</h2>
          <p className="text-sm text-varistor-muted mt-1">Capture a photo to log your attendance</p>
        </div>

        {/* Current Status */}
        <div className="flex justify-center -mt-6 mb-4">
          <div className={`px-6 py-2 rounded-full shadow-md font-bold flex items-center gap-2 border-2 ${
            isPunchedIn ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'
          }`}>
            {isPunchedIn ? <CheckCircle2 size={20} /> : <Clock size={20} />}
            {isPunchedIn ? 'PUNCHED IN' : 'PUNCHED OUT'}
          </div>
        </div>

        {/* Camera Area */}
        <div className="p-6 flex flex-col items-center">
          {cameraError ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center text-sm w-full font-medium">
              {cameraError}
              <button 
                onClick={startCamera}
                className="mt-3 bg-red-100 px-4 py-2 rounded-lg hover:bg-red-200 transition-colors w-full"
              >
                Retry Camera
              </button>
            </div>
          ) : (
            <div className="relative w-full max-w-sm aspect-[3/4] bg-black rounded-2xl overflow-hidden shadow-inner border border-gray-200">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
              <div className="absolute top-4 left-4 bg-black/50 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-md flex items-center gap-1.5">
                <MapPin size={12} /> Live Location Synced
              </div>
            </div>
          )}
          
          <canvas ref={canvasRef} className="hidden" />

          {/* Action Button */}
          <button
            onClick={handlePunch}
            disabled={isProcessing || !!cameraError || !stream}
            className={`mt-8 w-full max-w-sm py-4 rounded-xl font-bold text-lg text-white shadow-xl transition-all flex items-center justify-center gap-2 ${
              isPunchedIn 
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' 
                : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isProcessing ? (
              <><Loader2 className="animate-spin" size={24} /> Processing...</>
            ) : (
              <><Camera size={24} /> Punch {isPunchedIn ? 'Out' : 'In'}</>
            )}
          </button>
          
          <p className="text-xs text-varistor-muted text-center mt-4 max-w-sm">
            {isPunchedIn 
              ? "Punching out will stop your background location tracking." 
              : "Punching in will activate location tracking for your shift."}
          </p>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-[slideUp_200ms_ease-out]">
          <div className={`px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-varistor-lime text-white' : 'bg-red-600 text-white'
          }`}>
            {toast.type === 'error' && <X size={18} />}
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
};
