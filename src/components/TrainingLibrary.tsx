import React, { useEffect, useState, useCallback } from 'react';
import { BookOpen, Lock, CheckCircle, Clock, PlayCircle, RotateCcw, AlertCircle, Plus, Trash2, Users } from 'lucide-react';
import { trainingApi } from '../api/training';
import { useVariPoints } from '../hooks/useVariPoints';
import type { TrainingModuleWithStatus, TrainingStatus, TrainingTrack } from '../types';
import VideoPlayer from './VideoPlayer';
import QuizScreen from './QuizScreen';
import TrainingUploadModal from './TrainingUploadModal';

type InternalView = 'library' | 'player' | 'quiz';

const TRACK_ORDER: TrainingTrack[] = ['General', 'Department', 'Tech'];

const TRACK_LABELS: Record<TrainingTrack, string> = {
  General: 'General Training',
  Department: 'Department Training',
  Tech: 'Technical Training',
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function StatusBadge({ status }: { status: TrainingStatus }) {
  const cfg = {
    locked:      { label: 'Locked',      cls: 'bg-varistor-pendingBg text-varistor-pendingText border-varistor-pendingBorder' },
    available:   { label: 'Not started', cls: 'bg-varistor-pendingBg text-varistor-pendingText border-varistor-pendingBorder' },
    in_progress: { label: 'In progress', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    completed:   { label: 'Completed',   cls: 'bg-varistor-successBg text-varistor-successText border-varistor-successBorder' },
    failed:      { label: 'Retry needed',cls: 'bg-varistor-dangerBg text-varistor-dangerText border-varistor-dangerBorder' },
  }[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function ProgressBar({ watched, duration }: { watched: number; duration: number }) {
  const pct = Math.min(100, Math.round((watched / duration) * 100));
  return (
    <div className="w-full h-1 bg-varistor-border rounded-full overflow-hidden">
      <div
        className="h-full bg-varistor-lime rounded-full transition-all duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function TrainingCard({
  mod,
  onStart,
  showAudience = false,
  onDelete,
}: {
  mod: TrainingModuleWithStatus;
  onStart: (mod: TrainingModuleWithStatus) => void;
  showAudience?: boolean;
  onDelete?: (mod: TrainingModuleWithStatus) => void;
}) {
  const isLocked = mod.status === 'locked';
  const isCompleted = mod.status === 'completed';

  const ctaLabel = () => {
    if (mod.status === 'in_progress') return 'Continue';
    if (mod.status === 'failed') return 'Retry';
    if (mod.status === 'available') return 'Start';
    return null;
  };

  return (
    <div
      className={`bg-white border border-varistor-border rounded-varistor shadow-varistor flex flex-col overflow-hidden transition-all duration-200 ${isLocked ? 'opacity-50' : 'hover:shadow-md hover:-translate-y-0.5'}`}
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-varistor-pageBg overflow-hidden group">
        <img
          src={mod.thumbnail_url}
          alt={mod.title}
          className="w-full h-full object-cover"
        />
        {/* Overlay on hover for non-locked */}
        {!isLocked && !isCompleted && (
          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <PlayCircle size={40} className="text-white" />
          </div>
        )}
        {/* Completed overlay */}
        {isCompleted && (
          <div className="absolute inset-0 bg-varistor-lime/20 flex items-center justify-center">
            <CheckCircle size={36} className="text-varistor-lime" strokeWidth={2} />
          </div>
        )}
        {/* Lock overlay */}
        {isLocked && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <Lock size={28} className="text-varistor-muted" strokeWidth={1.5} />
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Title + badge row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-varistor-dark leading-snug line-clamp-2 flex-1">{mod.title}</h3>
          <StatusBadge status={mod.status} />
        </div>

        {/* Description */}
        <p className="text-[11px] text-varistor-muted leading-relaxed line-clamp-2">{mod.description}</p>

        {/* Audience badge (HR/Admin management view only) */}
        {showAudience && (
          <div className="flex items-center gap-1.5 text-[10px] text-varistor-muted">
            <Users size={11} strokeWidth={1.5} className="flex-shrink-0" />
            <span className="truncate">
              Audience: {mod.visibleToRoles && mod.visibleToRoles.length > 0 ? mod.visibleToRoles.join(', ') : 'Everyone'}
            </span>
            {onDelete && trainingApi.isCustomModule(mod.id) && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(mod); }}
                className="ml-auto flex-shrink-0 text-varistor-muted hover:text-varistor-dangerText transition-colors"
                title="Delete this uploaded module"
              >
                <Trash2 size={12} strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}

        {/* Duration */}
        <div className="flex items-center gap-1.5 text-[10px] text-varistor-muted">
          <Clock size={12} strokeWidth={1.5} />
          <span>{formatDuration(mod.duration_seconds)}</span>
          {mod.department && (
            <>
              <span className="mx-1 text-varistor-border">·</span>
              <span className="text-varistor-limeText font-medium">{mod.department}</span>
            </>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* CTA */}
        {isLocked ? (
          <div className="relative group/tooltip">
            <div className="w-full py-2 px-4 rounded-lg bg-varistor-pageBg border border-varistor-border text-[11px] text-varistor-muted text-center font-medium cursor-not-allowed select-none flex items-center justify-center gap-1.5">
              <Lock size={12} strokeWidth={1.5} />
              Locked
            </div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-varistor-dark text-white text-[10px] rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
              Complete the previous module to unlock
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-varistor-dark" />
            </div>
          </div>
        ) : isCompleted ? (
          <div className="w-full py-2 px-4 rounded-lg bg-varistor-successBg border border-varistor-successBorder text-[11px] text-varistor-successText text-center font-semibold flex items-center justify-center gap-1.5">
            <CheckCircle size={12} strokeWidth={2} />
            Completed
          </div>
        ) : (
          <button
            onClick={() => onStart(mod)}
            className="w-full py-2 px-4 rounded-lg bg-varistor-lime text-varistor-dark text-[11px] font-semibold hover:bg-lime-500 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-1.5"
          >
            {mod.status === 'failed' ? <RotateCcw size={12} strokeWidth={2} /> : <PlayCircle size={12} strokeWidth={2} />}
            {ctaLabel()}
          </button>
        )}
      </div>

      {/* Progress bar footer */}
      {mod.progress && mod.progress.watched_seconds > 0 && !isCompleted && (
        <ProgressBar watched={mod.progress.watched_seconds} duration={mod.duration_seconds} />
      )}
      {isCompleted && <div className="h-1 bg-varistor-lime" />}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
const TrainingLibrary: React.FC = () => {
  const [modules, setModules] = useState<TrainingModuleWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<InternalView>('library');
  const [selectedModule, setSelectedModule] = useState<TrainingModuleWithStatus | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const { currentRole } = useVariPoints();
  const isManager = currentRole === 'HR' || currentRole === 'Admin';

  const loadModules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await trainingApi.fetchModulesWithStatus();
      setModules(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
   
    loadModules();
  }, [loadModules]);

  const handleStartModule = (mod: TrainingModuleWithStatus) => {
    setSelectedModule(mod);
    // If video already completed go straight to quiz, else play video
    if (mod.progress?.completed) {
      setView('quiz');
    } else {
      setView('player');
    }
  };

  const handleVideoComplete = () => {
    setView('quiz');
  };

  const handleQuizComplete = async () => {
    await loadModules();
    setView('library');
    setSelectedModule(null);
  };

  const handleBack = async () => {
    await loadModules();
    setView('library');
    setSelectedModule(null);
  };

  const handleModuleCreated = async () => {
    setShowUpload(false);
    await loadModules();
  };

  const handleDeleteModule = async (mod: TrainingModuleWithStatus) => {
    if (!window.confirm(`Delete the module "${mod.title}"? This also removes its video and quiz.`)) return;
    try {
      await trainingApi.deleteModule(mod.id);
      await loadModules();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Failed to delete module.');
    }
  };

  if (view === 'player' && selectedModule) {
    return (
      <VideoPlayer
        module={selectedModule}
        onComplete={handleVideoComplete}
        onBack={handleBack}
      />
    );
  }

  if (view === 'quiz' && selectedModule) {
    return (
      <QuizScreen
        module={selectedModule}
        onComplete={handleQuizComplete}
        onBack={handleBack}
      />
    );
  }

  // ── Library view ────────────────────────────────────────────────────────────

  const completedCount = modules.filter(m => m.status === 'completed').length;
  const totalCount = modules.length;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={20} strokeWidth={1.5} className="text-varistor-lime" />
            <h1 className="text-xl font-bold text-varistor-dark">Training Library</h1>
          </div>
          <p className="text-sm text-varistor-muted">Complete all modules to finish your onboarding. Modules unlock sequentially within each track.</p>
        </div>

        <div className="flex-shrink-0 flex items-center gap-3">
        {/* Upload module (HR/Admin only) */}
        {isManager && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 bg-varistor-lime text-varistor-dark text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-lime-500 active:scale-[0.98] transition-all duration-150"
          >
            <Plus size={14} strokeWidth={2} />
            Upload Module
          </button>
        )}

        {/* Overall progress chip */}
        {!loading && (
          <div className="flex-shrink-0 flex items-center gap-2 bg-white border border-varistor-border rounded-varistor px-4 py-2.5 shadow-varistor">
            <div className="text-right">
              <p className="text-[10px] text-varistor-muted uppercase tracking-wider font-semibold">Overall</p>
              <p className="text-base font-bold text-varistor-dark">{completedCount}<span className="text-varistor-muted font-normal text-sm"> / {totalCount}</span></p>
            </div>
            <div className="w-px h-8 bg-varistor-border" />
            <CheckCircle size={20} strokeWidth={1.5} className={completedCount === totalCount ? 'text-varistor-lime' : 'text-varistor-muted'} />
          </div>
        )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-varistor-border rounded-varistor shadow-varistor overflow-hidden animate-pulse">
              <div className="aspect-video bg-varistor-pageBg" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-varistor-pageBg rounded w-3/4" />
                <div className="h-3 bg-varistor-pageBg rounded w-full" />
                <div className="h-3 bg-varistor-pageBg rounded w-1/2" />
                <div className="h-8 bg-varistor-pageBg rounded mt-4" />
              </div>
            </div>
          ))}
        </div>
      ) : modules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen size={40} strokeWidth={1.5} className="text-varistor-muted mb-3" />
          <p className="text-sm font-semibold text-varistor-dark">No training modules yet</p>
          <p className="text-xs text-varistor-muted mt-1">
            {isManager ? 'Upload a module to get started.' : 'Check back soon — modules will appear here once published.'}
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {TRACK_ORDER.map(track => {
            const trackModules = modules.filter(m => m.track === track);
            if (trackModules.length === 0) return null;
            const trackDone = trackModules.filter(m => m.status === 'completed').length;

            return (
              <section key={track}>
                {/* Track header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-varistor-dark">{TRACK_LABELS[track]}</h2>
                    <span className="text-[10px] font-semibold text-varistor-muted bg-varistor-pageBg border border-varistor-border px-2 py-0.5 rounded-full">
                      {trackDone}/{trackModules.length} done
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-varistor-border" />
                </div>

                {/* Track modules note */}
                {track !== 'General' && (
                  <div className="flex items-center gap-1.5 mb-4 text-[11px] text-varistor-muted">
                    <AlertCircle size={12} strokeWidth={1.5} />
                    <span>Modules unlock sequentially — complete each quiz to proceed.</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {trackModules
                    .sort((a, b) => a.order - b.order)
                    .map(mod => (
                      <TrainingCard
                        key={mod.id}
                        mod={mod}
                        onStart={handleStartModule}
                        showAudience={isManager}
                        onDelete={isManager ? handleDeleteModule : undefined}
                      />
                    ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Upload modal (HR/Admin only) */}
      {showUpload && isManager && (
        <TrainingUploadModal
          modules={modules}
          onClose={() => setShowUpload(false)}
          onCreated={handleModuleCreated}
        />
      )}
    </div>
  );
};

export default TrainingLibrary;
