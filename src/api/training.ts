/**
 * TRAINING SERVICE — Supabase
 * Replaces localStorage + Express server calls.
 */

import { supabase } from '../lib/supabase';
import type {
  TrainingModule,
  TrainingProgress,
  QuizQuestion,
  QuizAttempt,
  TrainingModuleWithStatus,
  TrainingStatus,
  UserRole,
} from '../types';
import { API_URL } from '../config/api';

// ─── Status resolver (unchanged logic) ──────────────────────────────────────

function resolveStatus(
  module: TrainingModule,
  allProgress: TrainingProgress[],
  allAttempts: QuizAttempt[],
  employeeId: string,
  visibleIds?: Set<string>
): TrainingStatus {
  const attempt = allAttempts
    .filter(a => a.employee_id === employeeId && a.module_id === module.id)
    .sort((a, b) => new Date(b.attempted_at).getTime() - new Date(a.attempted_at).getTime())[0];

  if (attempt?.passed) return 'completed';

  const prereqVisible = !visibleIds || (module.prerequisite_id !== null && visibleIds.has(module.prerequisite_id));
  if (module.prerequisite_id && prereqVisible) {
    const prereqPassed = allAttempts.some(a => a.employee_id === employeeId && a.module_id === module.prerequisite_id && a.passed);
    if (!prereqPassed) return 'locked';
  }

  const progress = allProgress.find(p => p.employee_id === employeeId && p.module_id === module.id);
  if (attempt && !attempt.passed) return 'failed';
  if (progress && progress.watched_seconds > 0) return 'in_progress';
  return 'available';
}

// ─── DB row mappers ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToModule(row: any): TrainingModule {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    track: row.track,
    department: row.department ?? undefined,
    duration_seconds: row.duration_seconds,
    thumbnail_url: row.thumbnail_url,
    video_url: row.video_url,
    order: row.order,
    prerequisite_id: row.prerequisite_id ?? null,
    visibleToRoles: row.visible_to_roles?.length ? row.visible_to_roles : undefined,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProgress(row: any): TrainingProgress {
  return {
    id: row.id,
    employee_id: row.employee_id,
    module_id: row.module_id,
    watched_seconds: row.watched_seconds,
    completed: row.completed,
    created_at: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAttempt(row: any): QuizAttempt {
  return {
    id: row.id,
    employee_id: row.employee_id,
    module_id: row.module_id,
    answers: row.answers ?? {},
    score: row.score,
    passed: row.passed,
    attempted_at: row.attempted_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToQuestion(row: any): QuizQuestion {
  return {
    id: row.id,
    module_id: row.module_id,
    question: row.question,
    options: row.options,
    correct_index: row.correct_index,
  };
}

// ─── Saved answers (still localStorage — ephemeral in-quiz state) ────────────

function getSavedAnswers(): Record<string, Record<string, number>> {
  return JSON.parse(localStorage.getItem('eopms_quiz_saved_answers') || '{}');
}
function writeSavedAnswers(data: Record<string, Record<string, number>>) {
  localStorage.setItem('eopms_quiz_saved_answers', JSON.stringify(data));
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const trainingApi = {
  getCurrentUserId(): string {
    return 'user-session'; // resolved from auth session in callers
  },

  async fetchModulesWithStatus(employeeId: string, role?: UserRole): Promise<TrainingModuleWithStatus[]> {
    const [{ data: modulesData }, { data: progressData }, { data: attemptsData }] = await Promise.all([
      supabase.from('training_modules').select('*').order('order', { ascending: true }),
      supabase.from('training_progress').select('*').eq('employee_id', employeeId),
      supabase.from('quiz_attempts').select('*').eq('employee_id', employeeId),
    ]);

    const allModules = (modulesData ?? []).map(rowToModule);
    const allProgress = (progressData ?? []).map(rowToProgress);
    const allAttempts = (attemptsData ?? []).map(rowToAttempt);

    const isManager = role === 'HR' || role === 'Admin';
    const visible = !role || isManager
      ? allModules
      : allModules.filter(m => !m.visibleToRoles || m.visibleToRoles.length === 0 || m.visibleToRoles.includes(role));
    const visibleIds = new Set(visible.map(m => m.id));

    return visible.map(module => {
      const status = resolveStatus(module, allProgress, allAttempts, employeeId, visibleIds);
      const progress = allProgress.find(p => p.employee_id === employeeId && p.module_id === module.id) ?? null;
      const latestAttempt = allAttempts
        .filter(a => a.employee_id === employeeId && a.module_id === module.id)
        .sort((a, b) => new Date(b.attempted_at).getTime() - new Date(a.attempted_at).getTime())[0] ?? null;
      return { ...module, status, progress, latestAttempt };
    });
  },

  async updateProgress(employeeId: string, moduleId: string, watchedSeconds: number): Promise<void> {
    const { data: module } = await supabase
      .from('training_modules')
      .select('duration_seconds')
      .eq('id', moduleId)
      .single();
    const completed = module ? watchedSeconds >= module.duration_seconds : false;

    await supabase.from('training_progress').upsert(
      { employee_id: employeeId, module_id: moduleId, watched_seconds: watchedSeconds, completed },
      { onConflict: 'employee_id,module_id' }
    );
  },

  async fetchQuizQuestions(moduleId: string): Promise<QuizQuestion[]> {
    const { data, error } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('module_id', moduleId)
      .order('created_at', { ascending: true });
    if (error) { console.error('[fetchQuizQuestions]', error.message); return []; }
    return (data ?? []).map(rowToQuestion);
  },

  async getLatestAttempt(employeeId: string, moduleId: string): Promise<QuizAttempt | null> {
    const { data } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('module_id', moduleId)
      .order('attempted_at', { ascending: false })
      .limit(1)
      .single();
    return data ? rowToAttempt(data) : null;
  },

  getSavedAnswersForModule(employeeId: string, moduleId: string): Record<string, number> {
    return getSavedAnswers()[`${employeeId}:${moduleId}`] ?? {};
  },

  saveAnswerForQuestion(employeeId: string, moduleId: string, questionId: string, answerIndex: number): void {
    const all = getSavedAnswers();
    const key = `${employeeId}:${moduleId}`;
    all[key] = { ...(all[key] ?? {}), [questionId]: answerIndex };
    writeSavedAnswers(all);
  },

  clearSavedAnswers(employeeId: string, moduleId: string): void {
    const all = getSavedAnswers();
    delete all[`${employeeId}:${moduleId}`];
    writeSavedAnswers(all);
  },

  async submitQuiz(
    employeeId: string,
    moduleId: string,
    answers: Record<string, number>,
    moduleTitle: string,
    employeeEmail: string,
    hrEmail: string
  ): Promise<QuizAttempt> {
    const questions = await this.fetchQuizQuestions(moduleId);
    const correct = questions.filter(q => answers[q.id] === q.correct_index).length;
    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    const passed = score >= 70;

    const { data, error } = await supabase
      .from('quiz_attempts')
      .insert({ employee_id: employeeId, module_id: moduleId, answers, score, passed })
      .select()
      .single();

    if (error || !data) {
      console.error('[submitQuiz]', error?.message);
      // Return a fallback object
      return { id: `att-${Date.now()}`, employee_id: employeeId, module_id: moduleId, answers, score, passed, attempted_at: new Date().toISOString() };
    }

    this.clearSavedAnswers(employeeId, moduleId);

    // Send email via Express server (best-effort)
    try {
      await fetch(`${API_URL}/api/quiz/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeEmail, hrEmail, moduleTitle, score, passed }),
      });
    } catch { /* server not running — skip email */ }

    return rowToAttempt(data);
  },

  // ── HR/Admin module management ─────────────────────────────────────────────

  async createModule(formData: FormData): Promise<TrainingModule> {
    // Upload video file to Supabase Storage if present
    const videoFile = formData.get('video') as File | null;
    let video_url = (formData.get('video_url') as string) || '';
    let thumbnail_url = (formData.get('thumbnail_url') as string) || '';

    if (videoFile && videoFile.size > 0) {
      const path = `modules/${Date.now()}_${videoFile.name}`;
      const { data: uploaded, error: uploadErr } = await supabase.storage
        .from('training-videos')
        .upload(path, videoFile, { upsert: false });
      if (uploadErr) throw new Error(`Video upload failed: ${uploadErr.message}`);
      const { data: urlData } = supabase.storage.from('training-videos').getPublicUrl(uploaded.path);
      video_url = urlData.publicUrl;
    }

    const thumbnailFile = formData.get('thumbnail') as File | null;
    if (thumbnailFile && thumbnailFile.size > 0) {
      const path = `thumbnails/${Date.now()}_${thumbnailFile.name}`;
      const { data: uploaded, error: uploadErr } = await supabase.storage
        .from('training-videos')
        .upload(path, thumbnailFile, { upsert: false });
      if (uploadErr) throw new Error(`Thumbnail upload failed: ${uploadErr.message}`);
      const { data: urlData } = supabase.storage.from('training-videos').getPublicUrl(uploaded.path);
      thumbnail_url = urlData.publicUrl;
    }

    const payload = {
      title: formData.get('title') as string,
      description: (formData.get('description') as string) || '',
      track: (formData.get('track') as string) || 'General',
      department: (formData.get('department') as string) || null,
      duration_seconds: parseInt((formData.get('duration_seconds') as string) || '0', 10),
      thumbnail_url,
      video_url,
      order: parseInt((formData.get('order') as string) || '1', 10),
      prerequisite_id: (formData.get('prerequisite_id') as string) || null,
      visible_to_roles: [] as string[],
      is_seed: false,
    };

    const { data, error } = await supabase.from('training_modules').insert(payload).select().single();
    if (error || !data) throw new Error(error?.message || 'Failed to create module.');
    return rowToModule(data);
  },

  async deleteModule(moduleId: string): Promise<void> {
    const { error } = await supabase.from('training_modules').delete().eq('id', moduleId).eq('is_seed', false);
    if (error) throw new Error(error.message);
  },

  isCustomModule(moduleId: string): boolean {
    // All non-seed modules are custom (is_seed=false in DB)
    return !moduleId.startsWith('mod-gen-') && !moduleId.startsWith('mod-dept-') && !moduleId.startsWith('mod-tech-');
  },

  isRetryAllowed(latestAttempt: QuizAttempt | null): boolean {
    if (!latestAttempt) return true;
    if (latestAttempt.passed) return false;
    return Date.now() - new Date(latestAttempt.attempted_at).getTime() >= 24 * 60 * 60 * 1000;
  },

  retryUnlocksAt(latestAttempt: QuizAttempt): Date {
    return new Date(new Date(latestAttempt.attempted_at).getTime() + 24 * 60 * 60 * 1000);
  },
};
