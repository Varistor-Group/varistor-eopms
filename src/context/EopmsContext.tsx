import React, { createContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import type { Task, LedgerEntry, ToastMessage, TaskStatus, UserRole, TaskPriority, AnnouncementDTO, LeaveRequest, LeaveBalance } from '../types';
import { announcementsApi } from '../api/announcements';
import { mockEmployeeStore, updateEmployee } from '../api/employees';
import { getLeaveBalance, getLeaveRequestsAsync, submitLeaveRequest, approveLeaveRequest, rejectLeaveRequest } from '../api/leaves';
import { tasksApi } from '../api/tasks';
import { API_URL } from '../config/api';
import { supabase } from '../lib/supabase';
import { awardPoints } from '../api/vpTransactions';

// Simulated current date for testing due dates
const SIMULATED_TODAY = new Date('2026-06-29T10:00:00');

// Logged-in user shape (password-stripped)
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  department: string;
  avatarUrl: string;
  role: UserRole;
  dob?: string;
  is_field_employee?: boolean;
}

interface EopmsContextType {
  tasks: Task[];
  ledger: LedgerEntry[];
  toasts: ToastMessage[];
  pointsBalance: number;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  currentUser: CurrentUser | null;
  setCurrentUser: (user: CurrentUser | null) => void;

  // Kanban Actions
  moveTask: (taskId: string, newStatus: TaskStatus) => void;
  approveTask: (taskId: string) => void;
  rejectTask: (taskId: string) => void;
  createTask: (title: string, description: string, dueDate: string, priority: TaskPriority, assigneeId: string, checkpoints?: string[]) => void;
  updateTaskDetails: (taskId: string, title: string, description: string, priority: TaskPriority, dueDate: string) => void;
  addComment: (taskId: string, text: string) => void;
  toggleChecklistItem: (taskId: string, itemId: string) => void;
  addChecklistItem: (taskId: string, text: string) => void;
  addAttachment: (taskId: string, name: string, size: string, type: string) => void;

  // Points System Actions
  assertAdministrativeTransaction: (
    type: 'misconduct' | 'late_entry' | 'custom_debit' | 'custom_credit',
    reason: string,
    customPoints?: number,
    employeeId?: string,
    isAutomated?: boolean
  ) => void;
  addToast: (message: string, points: number, type: 'credit' | 'debit') => void;
  dismissToast: (toastId: string) => void;
  announcements: AnnouncementDTO[];
  reactToAnnouncement: (announcementId: string, emojiType: string) => void;
  readAnnouncement: (announcementId: string) => void;
  addAnnouncement: (title: string, content: string, type: 'Standard' | 'Birthday' | 'Policy', authorRole?: 'HR' | 'Admin') => void;

  // Leave Management
  leaveRequests: LeaveRequest[];
  leaveBalance: LeaveBalance | null;
  submitLeave: (input: Omit<LeaveRequest, 'id' | 'status' | 'submittedAt'>) => void;
  approveLeave: (leaveId: string) => void;
  rejectLeave: (leaveId: string, comment: string) => void;

  // Realtime Policy Notifications
  policyNotification: { show: boolean; title: string };
  setPolicyNotification: (state: { show: boolean; title: string }) => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const EopmsContext = createContext<EopmsContextType | undefined>(undefined);

// Priority configuration matrix
const POINT_MATRIX: Record<TaskPriority, { onTime: number; missed: number; weight: number }> = {
  critical: { onTime: 100, missed: 200, weight: 4 },
  high: { onTime: 75, missed: 125, weight: 3 },
  medium: { onTime: 50, missed: 75, weight: 2 },
  low: { onTime: 25, missed: 30, weight: 1 }
};


const initialLedger: LedgerEntry[] = [
  {
    id: 'led-1',
    taskTitle: 'Q2 Performance review setup',
    points: 75, // Matches base matrix for High
    type: 'credit',
    reason: 'Task completed before due date',
    timestamp: '2026-06-25T14:22:00.000Z'
  },
  {
    id: 'led-2',
    taskTitle: 'Weekly timesheet logs',
    points: 50, // Matches base matrix for Medium
    type: 'credit',
    reason: 'Task completed before due date',
    timestamp: '2026-06-26T17:05:00.000Z'
  },
  {
    id: 'led-3',
    taskTitle: 'Inventory database update',
    points: 75, // Matches base matrix for Medium missed
    type: 'debit',
    reason: 'Task completed past due date',
    timestamp: '2026-06-27T11:45:00.000Z'
  }
];

export const EopmsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>([]);

  const [ledger, setLedger] = useState<LedgerEntry[]>(() => {
    const saved = localStorage.getItem('eopms_ledger_refactored');
    return saved ? JSON.parse(saved) : initialLedger;
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('eopms_role');
    return (saved as UserRole) || 'Admin'; // Default role is Admin
  });

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(() => {
    try {
      const saved = localStorage.getItem('eopms_current_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const MOCK_USER_ID = currentRole === 'Reporting Manager' ? '2131' : '2';
  const [announcements, setAnnouncements] = useState<AnnouncementDTO[]>([]);

  // ── Leave Management state ────────────────────────────────────────────────
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveBalance, setLeaveBalance] = useState<LeaveBalance | null>(null);

  // ── Realtime Notifications state ──────────────────────────────────────────
  const [policyNotification, setPolicyNotification] = useState({ show: false, title: '' });

  useEffect(() => {
    // Load async states for leaves
    const empId = currentUser?.id ?? MOCK_USER_ID;
    getLeaveBalance(empId).then(setLeaveBalance).catch(console.error);
    getLeaveRequestsAsync(currentRole === 'Admin' || currentRole === 'HR' ? undefined : empId).then(setLeaveRequests).catch(console.error);
  }, [currentUser, currentRole, MOCK_USER_ID]);

  // Tasks Fetch and Realtime Subscription
  useEffect(() => {
    const loadTasks = async () => {
      try {
        const fetchedTasks = await tasksApi.fetchTasks();
        // Map assignees using mockEmployeeStore
        const mappedTasks = fetchedTasks.map(t => {
          const employee = mockEmployeeStore.find(e => e.id === t.assigneeId);
          if (employee) {
            t.assignee = { name: employee.fullName, avatarUrl: employee.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60' };
          }
          return t;
        });
        setTasks(mappedTasks);
      } catch (err) {
        console.error('Failed to load tasks', err);
      }
    };
    loadTasks();

    const channel = supabase.channel('public:tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        () => {
          // Re-fetch tasks on any DB event to ensure consistent UI
          loadTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const submitLeave = (input: Omit<LeaveRequest, 'id' | 'status' | 'submittedAt'>) => {
    const optimistic = submitLeaveRequest(input);
    setLeaveRequests(prev => [optimistic, ...prev]);
    addToast('Leave request submitted successfully', 0, 'credit');

    // Fire-and-forget manager notification email (same pattern as createEmployee)
    fetch(`${API_URL}/api/leave/notify-manager`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeName: input.employeeName,
        leaveType: input.type,
        from: input.from,
        to: input.to,
        days: input.days,
        reason: input.reason,
        managerEmail: 'manager@varistor.in',
      }),
    }).catch(() => { /* email server unreachable — ignore in mock mode */ });
  };

  const approveLeave = (leaveId: string) => {
    const reviewerName = currentRole === 'HR' ? 'HR Team' : currentRole === 'Admin' ? 'Admin' : 'Reporting Manager';
    approveLeaveRequest(leaveId, reviewerName);
    setLeaveRequests(prev => prev.map(r => r.id === leaveId ? { ...r, status: 'Approved', reviewerName, reviewedAt: new Date().toISOString() } : r));
    addToast('Leave request approved', 0, 'credit');

    // Refresh balance after approval
    const empId = currentUser?.id ?? MOCK_USER_ID;
    getLeaveBalance(empId).then(setLeaveBalance).catch(console.error);
  };

  const rejectLeave = async (leaveId: string, comment: string) => {
    const reviewerName = currentRole === 'HR' ? 'HR Team' : currentRole === 'Admin' ? 'Admin' : 'Reporting Manager';
    await rejectLeaveRequest(leaveId, reviewerName, comment);
    setLeaveRequests(prev => prev.map(r => r.id === leaveId ? { ...r, status: 'Rejected', reviewerName, rejectionComment: comment, reviewedAt: new Date().toISOString() } : r));
    addToast('Leave request rejected', 0, 'debit');
  };

  const activeUserId = currentUser?.id ?? MOCK_USER_ID;

  const knownAnnouncementsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const loadAnnouncements = async (isPolling = false) => {
      try {
        const data = await announcementsApi.fetchAnnouncements(activeUserId);

        const unnotifiedPolicies = data.filter(ann => {
          if (ann.type !== 'Policy') return false;
          const notifiedKey = `policy_notified_${ann.id}`;
          if (localStorage.getItem(notifiedKey)) return false;

          if (isPolling) {
            return !knownAnnouncementsRef.current.has(ann.id);
          } else {
            return !ann.isRead && !knownAnnouncementsRef.current.has(ann.id);
          }
        });

        if (unnotifiedPolicies.length > 0) {
          const latest = unnotifiedPolicies[0];
          localStorage.setItem(`policy_notified_${latest.id}`, 'true');
          setPolicyNotification({ show: true, title: latest.title || 'New Policy' });
          setTimeout(() => {
            setPolicyNotification(prev => ({ ...prev, show: false }));
          }, 8000);
        }

        knownAnnouncementsRef.current = new Set(data.map(a => a.id));
        setAnnouncements(data);
      } catch (err) {
        console.error('Failed to load announcements:', err);
      }
    };
    loadAnnouncements();

    // Polling fallback every 10 seconds for real-time updates without WebSockets
    const pollInterval = setInterval(() => loadAnnouncements(true), 10000);

    // ── Realtime Subscription for New Announcements ──
    const channel = supabase.channel('public:announcements')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        (payload) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const newRow = payload.new as any;
          if (newRow.type === 'Policy') {
            const notifiedKey = `policy_notified_${newRow.id}`;
            if (!localStorage.getItem(notifiedKey)) {
              localStorage.setItem(notifiedKey, 'true');
              setPolicyNotification({ show: true, title: newRow.title || 'New Policy' });

              // Auto-dismiss toast after 5s
              setTimeout(() => {
                setPolicyNotification(prev => ({ ...prev, show: false }));
              }, 5000);
            }
          }

          // Refresh announcements to get the new one and increment bell badge
          loadAnnouncements();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [activeUserId]);

  const reactToAnnouncement = async (announcementId: string, emojiType: string) => {
    try {
      const updated = await announcementsApi.toggleReaction(announcementId, activeUserId, emojiType);
      setAnnouncements(updated);
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  const readAnnouncement = async (announcementId: string) => {
    try {
      const updated = await announcementsApi.markAsRead(announcementId, activeUserId);
      setAnnouncements(updated);
    } catch (err) {
      console.error('Failed to mark announcement as read:', err);
    }
  };

  const addAnnouncement = async (
    title: string,
    content: string,
    type: 'Standard' | 'Birthday' | 'Policy',
    authorRole?: 'HR' | 'Admin'
  ) => {
    try {
      const roleToUse = authorRole || (currentRole === 'HR' ? 'HR' : 'Admin');
      const updated = await announcementsApi.createAnnouncement(
        { title, content, type, author_role: roleToUse },
        activeUserId
      );
      setAnnouncements(updated);
      if (type === 'Policy') {
        addToast(`A new policy has been uploaded: "${title}"`, 0, 'credit');
      } else {
        addToast(`New announcement posted: "${title}"`, 0, 'credit');
      }
    } catch (err) {
      console.error('Failed to create announcement:', err);
    }
  };

  const CONSECUTIVE_LATE_PENALTY = 50; // Configurable flat penalty for 3+ consecutive late tasks

  const awardPointsForTask = async (task: Task) => {
    if (task.pointsProcessed) return null;
    if (!task.assigneeId) return null;

    const taskDueDate = new Date(`${task.dueDate}T23:59:59`);
    const completedOnTime = SIMULATED_TODAY <= taskDueDate;

    const ruleConfig = POINT_MATRIX[task.priority];

    let netPoints = 0;
    let reasonMessage = '';

    if (completedOnTime) {
      netPoints = ruleConfig.onTime;
      reasonMessage = `Task completed before due date (${task.priority.toUpperCase()} priority)`;
    } else {
      netPoints = ruleConfig.onTime - ruleConfig.missed;
      reasonMessage = `Task completed past due date (${task.priority.toUpperCase()} priority)`;

      const completionEntries = ledger.filter(l =>
        l.employeeId === task.assigneeId &&
        l.taskId !== undefined
      );

      if (completionEntries.length >= 2 &&
        completionEntries[0].reason.includes('past due date') &&
        completionEntries[1].reason.includes('past due date')) {
        netPoints -= CONSECUTIVE_LATE_PENALTY;
        reasonMessage += ` [STRIKE-3: Consecutive Late Penalty Applied]`;
      }
    }

    const pointsValue = Math.abs(netPoints);
    const pointType: 'credit' | 'debit' = netPoints >= 0 ? 'credit' : 'debit';

    const apiResult = await awardPoints(task.assigneeId, pointsValue, pointType, reasonMessage);
    if (!apiResult.success) {
      addToast(apiResult.error ?? 'Failed to award points', 0, 'debit');
      return null;
    }

    const newLedgerEntry: LedgerEntry = {
      id: `led-${Date.now()}-${task.id}`,
      taskId: task.id,
      taskTitle: task.title,
      points: pointsValue,
      type: pointType,
      reason: reasonMessage,
      timestamp: new Date().toISOString(),
      employeeId: task.assigneeId
    };

    // If the recipient is the currently logged-in user, reflect their new
    // balance immediately rather than waiting for a full employee refetch.
    if (currentUser && task.assigneeId === currentUser.id && apiResult.newBalance !== undefined) {
      setCurrentUser({ ...currentUser, variPoints: apiResult.newBalance });
    }

    return { newLedgerEntry, pointsValue, pointType, completedOnTime };
  };

  // Legacy Sync to localStorage for ledger

  useEffect(() => {
    localStorage.setItem('eopms_ledger_refactored', JSON.stringify(ledger));
  }, [ledger]);

  useEffect(() => {
    localStorage.setItem('eopms_role', currentRole);
  }, [currentRole]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('eopms_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('eopms_current_user');
    }
  }, [currentUser]);

  // Points Balance Calculation (Sum credits - Sum debits)
  // Let's set a base starting score of 1240 for Aarav
  const pointsBalance = currentUser?.variPoints ?? 0;
  // Toast Management
  const addToast = (message: string, points: number, type: 'credit' | 'debit') => {
    // eslint-disable-next-line react-hooks/purity
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: ToastMessage = { id, message, points, type };
    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      dismissToast(id);
    }, 4000);
  };

  const dismissToast = (toastId: string) => {
    // Add slide-out class or trigger state change. Here we just filter.
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  };

  // Kanban State Actions
  const moveTask = async (taskId: string, newStatus: TaskStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const oldStatus = task.status;

    if ((currentRole === 'Employee' || currentRole === 'Field Employee') && oldStatus === 'in_progress' && newStatus === 'awaiting_approval') {
      addToast('Error: Employees cannot manually submit tasks for approval. Complete all checklist items to auto-submit.', 0, 'debit');
      return;
    }

    let statusToSet = newStatus;
    if (statusToSet === 'done' && oldStatus !== 'awaiting_approval') {
      statusToSet = 'awaiting_approval';
    }

    let awardResult = null;
    if (statusToSet === 'done' && oldStatus !== 'done') {
      awardResult = await awardPointsForTask(task);
    }

    setTasks((prevTasks) => {
      const filtered = prevTasks.filter((t) => t.id !== taskId);
      const updatedTask = {
        ...task,
        status: statusToSet,
        pointsProcessed: awardResult ? true : task.pointsProcessed
      };

      if (statusToSet === 'in_progress') {
        return [updatedTask, ...filtered];
      } else {
        const originalIndex = prevTasks.findIndex((t) => t.id === taskId);
        filtered.splice(originalIndex, 0, updatedTask);
        return filtered;
      }
    });

    tasksApi.updateTaskStatus(taskId, statusToSet, awardResult ? true : task.pointsProcessed).catch(console.error);

    if (awardResult) {
      setLedger((prevLedger) => [awardResult.newLedgerEntry, ...prevLedger]);
      addToast(
        awardResult.completedOnTime
          ? `Approved: "${task.title}" (On-time)`
          : `Approved: "${task.title}" (Overdue)`,
        awardResult.pointsValue,
        awardResult.pointType
      );
    }
  };

  // Manager Approval (Restricted to Admin, HR, Reporting Manager)
  const approveTask = async (taskId: string) => {
    if (currentRole === 'Employee' || currentRole === 'Field Employee') {
      addToast('Error: Employees do not have permission to approve tasks.', 0, 'debit');
      return;
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const taskAssigneeDetails = mockEmployeeStore.find(e => e.id === task.assigneeId);
    if (currentRole === 'Reporting Manager' && taskAssigneeDetails?.reportingManagerId !== currentUser?.id) {
      addToast('Error: You can only approve tasks for your direct subordinates.', 0, 'debit');
      return;
    }

    if (task.status !== 'done') {
      const awardResult = await awardPointsForTask(task);

      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === taskId ? { ...t, status: 'done', pointsProcessed: awardResult ? true : t.pointsProcessed } : t
        )
      );
      tasksApi.updateTaskStatus(taskId, 'done', awardResult ? true : task.pointsProcessed).catch(console.error);

      if (awardResult) {
        setLedger((prevLedger) => [awardResult.newLedgerEntry, ...prevLedger]);
        addToast(
          awardResult.completedOnTime
            ? `Approved: "${task.title}" (On-time)`
            : `Approved: "${task.title}" (Overdue)`,
          awardResult.pointsValue,
          awardResult.pointType
        );
      }
    }
  };

  // Manager Rejection (Restricted to Admin, HR, Reporting Manager)
  const rejectTask = (taskId: string) => {
    if (currentRole === 'Employee' || currentRole === 'Field Employee') {
      addToast('Error: Employees do not have permission to reject tasks.', 0, 'debit');
      return;
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const taskAssigneeDetails = mockEmployeeStore.find(e => e.id === task.assigneeId);
    if (currentRole === 'Reporting Manager' && taskAssigneeDetails?.reportingManager !== MOCK_USER_ID) {
      addToast('Error: You can only reject tasks for your direct subordinates.', 0, 'debit');
      return;
    }

    setTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.id === taskId ? { ...t, status: 'in_progress' } : t
      )
    );
    tasksApi.updateTaskStatus(taskId, 'in_progress').catch(console.error);

    addToast(`Rejected: "${task.title}" returned to In Progress`, 0, 'debit');
  };

  const createTask = (title: string, description: string, dueDate: string, priority: TaskPriority, assigneeId: string, checkpoints?: string[]) => {
    // Determine assignee details from mock store, fallback to default
    const assigneeDetails = { name: 'Unknown', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60' };

    const checklistItems = checkpoints?.map((cp, idx) => ({
      id: `cp-${Date.now()}-${idx}`,
      text: cp,
      completed: false
    })) || [];

    const newTask: Task = {
      id: `task-${Date.now()}`,
      title,
      description,
      dueDate,
      priority,
      status: 'todo',
      assigneeId,
      assignee: assigneeDetails,
      checklist: checklistItems,
      comments: [],
      attachments: []
    };

    setTasks((prevTasks) => [newTask, ...prevTasks]);
    tasksApi.createTask(newTask).catch(console.error);
    addToast(`Task assigned: "${title}"`, 0, 'credit');

    // Dispatch real-time notification
    const channel = new BroadcastChannel('eopms_notifications');
    channel.postMessage({ type: 'TASK_ASSIGNED', taskId: newTask.id, title: newTask.title, assigneeId });
    channel.close();
  };

  const updateTaskDetails = (taskId: string, title: string, description: string, priority: TaskPriority, dueDate: string) => {
    setTasks((prevTasks) =>
      prevTasks.map((t) => (t.id === taskId ? { ...t, title, description, priority, dueDate } : t))
    );
    tasksApi.updateTaskDetails(taskId, title, description, priority, dueDate).catch(console.error);
  };

  const addComment = (taskId: string, text: string) => {
    setTasks((prevTasks) =>
      prevTasks.map((t) => {
        if (t.id !== taskId) return t;
        const newComment = {
          id: `comm-${Date.now()}`,
          text,
          author: 'sathvik',
          authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60',
          timestamp: new Date().toISOString()
        };
        const updatedComments = [...t.comments, newComment];
        tasksApi.updateTaskComments(taskId, updatedComments).catch(console.error);
        return {
          ...t,
          comments: updatedComments
        };
      })
    );
  };

  const toggleChecklistItem = (taskId: string, itemId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedChecklist = task.checklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );

    const hasChecklist = updatedChecklist.length > 0;
    const allCompleted = hasChecklist && updatedChecklist.every((item) => item.completed);

    let newStatus = task.status;
    let autoTransitioned = false;
    if ((task.status === 'in_progress' || task.status === 'todo') && allCompleted) {
      newStatus = 'awaiting_approval';
      autoTransitioned = true;
    }

    setTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.id === taskId ? { ...t, checklist: updatedChecklist, status: newStatus } : t
      )
    );
    tasksApi.updateTaskChecklist(taskId, updatedChecklist, newStatus).catch(console.error);

    if (autoTransitioned) {
      addToast(
        `Task "${task.title}" automatically submitted for approval (all checklist items completed)`,
        0,
        'credit'
      );
    }
  };

  const addChecklistItem = (taskId: string, text: string) => {
    setTasks((prevTasks) =>
      prevTasks.map((t) => {
        if (t.id !== taskId) return t;
        const newItem = {
          id: `c-${Date.now()}`,
          text,
          completed: false
        };
        const updatedChecklist = [...t.checklist, newItem];
        tasksApi.updateTaskChecklist(taskId, updatedChecklist).catch(console.error);
        return {
          ...t,
          checklist: updatedChecklist
        };
      })
    );
  };

  const addAttachment = (taskId: string, name: string, size: string, type: string) => {
    setTasks((prevTasks) =>
      prevTasks.map((t) => {
        if (t.id !== taskId) return t;
        const newAttachment = {
          id: `a-${Date.now()}`,
          name,
          size,
          type,
          url: '#'
        };
        const updatedAttachments = [...t.attachments, newAttachment];
        tasksApi.updateTaskAttachments(taskId, updatedAttachments).catch(console.error);
        return {
          ...t,
          attachments: updatedAttachments
        };
      })
    );
  };

  // Manual Administrative Transaction
  // Restricted to Admin and HR roles
  const assertAdministrativeTransaction = async (
    type: 'misconduct' | 'late_entry' | 'custom_debit' | 'custom_credit',
    reason: string,
    customPoints?: number,
    employeeId?: string,
    isAutomated?: boolean
   ) => {
    if (!isAutomated && currentRole !== 'Admin' && currentRole !== 'HR') {
      addToast('Access Denied: Only Admin and HR can manually process points.', 0, 'debit');
      return;
    }
    if (!employeeId) return;

    const isMisconduct = type === 'misconduct';
    const isLateEntry = type === 'late_entry';
    const isCredit = type === 'custom_credit';
    const pointsAmount = isMisconduct ? 50 : (isLateEntry ? 25 : (customPoints || 0));

    let ruleTitle = 'Custom Transaction';
    if (isMisconduct) ruleTitle = 'Office Misconduct Penalty';
    if (isLateEntry) ruleTitle = 'Late Entry Penalty';
    if (type === 'custom_debit') ruleTitle = 'Custom Penalty';
    if (isCredit) ruleTitle = 'Custom Credit';

    const transactionType: 'credit' | 'debit' = isCredit ? 'credit' : 'debit';

    const apiResult = await awardPoints(employeeId, pointsAmount, transactionType, `${ruleTitle}: ${reason}`);
    if (!apiResult.success) {
      addToast(apiResult.error ?? 'Failed to process points', 0, 'debit');
      return;
    }

    const newLedgerEntry: LedgerEntry = {
      id: `led-admin-${Date.now()}`,
      taskTitle: ruleTitle,
      points: pointsAmount,
      type: transactionType,
      reason: reason,
      timestamp: new Date().toISOString(),
      employeeId
    };

    setLedger((prevLedger) => [newLedgerEntry, ...prevLedger]);
    addToast(`${ruleTitle} applied: "${reason}"`, pointsAmount, transactionType);

    const emp = mockEmployeeStore.find(e => e.id === employeeId);
    if (emp && apiResult.newBalance !== undefined) {
      emp.variPoints = apiResult.newBalance;
    }
    if (currentUser && employeeId === currentUser.id && apiResult.newBalance !== undefined) {
      setCurrentUser({ ...currentUser, variPoints: apiResult.newBalance });
    }
  };

  return (
    <EopmsContext.Provider
      value={{
        tasks,
        ledger,
        toasts,
        pointsBalance,
        currentRole,
        setCurrentRole,
        currentUser,
        setCurrentUser,
        moveTask,
        approveTask,
        rejectTask,
        createTask,
        updateTaskDetails,
        addComment,
        toggleChecklistItem,
        addChecklistItem,
        addAttachment,
        assertAdministrativeTransaction,
        addToast,
        dismissToast,
        announcements,
        reactToAnnouncement,
        readAnnouncement,
        addAnnouncement,
        leaveRequests,
        leaveBalance,
        submitLeave,
        approveLeave,
        rejectLeave,
        policyNotification,
        setPolicyNotification
      }}
    >
      {children}
    </EopmsContext.Provider>
  );
};
