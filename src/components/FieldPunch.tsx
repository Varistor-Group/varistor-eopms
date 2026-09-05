import React, { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, CheckCircle2, Clock, Loader2, X } from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';
import { isFieldEmployeePunchedIn } from '../api/attendance';
import { apiFetch } from '../api/httpClient';
import { Camera as CapCamera } from '@capacitor/camera';
import { Geolocation as CapGeolocation } from '@capacitor/geolocation';
import { WfhApprovalDashboard } from './WfhApprovalDashboard';

export const FieldPunch: React.FC = () => {
  const { currentUser, currentRole } = useVariPoints();
  const [isPunchedIn, setIsPunchedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const cameraRequestId = useRef<number>(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    // Admin/HR land on the WFH Approvals view instead of the punch UI --
    // never activate their camera or fetch punch status.
    if (currentRole !== 'Admin' && currentRole !== 'HR' && !currentUser?.is_field_employee) {
      checkPunchStatus();
      startCamera();
    }
    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, [currentUser, currentRole]);

  const checkPunchStatus = async () => {
    if (!currentUser) return;
    try {
      const status = await isFieldEmployeePunchedIn();
      setIsPunchedIn(status);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    setCameraError('');
    const currentRequestId = ++cameraRequestId.current;
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

      if (currentRequestId !== cameraRequestId.current || !isMountedRef.current) {
        mediaStream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setCameraError('Camera access denied or unavailable. Please grant permissions.');
    }
  };

  const stopCamera = () => {
    cameraRequestId.current++;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
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
    
    setIsProcessing(true);
    try {
      // Get Location
      const pos = await getLocation();
      const locationData = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      };

      const punchType = isPunchedIn ? 'out' : 'in';
      
      const response = await apiFetch('/api/attendance/punch', {
        method: 'POST',
        body: JSON.stringify({
          employeeId: currentUser.id,
          employeeName: currentUser.name,
          latitude: locationData.lat,
          longitude: locationData.lng,
          action: punchType
        })
      });

      const res = await response.json();
      
      if (res.success) {
        if (res.status === 'Present') {
          setIsPunchedIn(!isPunchedIn);
          showToast(res.message, 'success');
        } else if (res.status === 'WFH') {
          showToast(res.message, 'success'); // Shows the WFH trigger message
        }
      } else {
        throw new Error(res.error || 'Failed to punch');
      }

    } catch (err: any) {
      console.error(err);
      if (err.message.includes('User denied Geolocation')) {
        showToast('Location permission denied. You must allow location to punch in.', 'error');
      } else {
        showToast(err.message || 'An error occurred during punch in/out.', 'error');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (currentRole === 'Admin' || currentRole === 'HR') {
    return <WfhApprovalDashboard />;
  }

  // Field employees punch in/out via the Attendance tab's own photo +
  // geolocation flow instead -- this tab is for non-field employees only.
  // Defense-in-depth: also enforced by hiding this tab in Sidebar.tsx, but
  // guarded here too in case the tab is reached any other way.
  if (currentUser?.is_field_employee) {
    return (
      <div className="max-w-md mx-auto mt-12 text-center text-varistor-muted">
        <p>Please use the <strong>Attendance</strong> tab to punch in and out.</p>
      </div>
    );
  }

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
          <h2 className="text-2xl font-bold text-brand-ink">Universal Attendance</h2>
          <p className="text-sm text-varistor-muted mt-1">Punch in using your verified location</p>
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
