export type UserRole = 'Employee' | 'Reporting Manager' | 'HR' | 'Admin';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export type TaskStatus = 'todo' | 'in_progress' | 'awaiting_approval' | 'done';

export type DocumentStatus = 'Verified' | 'Pending' | 'Rejected' | 'Under Review';

export interface TaskAssignee {
  name: string;
  avatarUrl: string;
}

export interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface Comment {
  id: string;
  text: string;
  author: string;
  authorAvatar: string;
  timestamp: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: string;
  type: string;
  url: string;
}

export interface Task {
  id: string;
  assigneeId?: string;
  title: string;
  description: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignee: TaskAssignee;
  checklist: ChecklistItem[];
  comments: Comment[];
  attachments: Attachment[];
  pointsProcessed?: boolean; // Avoid double points processing
  isOverdueSwept?: boolean;
}

export interface LedgerEntry {
  id: string;
  taskId?: string;
  taskTitle: string;
  points: number;
  type: 'credit' | 'debit';
  reason: string;
  timestamp: string;
  employeeId?: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  points: number;
  type: 'credit' | 'debit';
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  author_role: 'HR' | 'Admin';
  created_at: string;
  type: 'Standard' | 'Birthday' | 'Policy';
}

export interface AnnouncementReaction {
  id: string;
  announcement_id: string;
  user_id: string;
  emoji_type: string;
  created_at: string;
}

export interface AnnouncementRead {
  id: string;
  announcement_id: string;
  user_id: string;
  read_at: string;
}

export interface AnnouncementDTO extends Announcement {
  reactions: { emoji: string; count: number; reactedByUser: boolean }[];
  isRead: boolean;
}

export type ChannelId = 'all-hands' | 'sales-team' | 'operations' | 'tech-dev' | 'hr-announcements';

export interface ChatChannel {
  id: ChannelId;
  name: string;
  memberCount: number;
  pinned?: string;
}

export interface ChatAttachment {
  name: string;
  size: string;
}

export interface ChatMessage {
  id: string;
  channelId: ChannelId;
  authorName: string;
  authorRole: string;
  authorAvatar: string;
  isSelf: boolean;
  text?: string;
  attachment?: ChatAttachment;
  timestamp: string;
}

// ─── Training (Task B) ──────────────────────────────────────────────────────

export type TrainingTrack = 'General' | 'Department' | 'Tech';
export type TrainingStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'failed';

export interface TrainingModule {
  id: string;
  title: string;
  description: string;
  track: TrainingTrack;
  department?: string;
  duration_seconds: number;
  thumbnail_url: string;
  video_url: string;
  order: number;
  prerequisite_id: string | null;
}

export interface TrainingProgress {
  id: string;
  employee_id: string;
  module_id: string;
  watched_seconds: number;
  completed: boolean;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  module_id: string;
  question: string;
  options: string[];
  correct_index: number;
}

export interface QuizAttempt {
  id: string;
  employee_id: string;
  module_id: string;
  answers: Record<string, number>;
  score: number;
  passed: boolean;
  attempted_at: string;
}

export interface TrainingModuleWithStatus extends TrainingModule {
  status: TrainingStatus;
  progress: TrainingProgress | null;
  latestAttempt: QuizAttempt | null;
}

