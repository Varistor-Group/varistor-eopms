import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, Link as LinkIcon, X } from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';
import { supabase } from '../lib/supabase';

interface ProfilePictureEditorProps {
  onClose: () => void;
  className?: string;
}

export const ProfilePictureEditor: React.FC<ProfilePictureEditorProps> = ({ onClose, className = "absolute top-12 right-0 mt-2" }) => {
  const { currentUser, setCurrentUser } = useVariPoints();
  const [activeTab, setActiveTab] = useState<'url' | 'upload' | 'camera'>('upload');
  
  // URL Tab
  const [urlInput, setUrlInput] = useState(currentUser?.avatarUrl ?? '');
  
  // Camera Tab
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');

  // Start camera when switching to camera tab
  useEffect(() => {
    if (activeTab === 'camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [activeTab]);

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const startCamera = async () => {
    setCameraError('');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (activeTabRef.current !== 'camera') {
        mediaStream.getTracks().forEach(track => track.stop());
        return;
      }
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      if (activeTabRef.current === 'camera') {
        setCameraError('Camera access denied or unavailable.');
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const mediaStream = videoRef.current.srcObject as MediaStream;
      mediaStream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setStream(prevStream => {
      if (prevStream) {
        prevStream.getTracks().forEach(track => track.stop());
      }
      return null;
    });
  };

  useEffect(() => {
    return () => {
      activeTabRef.current = 'none' as any; // Force stop if unmounted
      stopCamera();
    };
  }, []);

  const saveAvatar = async (dataUrl: string) => {
    if (currentUser && dataUrl.trim()) {
      const newAvatar = dataUrl.trim();
      setCurrentUser({ ...currentUser, avatarUrl: newAvatar });
      
      // Persist to Supabase
      try {
        await supabase
          .from('employees')
          .update({ avatar_url: newAvatar })
          .eq('id', currentUser.id);
      } catch (err) {
        console.error('Failed to persist avatar to Supabase:', err);
      }
    }
    onClose();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result) {
        saveAvatar(ev.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        saveAvatar(dataUrl);
      }
    }
  };

  return (
    <div className={`${className} w-72 bg-white border border-varistor-border rounded-xl shadow-2xl p-4 z-50 animate-[fadeInPage_150ms_ease-out]`}>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-varistor-dark flex items-center gap-2">
          <Camera size={16} /> Update Photo
        </h3>
        <button onClick={onClose} className="text-varistor-muted hover:text-varistor-dark">
          <X size={16} />
        </button>
      </div>

      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('upload')}
          className={`flex-1 text-xs font-bold py-1.5 rounded-md flex items-center justify-center gap-1 transition-colors ${activeTab === 'upload' ? 'bg-white shadow-sm text-varistor-dark' : 'text-varistor-muted hover:text-varistor-dark'}`}
        >
          <Upload size={12} /> File
        </button>
        <button
          onClick={() => setActiveTab('camera')}
          className={`flex-1 text-xs font-bold py-1.5 rounded-md flex items-center justify-center gap-1 transition-colors ${activeTab === 'camera' ? 'bg-white shadow-sm text-varistor-dark' : 'text-varistor-muted hover:text-varistor-dark'}`}
        >
          <Camera size={12} /> Camera
        </button>
        <button
          onClick={() => setActiveTab('url')}
          className={`flex-1 text-xs font-bold py-1.5 rounded-md flex items-center justify-center gap-1 transition-colors ${activeTab === 'url' ? 'bg-white shadow-sm text-varistor-dark' : 'text-varistor-muted hover:text-varistor-dark'}`}
        >
          <LinkIcon size={12} /> URL
        </button>
      </div>

      {activeTab === 'upload' && (
        <div className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-200 rounded-lg bg-varistor-pageBg hover:bg-gray-50 transition-colors cursor-pointer relative">
          <Upload size={24} className="text-varistor-muted mb-2" />
          <span className="text-xs text-varistor-dark font-semibold">Click to upload image</span>
          <span className="text-[10px] text-varistor-muted">PNG, JPG up to 5MB</span>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileUpload}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </div>
      )}

      {activeTab === 'camera' && (
        <div className="flex flex-col gap-2">
          {cameraError ? (
            <div className="text-xs text-red-500 p-3 bg-red-50 rounded-lg text-center font-medium">
              {cameraError}
            </div>
          ) : (
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              {!stream && <span className="text-xs text-white">Starting camera...</span>}
            </div>
          )}
          {stream && (
            <button 
              onClick={capturePhoto}
              className="w-full text-xs font-bold bg-varistor-lime text-varistor-dark px-3 py-2 rounded-lg hover:brightness-105 transition-colors mt-2"
            >
              Take Photo
            </button>
          )}
        </div>
      )}

      {activeTab === 'url' && (
        <div className="flex flex-col gap-2">
          <input
            type="url"
            autoFocus
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') saveAvatar(urlInput);
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Paste image URL..."
            className="text-xs border border-varistor-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-varistor-lime/30 bg-varistor-pageBg w-full"
          />
          <button
            onClick={() => saveAvatar(urlInput)}
            className="w-full text-xs font-bold bg-varistor-lime text-varistor-dark px-3 py-2 rounded-lg hover:brightness-105 transition-colors mt-2"
          >
            Save URL
          </button>
        </div>
      )}
    </div>
  );
};
