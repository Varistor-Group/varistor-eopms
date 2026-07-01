export type UserRole = 'Employee' | 'Reporting Manager' | 'HR' | 'Admin';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export type TaskStatus = 'todo' | 'in_progress' | 'awaiting_approval' | 'done';

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

