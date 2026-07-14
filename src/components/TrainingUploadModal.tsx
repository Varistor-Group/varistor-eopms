import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactPlayer from 'react-player';

const Player = ReactPlayer as unknown as React.ElementType;
import { X, Upload, Plus, Trash2, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { trainingApi } from '../api/training';
import type { TrainingModule, TrainingTrack, UserRole } from '../types';

interface Props {
  modules: TrainingModule[];
  onClose: () => void;
  onCreated: () => void;
}

const LEARNER_ROLES: UserRole[] = ['Employee', 'Field Employee', 'Reporting Manager', 'HR'];
const TRACKS: TrainingTrack[] = ['General', 'Department', 'Tech'];

interface QuestionDraft {
  question: string;
  options: [string, string, string, string];
  correct_index: number;
}

const emptyQuestion = (): QuestionDraft => ({
  question: '',
  options: ['', '', '', ''],
  correct_index: 0,
});

// Matches youtube.com/watch?v=, youtu.be/, youtube.com/embed/ and /shorts/ URLs.
const YOUTUBE_ID_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;

function extractYouTubeId(url: string): string | null {
  const match = url.trim().match(YOUTUBE_ID_RE);
  return match ? match[1] : null;
}

const TrainingUploadModal: React.FC<Props> = ({ modules, onClose, onCreated }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [track, setTrack] = useState<TrainingTrack>('General');
  const [department, setDepartment] = useState('');
  const [prerequisiteId, setPrerequisiteId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [everyone, setEveryone] = useState(true);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [duration, setDuration] = useState<number | null>(null);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hidden <video> source — a blob URL for a picked file, or the pasted URL.
  const videoSrc = useMemo(() => {
    if (file) return URL.createObjectURL(file);
    if (videoUrl.trim()) return videoUrl.trim();
    return null;
  }, [file, videoUrl]);

  const youtubeId = useMemo(() => extractYouTubeId(videoUrl), [videoUrl]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDuration(null);
    setDurationError(null);
    return () => {
      if (file && videoSrc) URL.revokeObjectURL(videoSrc);
    };
  }, [videoSrc]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0] ?? null;
    if (chosen && !chosen.name.toLowerCase().endsWith('.mp4')) {
      setError('Only .mp4 files are accepted.');
      e.target.value = '';
      return;
    }
    if (chosen && chosen.size > 200 * 1024 * 1024) {
      setError('Video exceeds the 200 MB size limit.');
      e.target.value = '';
      return;
    }
    setError(null);
    setFile(chosen);
    if (chosen) setVideoUrl(''); // file and URL are mutually exclusive
  };

  const handleUrlChange = (value: string) => {
    setVideoUrl(value);
    if (value.trim() && file) {
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleRole = (role: UserRole) => {
    setEveryone(false);
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const updateQuestion = (qi: number, patch: Partial<QuestionDraft>) => {
    setQuestions(prev => prev.map((q, i) => (i === qi ? { ...q, ...patch } : q)));
  };

  const updateOption = (qi: number, oi: number, value: string) => {
    setQuestions(prev =>
      prev.map((q, i) => {
        if (i !== qi) return q;
        const options = [...q.options] as QuestionDraft['options'];
        options[oi] = value;
        return { ...q, options };
      })
    );
  };

  const validate = (): string | null => {
    if (!title.trim()) return 'Title is required.';
    if (!description.trim()) return 'Description is required.';
    if (!file && !videoUrl.trim()) return 'Choose an MP4 file or paste a video URL.';
    if (durationError) return durationError;
    if (!duration || duration <= 0) return 'Video duration could not be detected yet. Wait a moment or check the file/URL.';
    if (!everyone && selectedRoles.length === 0) return 'Select at least one audience role, or choose Everyone.';
    if (questions.length === 0) return 'Add at least one quiz question.';
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) return `Question ${i + 1} is empty.`;
      if (q.options.some(o => !o.trim())) return `Question ${i + 1} needs all 4 options filled in.`;
    }
    return null;
  };

  const handleSubmit = async () => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const sameTrack = modules.filter(m => m.track === track);
      const order = sameTrack.length > 0 ? Math.max(...sameTrack.map(m => m.order)) + 1 : 1;

      const formData = new FormData();
      if (file) formData.append('video', file);
      else formData.append('video_url', videoUrl.trim());
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('track', track);
      if (track === 'Department' && department.trim()) formData.append('department', department.trim());
      if (prerequisiteId) formData.append('prerequisite_id', prerequisiteId);
      formData.append('duration_seconds', String(Math.round(duration!)));
      formData.append('order', String(order));
      if (youtubeId) formData.append('thumbnail_url', `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`);
      formData.append('visibleToRoles', JSON.stringify(everyone ? [] : selectedRoles));
      formData.append(
        'questions',
        JSON.stringify(
          questions.map(q => ({
            question: q.question.trim(),
            options: q.options.map(o => o.trim()),
            correct_index: q.correct_index,
          }))
        )
      );

      await trainingApi.createModule(formData);
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create module.');
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 rounded-lg border border-varistor-border bg-white text-sm text-varistor-dark placeholder:text-varistor-muted focus:outline-none focus:border-varistor-lime transition-colors';
  const labelCls = 'block text-[11px] font-semibold text-varistor-muted uppercase tracking-wider mb-1.5';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      {/* Hidden probe video for duration auto-detection */}
      {videoSrc && (
        <div className="absolute opacity-0 pointer-events-none w-[1px] h-[1px] overflow-hidden z-[-1]">
          <Player
            src={videoSrc}
            playing={true}
            muted
            playsInline
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onDurationChange={(e: any) => {
              const d = e.currentTarget?.duration;
              if (Number.isFinite(d) && d > 0) {
                setDuration(d);
                setDurationError(null);
              } else {
                setDurationError('Could not read the video duration from this source.');
              }
            }}
            onError={() => setDurationError('Could not load this video. Check the file or URL.')}
            config={{ youtube: { disablekb: 1, rel: 0 } }}
          />
        </div>
      )}

      <div className="bg-white border border-varistor-border rounded-varistor shadow-varistor w-full max-w-2xl my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-varistor-border">
          <div className="flex items-center gap-2">
            <Upload size={18} strokeWidth={1.5} className="text-varistor-lime" />
            <h2 className="text-base font-bold text-varistor-dark">Upload Training Module</h2>
          </div>
          <button onClick={onClose} className="text-varistor-muted hover:text-varistor-dark transition-colors" disabled={submitting}>
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <label className={labelCls}>Title</label>
            <input className={inputCls} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Fire Safety Basics" maxLength={120} />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea className={`${inputCls} resize-none`} rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="What will employees learn in this module?" maxLength={400} />
          </div>

          {/* Track + Department + Prerequisite */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Track</label>
              <select className={inputCls} value={track} onChange={e => setTrack(e.target.value as TrainingTrack)}>
                {TRACKS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Department <span className="normal-case font-normal">(optional)</span></label>
              <input className={inputCls} value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Operations" disabled={track !== 'Department'} />
            </div>
            <div>
              <label className={labelCls}>Prerequisite</label>
              <select className={inputCls} value={prerequisiteId} onChange={e => setPrerequisiteId(e.target.value)}>
                <option value="">None</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
              </select>
            </div>
          </div>

          {/* Video source */}
          <div className="space-y-3">
            <label className={labelCls}>Video (MP4 upload, or a YouTube / direct video link)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4"
              onChange={handleFileChange}
              className="block w-full text-sm text-varistor-muted file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-varistor-lime file:text-varistor-dark file:text-[11px] file:font-semibold file:cursor-pointer hover:file:bg-lime-500 file:transition-colors"
            />
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-varistor-border" />
              <span className="text-[10px] text-varistor-muted uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-varistor-border" />
            </div>
            <input
              className={inputCls}
              value={videoUrl}
              onChange={e => handleUrlChange(e.target.value)}
              placeholder="Paste a YouTube link or a direct video URL, e.g. https://youtube.com/watch?v=… or https://…/video.mp4"
            />

            {/* Duration feedback */}
            {videoSrc && (
              <div className="flex items-center gap-1.5 text-[11px]">
                {duration ? (
                  <>
                    <CheckCircle size={12} strokeWidth={2} className="text-varistor-lime" />
                    <span className="text-varistor-successText font-medium">
                      {youtubeId ? 'YouTube video linked' : 'Duration detected'}: {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
                    </span>
                  </>
                ) : durationError ? (
                  <>
                    <AlertCircle size={12} strokeWidth={1.5} className="text-varistor-dangerText" />
                    <span className="text-varistor-dangerText">{durationError}</span>
                  </>
                ) : (
                  <>
                    <Clock size={12} strokeWidth={1.5} className="text-varistor-muted" />
                    <span className="text-varistor-muted">{youtubeId ? 'Loading YouTube video…' : 'Detecting duration…'}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Audience */}
          <div>
            <label className={labelCls}>Audience</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => { setEveryone(true); setSelectedRoles([]); }}
                className={`px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-colors ${everyone ? 'bg-varistor-lime text-varistor-dark border-varistor-lime' : 'bg-white text-varistor-muted border-varistor-border hover:border-varistor-lime'}`}
              >
                Everyone
              </button>
              {LEARNER_ROLES.map(role => (
                <button
                  key={role}
                  type="button"
                  onClick={() => toggleRole(role)}
                  className={`px-3 py-1.5 rounded-full border text-[11px] font-semibold transition-colors ${!everyone && selectedRoles.includes(role) ? 'bg-varistor-lime text-varistor-dark border-varistor-lime' : 'bg-white text-varistor-muted border-varistor-border hover:border-varistor-lime'}`}
                >
                  {role}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-varistor-muted">HR and Admin always see every module for management.</p>
          </div>

          {/* Quiz builder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className={labelCls}>Quiz Questions (min. 1)</label>
              <button
                type="button"
                onClick={() => setQuestions(prev => [...prev, emptyQuestion()])}
                className="flex items-center gap-1 text-[11px] font-semibold text-varistor-limeText hover:underline"
              >
                <Plus size={12} strokeWidth={2} /> Add question
              </button>
            </div>

            {questions.map((q, qi) => (
              <div key={qi} className="border border-varistor-border rounded-lg p-4 space-y-2.5 bg-varistor-pageBg/40">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-varistor-muted flex-shrink-0">Q{qi + 1}</span>
                  <input
                    className={inputCls}
                    value={q.question}
                    onChange={e => updateQuestion(qi, { question: e.target.value })}
                    placeholder="Question text"
                  />
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setQuestions(prev => prev.filter((_, i) => i !== qi))}
                      className="text-varistor-muted hover:text-varistor-dangerText transition-colors flex-shrink-0"
                      title="Remove question"
                    >
                      <Trash2 size={14} strokeWidth={1.5} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${qi}`}
                        checked={q.correct_index === oi}
                        onChange={() => updateQuestion(qi, { correct_index: oi })}
                        className="accent-lime-500 flex-shrink-0"
                        title="Mark as correct answer"
                      />
                      <input
                        className={inputCls}
                        value={opt}
                        onChange={e => updateOption(qi, oi, e.target.value)}
                        placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-varistor-muted">Select the radio button next to the correct answer.</p>
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-1.5 text-[11px] text-varistor-dangerText bg-varistor-dangerBg border border-varistor-dangerBorder rounded-lg px-3 py-2">
              <AlertCircle size={12} strokeWidth={1.5} className="flex-shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-varistor-border">
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-sm text-varistor-muted border border-varistor-border px-5 py-2.5 rounded-lg hover:bg-varistor-pageBg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 bg-varistor-lime text-varistor-dark text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-lime-500 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <Upload size={14} strokeWidth={2} />}
            {submitting ? 'Uploading…' : 'Create Module'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrainingUploadModal;
