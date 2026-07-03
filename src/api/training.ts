import type {
  TrainingModule,
  TrainingProgress,
  QuizQuestion,
  QuizAttempt,
  TrainingModuleWithStatus,
  TrainingStatus,
  UserRole,
} from '../types';

const SERVER_URL = 'http://localhost:3001';
const MOCK_USER_ID = 'user-aarav';

// ─── Mock seed data ───────────────────────────────────────────────────────────

const MOCK_MODULES: TrainingModule[] = [
  // General track
  {
    id: 'mod-gen-1',
    title: 'Welcome & Company Values',
    description: 'An introduction to Varistor Technologies — our mission, culture, and what we stand for as a team.',
    track: 'General',
    duration_seconds: 480,
    thumbnail_url: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=640&fit=crop&q=60',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    order: 1,
    prerequisite_id: null,
  },
  {
    id: 'mod-gen-2',
    title: 'General Behaviour & POSH',
    description: 'Workplace conduct standards and the Prevention of Sexual Harassment (POSH) policy — mandatory for all employees.',
    track: 'General',
    duration_seconds: 750,
    thumbnail_url: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?w=640&fit=crop&q=60',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    order: 2,
    prerequisite_id: 'mod-gen-1',
  },
  {
    id: 'mod-gen-3',
    title: 'Data Security & IT Policy',
    description: 'How to handle company data responsibly — acceptable use of devices, password hygiene, and incident reporting.',
    track: 'General',
    duration_seconds: 600,
    thumbnail_url: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?w=640&fit=crop&q=60',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    order: 3,
    prerequisite_id: 'mod-gen-2',
  },
  // Department track
  {
    id: 'mod-dept-1',
    title: 'Department Orientation — Operations SOPs',
    description: 'Standard Operating Procedures for the Operations department. Covers daily workflows, reporting structures, and escalation paths.',
    track: 'Department',
    department: 'Operations',
    duration_seconds: 900,
    thumbnail_url: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=640&fit=crop&q=60',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    order: 1,
    prerequisite_id: null,
  },
  {
    id: 'mod-dept-2',
    title: 'Tool Onboarding — EOPMS Walkthrough',
    description: 'A hands-on walkthrough of the Varistor EOPMS platform — tasks, Vari Points, leaves, payroll, and chat.',
    track: 'Department',
    department: 'Operations',
    duration_seconds: 660,
    thumbnail_url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=640&fit=crop&q=60',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    order: 2,
    prerequisite_id: 'mod-dept-1',
  },
  // Tech track
  {
    id: 'mod-tech-1',
    title: 'Technical Training — Role Specific',
    description: 'Role-specific technical onboarding covering the tools, frameworks, and internal systems used by your team.',
    track: 'Tech',
    duration_seconds: 1200,
    thumbnail_url: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=640&fit=crop&q=60',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    order: 1,
    prerequisite_id: null,
  },
];

const MOCK_QUESTIONS: Record<string, QuizQuestion[]> = {
  'mod-gen-1': [
    { id: 'q1-1', module_id: 'mod-gen-1', question: 'What is the primary mission of Varistor Technologies?', options: ['Maximize shareholder value', 'Deliver technology solutions with integrity', 'Expand to international markets', 'Reduce operational costs'], correct_index: 1 },
    { id: 'q1-2', module_id: 'mod-gen-1', question: 'Which value is at the core of Varistor\'s culture?', options: ['Speed above all else', 'Collaboration and transparency', 'Individual recognition only', 'Cost minimization'], correct_index: 1 },
    { id: 'q1-3', module_id: 'mod-gen-1', question: 'How many departments does Varistor currently operate?', options: ['4', '5', '6', '8'], correct_index: 2 },
  ],
  'mod-gen-2': [
    { id: 'q2-1', module_id: 'mod-gen-2', question: 'According to POSH, what counts as workplace harassment?', options: ['Constructive performance feedback', 'Unwelcome conduct of a sexual nature', 'Requesting deadline extensions', 'Cross-department collaboration'], correct_index: 1 },
    { id: 'q2-2', module_id: 'mod-gen-2', question: 'Who should you contact first if you witness harassment?', options: ['The CEO', 'Your buddy', 'The HR/Admin team or ICC', 'A client'], correct_index: 2 },
    { id: 'q2-3', module_id: 'mod-gen-2', question: 'The POSH Act applies to:',  options: ['Only female employees', 'Only permanent employees', 'All employees regardless of gender or contract type', 'Only senior management'], correct_index: 2 },
    { id: 'q2-4', module_id: 'mod-gen-2', question: 'What is the expected professional behaviour when working late?', options: ['Inform HR and ensure someone else is present', 'Work alone without informing anyone', 'Leave early instead', 'Ask a client to supervise'], correct_index: 0 },
  ],
  'mod-gen-3': [
    { id: 'q3-1', module_id: 'mod-gen-3', question: 'You receive a suspicious email asking for your EOPMS password. What do you do?', options: ['Reply with your password', 'Forward it to HR/IT immediately', 'Ignore it and continue working', 'Share it with a colleague to check'], correct_index: 1 },
    { id: 'q3-2', module_id: 'mod-gen-3', question: 'Which of the following is an acceptable password practice?', options: ['Using your name and birthdate', 'Sharing passwords with your manager', 'Using a unique password with >12 characters', 'Reusing old passwords'], correct_index: 2 },
    { id: 'q3-3', module_id: 'mod-gen-3', question: 'Company data must be stored:', options: ['On personal Google Drive', 'On company-approved systems only', 'On USB drives for easy sharing', 'Locally only, never in cloud'], correct_index: 1 },
  ],
  'mod-dept-1': [
    { id: 'q4-1', module_id: 'mod-dept-1', question: 'Daily task updates must be submitted by:', options: ['9 AM', '12 PM (noon)', 'End of day', 'Weekly on Friday'], correct_index: 2 },
    { id: 'q4-2', module_id: 'mod-dept-1', question: 'When a vendor delivery is delayed, you should first:', options: ['Wait and see', 'Alert your Reporting Manager immediately', 'Contact the client directly', 'Ignore it if under 24 hours'], correct_index: 1 },
    { id: 'q4-3', module_id: 'mod-dept-1', question: 'Material tracker pending items must be resolved within:', options: ['Same day', '48 hours', 'One week', 'When convenient'], correct_index: 1 },
  ],
  'mod-dept-2': [
    { id: 'q5-1', module_id: 'mod-dept-2', question: 'On the EOPMS Kanban board, tasks need approval before being marked as:', options: ['In Progress', 'Done', 'Pending', 'Archived'], correct_index: 1 },
    { id: 'q5-2', module_id: 'mod-dept-2', question: 'Vari Points are awarded when a task is completed:', options: ['Any time', 'Before the due date', 'After manager reviews', 'At month end'], correct_index: 1 },
    { id: 'q5-3', module_id: 'mod-dept-2', question: 'Leave applications must be submitted:', options: ['On the day of leave', 'At least 1 day in advance', 'Only via email', 'Only for emergencies'], correct_index: 1 },
  ],
  'mod-tech-1': [
    { id: 'q6-1', module_id: 'mod-tech-1', question: 'Which version control system does Varistor use?', options: ['SVN', 'Mercurial', 'Git with GitHub', 'Perforce'], correct_index: 2 },
    { id: 'q6-2', module_id: 'mod-tech-1', question: 'Direct pushes to the main branch are:', options: ['Encouraged', 'Only for seniors', 'Never allowed — always use PRs', 'Allowed on Fridays'], correct_index: 2 },
    { id: 'q6-3', module_id: 'mod-tech-1', question: 'Which tech stack does the EOPMS frontend use?', options: ['Vue + Laravel', 'React + TypeScript + Vite', 'Angular + Django', 'Next.js + Go'], correct_index: 1 },
    { id: 'q6-4', module_id: 'mod-tech-1', question: 'API keys and secrets must NEVER be:', options: ['Stored in .env files', 'Rotated regularly', 'Committed to Git', 'Shared only with leads'], correct_index: 2 },
  ],
};

// ─── Server modules (HR/Admin uploads, persisted in db.json) ─────────────────

let serverModulesCache: TrainingModule[] = [];
const serverQuestionsCache: Record<string, QuizQuestion[]> = {};

async function fetchServerModules(): Promise<TrainingModule[]> {
  try {
    const res = await fetch(`${SERVER_URL}/api/training/modules`);
    if (res.ok) {
      const data = await res.json();
      serverModulesCache = Array.isArray(data) ? data : [];
    }
  } catch {
    // Server not running — fall back to seed modules only
  }
  return serverModulesCache;
}

function allKnownModules(): TrainingModule[] {
  return [...MOCK_MODULES, ...serverModulesCache];
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function getProgress(): TrainingProgress[] {
  return JSON.parse(localStorage.getItem('eopms_training_progress') || '[]');
}

function saveProgress(data: TrainingProgress[]) {
  localStorage.setItem('eopms_training_progress', JSON.stringify(data));
}

function getAttempts(): QuizAttempt[] {
  return JSON.parse(localStorage.getItem('eopms_quiz_attempts') || '[]');
}

function saveAttempts(data: QuizAttempt[]) {
  localStorage.setItem('eopms_quiz_attempts', JSON.stringify(data));
}

function getSavedAnswers(): Record<string, Record<string, number>> {
  return JSON.parse(localStorage.getItem('eopms_quiz_saved_answers') || '{}');
}

function writeSavedAnswers(data: Record<string, Record<string, number>>) {
  localStorage.setItem('eopms_quiz_saved_answers', JSON.stringify(data));
}

// ─── Status resolver ──────────────────────────────────────────────────────────

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

  // A prerequisite the user cannot see (different audience, or deleted) counts
  // as satisfied — otherwise they would be permanently locked out.
  const prereqVisible = !visibleIds || (module.prerequisite_id !== null && visibleIds.has(module.prerequisite_id));

  if (module.prerequisite_id && prereqVisible) {
    const prereqAttempt = allAttempts
      .filter(a => a.employee_id === employeeId && a.module_id === module.prerequisite_id && a.passed)
      .length > 0;
    if (!prereqAttempt) return 'locked';
  }

  const progress = allProgress.find(
    p => p.employee_id === employeeId && p.module_id === module.id
  );

  if (attempt && !attempt.passed) return 'failed';
  if (progress && progress.watched_seconds > 0) return 'in_progress';
  return 'available';
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const trainingApi = {
  getCurrentUserId(): string {
    return MOCK_USER_ID;
  },

  async fetchModulesWithStatus(employeeId: string, role?: UserRole): Promise<TrainingModuleWithStatus[]> {
    await delay();
    const serverModules = await fetchServerModules();
    const allProgress = getProgress();
    const allAttempts = getAttempts();

    const merged = [...MOCK_MODULES, ...serverModules];

    // HR/Admin (or no role given) see everything; learners only see modules
    // whose audience is empty or includes their role.
    const isManager = role === 'HR' || role === 'Admin';
    const visible = !role || isManager
      ? merged
      : merged.filter(m => !m.visibleToRoles || m.visibleToRoles.length === 0 || m.visibleToRoles.includes(role));
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
    const all = getProgress();
    const idx = all.findIndex(p => p.employee_id === employeeId && p.module_id === moduleId);
    const module = allKnownModules().find(m => m.id === moduleId);
    const completed = module ? watchedSeconds >= module.duration_seconds : false;

    if (idx > -1) {
      if (watchedSeconds > all[idx].watched_seconds) {
        all[idx].watched_seconds = watchedSeconds;
        all[idx].completed = completed;
      }
    } else {
      all.push({
        id: `prog-${Date.now()}`,
        employee_id: employeeId,
        module_id: moduleId,
        watched_seconds: watchedSeconds,
        completed,
        created_at: new Date().toISOString(),
      });
    }
    saveProgress(all);
  },

  async fetchQuizQuestions(moduleId: string): Promise<QuizQuestion[]> {
    await delay();
    // Server-authored questions first, then fall back to the seeded mocks
    try {
      const res = await fetch(`${SERVER_URL}/api/training/questions/${moduleId}`);
      if (res.ok) {
        const qs = await res.json();
        if (Array.isArray(qs) && qs.length > 0) {
          serverQuestionsCache[moduleId] = qs;
          return qs;
        }
      }
    } catch {
      // Server not running — use mocks
    }
    return MOCK_QUESTIONS[moduleId] ?? [];
  },

  async getLatestAttempt(employeeId: string, moduleId: string): Promise<QuizAttempt | null> {
    await delay();
    const all = getAttempts();
    return all
      .filter(a => a.employee_id === employeeId && a.module_id === moduleId)
      .sort((a, b) => new Date(b.attempted_at).getTime() - new Date(a.attempted_at).getTime())[0] ?? null;
  },

  getSavedAnswersForModule(employeeId: string, moduleId: string): Record<string, number> {
    const all = getSavedAnswers();
    return all[`${employeeId}:${moduleId}`] ?? {};
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
    await delay();

    const questions = serverQuestionsCache[moduleId] ?? MOCK_QUESTIONS[moduleId] ?? [];
    const correct = questions.filter(q => answers[q.id] === q.correct_index).length;
    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    const passed = score >= 70;

    const attempt: QuizAttempt = {
      id: `att-${Date.now()}`,
      employee_id: employeeId,
      module_id: moduleId,
      answers,
      score,
      passed,
      attempted_at: new Date().toISOString(),
    };

    const all = getAttempts();
    all.push(attempt);
    saveAttempts(all);

    // Clear saved in-progress answers after submit
    this.clearSavedAnswers(employeeId, moduleId);

    // Send email via Express server (best-effort)
    try {
      await fetch(`${SERVER_URL}/api/quiz/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeEmail, hrEmail, moduleTitle, score, passed }),
      });
    } catch {
      // Server not running — silently skip email
    }

    return attempt;
  },

  // ── HR/Admin module management ──────────────────────────────────────────────

  async createModule(formData: FormData): Promise<TrainingModule> {
    const res = await fetch(`${SERVER_URL}/api/training/modules`, {
      method: 'POST',
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to create module. Is the server running?');
    }
    return data.module;
  },

  async deleteModule(moduleId: string): Promise<void> {
    const res = await fetch(`${SERVER_URL}/api/training/modules/${moduleId}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete module.');
    }
  },

  isCustomModule(moduleId: string): boolean {
    return moduleId.startsWith('mod-custom-');
  },

  isRetryAllowed(latestAttempt: QuizAttempt | null): boolean {
    if (!latestAttempt) return true;
    if (latestAttempt.passed) return false;
    const elapsed = Date.now() - new Date(latestAttempt.attempted_at).getTime();
    return elapsed >= 24 * 60 * 60 * 1000;
  },

  retryUnlocksAt(latestAttempt: QuizAttempt): Date {
    return new Date(new Date(latestAttempt.attempted_at).getTime() + 24 * 60 * 60 * 1000);
  },
};

const delay = (ms = 120) => new Promise(resolve => setTimeout(resolve, ms));
