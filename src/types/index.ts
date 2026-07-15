export type UserRole = 'Employee' | 'Field Employee' | 'Reporting Manager' | 'HR' | 'Admin';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export type TaskStatus = 'todo' | 'in_progress' | 'awaiting_approval' | 'done';

export type DocumentStatus = 'Verified' | 'Pending' | 'Rejected' | 'Under Review';

// ─── Document Vault Templates ─────────────────────────────────────────────────

export interface DocumentTemplate {
  id: string;
  name: string;
  description?: string;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface EmployeeDocumentSlot {
  id: string;
  employeeId: string;
  templateId?: string;       // null for custom/ad-hoc slots
  documentName: string;
  isRequired: boolean;
  isCustom: boolean;         // true = added by HR only for this employee
  documentId?: string;       // linked documents row id after upload
  filename?: string;         // file name from the documents row
  storagePath?: string;
  status: DocumentStatus;
  notes?: string;            // HR notes for this slot
  createdAt: string;
}

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

// ─── Field Tracker ───────────────────────────────────────────────────────────

export interface LocationEntry {
  id: string;
  employeeId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string; // ISO
}

export interface LatestLocation extends LocationEntry {
  employeeName: string;
  department: string;
}

export interface FieldEmployeeLocation {
  employeeId: string;
  employeeName: string;
  department: string;
  lat: number;
  lng: number;
  accuracy: number;           // metres
  batteryLevel: number;       // 0–100
  status: 'Active' | 'Idle' | 'Offline';
  lastUpdated: string;        // ISO timestamp
  todayCheckIn?: string;      // ISO timestamp or undefined
  todayCheckOut?: string;
  distanceTravelledKm: number;
  routeHistory: [number, number][]; // historical [lat, lng] points for today's route
}

// ─── Team Chat (Area E) ──────────────────────────────────────────────────────

export type ChannelId = string;

export interface ChatChannel {
  id: ChannelId;
  name: string;
  memberCount: number;
  pinned?: string;
  allowedEmployeeIds?: string[]; // If defined, only these employees can access the channel
  departments?: string[];        // If defined, employees in these departments can access the channel
}

export interface ChatAttachment {
  name: string;
  size: string;
  type?: string;
  dataUrl?: string;
}

export interface ChatReaction {
  emoji: string;
  userName: string;
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
  reactions?: ChatReaction[];
  timestamp: string;
  edited?: boolean;
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
  /** Roles that can see this module. Empty/undefined = visible to everyone. */
  visibleToRoles?: UserRole[];
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

// ─── Leave Management ────────────────────────────────────────────────────────

export interface LeaveTypeModel {
  id: string;
  name: string;
  description: string;
  default_allocation: number;
}

export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

export interface LeaveRequest {
  id: string;                    // e.g. "LV-0044"
  employeeId: string;
  employeeName: string;
  type: string;                  // Dynamic leave type name
  from: string;                  // ISO date "2026-07-03"
  to: string;                    // ISO date "2026-07-03"
  days: number;                  // calculated working days
  reason: string;
  status: LeaveStatus;
  reviewerId?: string;           // employee ID of approver
  reviewerName?: string;         // display name
  rejectionComment?: string;
  submittedAt: string;           // ISO timestamp
  reviewedAt?: string;
}

export interface EmployeeLeaveBalance {
  id: string;
  employee_id: string;
  leave_type_name: string;
  total: number;
  used: number;
}

// Legacy fallback (will be removed eventually)
export interface LeaveBalance {
  employeeId: string;
  casual?: { total: number; used: number };
  sick?: { total: number; used: number };
  earned?: { total: number; used: number };
  unpaidTaken?: number;
}

