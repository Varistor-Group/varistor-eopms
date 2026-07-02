import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Subtitles,
  CheckCircle,
  Lock,
} from 'lucide-react';
import { trainingApi } from '../api/training';
import type { TrainingModuleWithStatus } from '../types';

interface Props {
  module: TrainingModuleWithStatus;
  onComplete: () => void;
  onBack: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const VideoPlayer: React.FC<Props> = ({ module: mod, onComplete, onBack }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const employeeId = trainingApi.getCurrentUserId();

  // State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(mod.progress?.watched_seconds ?? 0);
  const [duration, setDuration] = useState(mod.duration_seconds);
  const [maxReached, setMaxReached] = useState(mod.progress?.watched_seconds ?? 0);
  const [videoCompleted, setVideoCompleted] = useState(mod.progress?.completed ?? false);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [quizReady, setQuizReady] = useState(mod.progress?.completed ?? false);
  const [quizVisible, setQuizVisible] = useState(mod.progress?.completed ?? false);

  // Seek bar: dragging state
  const [isDragging, setIsDragging] = useState(false);
  const seekBarRef = useRef<HTMLDivElement>(null);

  // On mount: seek to saved position
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const saved = mod.progress?.watched_seconds ?? 0;

    const handleLoaded = () => {
      setDuration(video.duration || mod.duration_seconds);
      if (saved > 0 && saved < video.duration) {
        video.currentTime = saved;
        setCurrentTime(saved);
        setMaxReached(saved);
      }
    };

    video.addEventListener('loadedmetadata', handleLoaded);
    return () => video.removeEventListener('loadedmetadata', handleLoaded);
  }, [mod]);

  // Auto-pause on tab switch
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && videoRef.current) {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Save progress every 5 seconds
  useEffect(() => {
    progressSaveTimer.current = setInterval(() => {
      if (videoRef.current && isPlaying) {
        trainingApi.updateProgress(employeeId, mod.id, Math.floor(videoRef.current.currentTime));
      }
    }, 5000);
    return () => {
      if (progressSaveTimer.current) clearInterval(progressSaveTimer.current);
    };
  }, [isPlaying, employeeId, mod.id]);


  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const t = video.currentTime;
    setCurrentTime(t);
    setMaxReached(prev => {
      const next = Math.max(prev, t);
      return next;
    });
  }, []);

  const handleVideoEnded = useCallback(async () => {
    setIsPlaying(false);
    setVideoCompleted(true);
    await trainingApi.updateProgress(employeeId, mod.id, Math.floor(duration));
    // Slide in the quiz CTA after 300ms
    setTimeout(() => {
      setQuizReady(true);
      setTimeout(() => setQuizVisible(true), 50);
    }, 300);
  }, [employeeId, mod.id, duration]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // ── Seek bar interaction ──────────────────────────────────────────────────
  const calcSeekPosition = (e: React.MouseEvent | MouseEvent): number => {
    const bar = seekBarRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const handleSeekBarMouseDown = (e: React.MouseEvent) => {
    const targetTime = calcSeekPosition(e);
    // Block forward seek if video not completed
    if (!videoCompleted && targetTime > maxReached + 1) return;

    setIsDragging(true);
    if (videoRef.current) {
      const clampedTime = videoCompleted ? targetTime : Math.min(targetTime, maxReached);
      videoRef.current.currentTime = clampedTime;
      setCurrentTime(clampedTime);
    }
  };

  useEffect(() => {
    if (!isDragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const targetTime = calcSeekPosition(e);
      const clampedTime = videoCompleted ? targetTime : Math.min(targetTime, maxReached);
      if (videoRef.current) {
        videoRef.current.currentTime = clampedTime;
        setCurrentTime(clampedTime);
      }
    };

    const onMouseUp = () => setIsDragging(false);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, videoCompleted, maxReached, duration]);

  // ── Controls auto-hide ────────────────────────────────────────────────────
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout) clearTimeout(controlsTimeout);
    const t = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 2500);
    setControlsTimeout(t);
  }, [controlsTimeout, isPlaying]);

  const handleMouseMove = () => resetControlsTimeout();
  const handleContainerClick = () => {
    resetControlsTimeout();
    togglePlay();
  };

  // Mobile tap-to-show controls (don't toggle play on first tap)
  const [mobileTap, setMobileTap] = useState(false);
  const handleTouchStart = () => {
    if (!showControls) {
      setShowControls(true);
      setMobileTap(true);
      if (controlsTimeout) clearTimeout(controlsTimeout);
      const t = setTimeout(() => setShowControls(false), 3000);
      setControlsTimeout(t);
    } else {
      setMobileTap(false);
    }
  };

  const watchedPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const maxReachedPct = duration > 0 ? (maxReached / duration) * 100 : 0;

  return (
    <div className="space-y-0">
      {/* Back button + title bar */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-varistor-muted hover:text-varistor-dark transition-colors duration-150"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
          Back to Library
        </button>
        <span className="text-varistor-border">·</span>
        <span className="text-sm font-semibold text-varistor-dark truncate">{mod.title}</span>
      </div>

      {/* Video container */}
      <div
        ref={containerRef}
        className="relative bg-black rounded-varistor overflow-hidden aspect-video w-full select-none"
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
      >
        {/* Video element */}
        <video
          ref={videoRef}
          src={mod.video_url}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onClick={handleContainerClick}
          onTouchEnd={(e) => { if (!mobileTap) { e.preventDefault(); togglePlay(); } setMobileTap(false); }}
          playsInline
        />

        {/* Cannot skip badge */}
        {!videoCompleted && (
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/60 text-[#ffffff] text-[10px] px-2 py-1 rounded-full">
            <Lock size={10} strokeWidth={2} />
            Cannot skip
          </div>
        )}

        {/* Controls overlay */}
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent transition-opacity duration-200 pointer-events-none ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
        />

        <div
          className={`absolute bottom-0 left-0 right-0 px-4 pb-3 pt-6 transition-opacity duration-200 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}
        >
          {/* Seek bar */}
          <div
            ref={seekBarRef}
            className="relative h-1 rounded-full mb-3 cursor-pointer group/seek"
            style={{ background: 'rgba(255,255,255,0.25)' }}
            onMouseDown={handleSeekBarMouseDown}
          >
            {/* Max-reached buffer (shows how far ahead is unlocked) */}
            {!videoCompleted && (
              <div
                className="absolute top-0 left-0 h-full rounded-full"
                style={{ width: `${maxReachedPct}%`, background: 'rgba(255,255,255,0.35)' }}
              />
            )}
            {/* Watched progress */}
            <div
              className="absolute top-0 left-0 h-full bg-varistor-lime rounded-full"
              style={{ width: `${watchedPct}%` }}
            />
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-varistor-lime rounded-full shadow-md opacity-0 group-hover/seek:opacity-100 transition-opacity"
              style={{ left: `calc(${watchedPct}% - 6px)` }}
            />
          </div>

          {/* Control row */}
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
            <button
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              className="text-[#ffffff] hover:text-varistor-lime transition-colors"
            >
              {isPlaying ? <Pause size={20} strokeWidth={1.5} /> : <Play size={20} strokeWidth={1.5} />}
            </button>

            {/* Time */}
            <span className="text-[#ffffff] text-[11px] font-mono tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <div className="flex-1" />

            {/* Subtitles (placeholder) */}
            <button
              onClick={(e) => e.stopPropagation()}
              title="Subtitles (not available for demo)"
              className="text-[#ffffff]/50 hover:text-[#ffffff] transition-colors cursor-not-allowed"
            >
              <Subtitles size={18} strokeWidth={1.5} />
            </button>

            {/* Mute */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleMute(); }}
              className="text-[#ffffff] hover:text-varistor-lime transition-colors"
            >
              {isMuted ? <VolumeX size={18} strokeWidth={1.5} /> : <Volume2 size={18} strokeWidth={1.5} />}
            </button>

            {/* Fullscreen */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
              className="text-[#ffffff] hover:text-varistor-lime transition-colors"
            >
              <Maximize size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Auto-pause on tab switch notice */}
        <div className="absolute top-3 left-3 text-[10px] text-[#ffffff]/50">
          Auto-pause on tab switch
        </div>
      </div>

      {/* Quiz CTA — slides in on video completion */}
      {quizReady && (
        <div
          className={`mt-4 transition-all duration-300 ${quizVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
        >
          <div className="bg-white border border-varistor-border rounded-varistor shadow-varistor p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-varistor-limeTint flex items-center justify-center flex-shrink-0">
                <CheckCircle size={18} strokeWidth={2} className="text-varistor-lime" />
              </div>
              <div>
                <p className="text-sm font-semibold text-varistor-dark">Video complete!</p>
                <p className="text-[11px] text-varistor-muted">Take the quiz to unlock the next module. Passing score: 70%</p>
              </div>
            </div>
            <button
              onClick={onComplete}
              className="flex-shrink-0 bg-varistor-lime text-varistor-dark text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-lime-500 active:scale-[0.98] transition-all duration-150"
            >
              Start Quiz →
            </button>
          </div>
        </div>
      )}

      {/* Module info below player */}
      <div className="mt-4 bg-white border border-varistor-border rounded-varistor shadow-varistor p-5">
        <h2 className="text-base font-bold text-varistor-dark mb-1">{mod.title}</h2>
        <p className="text-[12px] text-varistor-muted leading-relaxed">{mod.description}</p>
        <div className="mt-3 flex items-center gap-3 text-[11px] text-varistor-muted">
          <span className="px-2 py-0.5 rounded-full bg-varistor-limeLight text-varistor-limeText font-medium border border-varistor-successBorder">{mod.track}</span>
          {mod.department && <span>{mod.department}</span>}
          <span>·</span>
          <span>{Math.ceil(mod.duration_seconds / 60)} min</span>
          {!videoCompleted && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1"><Lock size={10} strokeWidth={1.5} /> Forward seek locked until watched</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
