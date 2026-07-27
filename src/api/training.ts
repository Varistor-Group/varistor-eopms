/**
 * TRAINING SERVICE — MySQL (via PHP backend)
 * Converted from Supabase. Resolver logic (resolveStatus) now lives server-side
 * in training_modules.php since status depends on role/department, which the
 * server derives from the auth token rather than trusting client-passed values.
 * File uploads (video/thumbnail) now go to real cPanel disk storage via
 * multipart/form-data, served by direct URL — replaces Supabase Storage.
 */

import { apiFetch } from './httpClient';
import type {
  QuizQuestion,
  QuizAttempt,
  TrainingModule,
  TrainingModuleWithStatus,
} from '../types';
import { API_URL } from '../config/api';

// ─── Saved answers (still localStorage — ephemeral in-quiz state, unchanged) ─

function getSavedAnswers(): Record<string, Record<string, number>> {
  return JSON.parse(localStorage.getItem('eopms_quiz_saved_answers') || '{}');
}
function writeSavedAnswers(data: Record<string, Record<string, number>>) {
  localStorage.setItem('eopms_quiz_saved_answers', JSON.stringify(data));
}

// ─── Public API ──────────────────────────────────────────────────────────────

export const trainingApi = {
  // NOTE: role/department params are no longer sent — the server derives them
  // from the auth token so a client can't spoof visibility filtering.
  async fetchModulesWithStatus(): Promise<TrainingModuleWithStatus[]> {
    const res = await apiFetch('/api/training-modules');
    if (!res.ok) { console.error('[fetchModulesWithStatus]', res.statusText); return []; }
    return res.json();
  },

  async updateProgress(moduleId: string, watchedSeconds: number): Promise<void> {
    await apiFetch('/api/training-progress', {
      method: 'PUT',
      body: JSON.stringify({ moduleId, watchedSeconds }),
    });
  },

  async fetchQuizQuestions(moduleId: string): Promise<QuizQuestion[]> {
    const res = await apiFetch(`/api/quiz-questions/${moduleId}`);
    if (!res.ok) { console.error('[fetchQuizQuestions]', res.statusText); return []; }
    return res.json();
  },

  async getLatestAttempt(moduleId: string): Promise<QuizAttempt | null> {
    const res = await apiFetch(`/api/quiz-attempts/latest/${moduleId}`);
    if (!res.ok) return null;
    return res.json();
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
    const res = await apiFetch('/api/quiz-attempts', {
      method: 'POST',
      body: JSON.stringify({ moduleId, answers }),
    });
    const attempt = await res.json();

    this.clearSavedAnswers(employeeId, moduleId);

    // Best-effort email via raw fetch — same pattern as send-credentials in
    // employees.ts, bypasses apiFetch/auth since it's a fire-and-forget
    // side effect, not a core CRUD call.
    try {
      await fetch(`${API_URL}/api/quiz/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeEmail, hrEmail, moduleTitle, score: attempt.score, passed: attempt.passed }),
      });
    } catch { /* server not running / best-effort — skip email */ }

    return attempt;
  },

  // ── HR/Admin module management ─────────────────────────────────────────────

  async createModule(formData: FormData): Promise<TrainingModule> {
    const res = await apiFetch('/api/training-modules', {
      method: 'POST',
      body: formData,
      isMultipart: true,
    });
    const result = await res.json().catch(() => null);
    if (!res.ok || !result) throw new Error(result?.error || 'Failed to create module.');
    return result;
  },

  async deleteModule(moduleId: string): Promise<void> {
    const res = await apiFetch(`/api/training-modules/${moduleId}`, { method: 'DELETE' });
    const result = await res.json().catch(() => null);
    if (!res.ok || !result?.success) throw new Error(result?.error || 'Failed to delete module.');
  },

  isCustomModule(moduleId: string): boolean {
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