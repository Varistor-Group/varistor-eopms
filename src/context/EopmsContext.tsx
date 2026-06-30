import React, { createContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Task, LedgerEntry, ToastMessage, TaskStatus, UserRole, TaskPriority, AnnouncementDTO } from '../types';
import { announcementsApi } from '../api/announcements';

// Let's set a fixed "today" date for simulated business rule checks (2026-06-30)
const SIMULATED_TODAY = new Date('2026-06-30T12:00:00');

interface EopmsContextType {
  tasks: Task[];
  ledger: LedgerEntry[];
  toasts: ToastMessage[];
  pointsBalance: number;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  
  // Kanban Actions
  moveTask: (taskId: string, newStatus: TaskStatus) => void;
  approveTask: (taskId: string) => void;
  rejectTask: (taskId: string) => void;
  updateTaskDetails: (taskId: string, updates: Partial<Task>) => void;
  addComment: (taskId: string, text: string) => void;
  toggleChecklistItem: (taskId: string, itemId: string) => void;
  addChecklistItem: (taskId: string, text: string) => void;
  addAttachment: (taskId: string, name: string, size: string, type: string) => void;
  
  // Points System Actions
  assertAdministrativePenalty: (type: 'misconduct' | 'late_entry' | 'custom', reason: string, customPoints?: number) => void;
  addToast: (message: string, points: number, type: 'credit' | 'debit') => void;
  dismissToast: (toastId: string) => void;
  announcements: AnnouncementDTO[];
  reactToAnnouncement: (announcementId: string, emojiType: string) => void;
  readAnnouncement: (announcementId: string) => void;
  addAnnouncement: (title: string, content: string, type: 'Standard' | 'Birthday' | 'Policy', authorRole?: 'HR' | 'Admin') => void;
}

export const EopmsContext = createContext<EopmsContextType | undefined>(undefined);

// Priority configuration matrix
const POINT_MATRIX: Record<TaskPriority, { onTime: number; missed: number; weight: number }> = {
  critical: { onTime: 100, missed: 200, weight: 4 },
  high: { onTime: 75, missed: 125, weight: 3 },
  medium: { onTime: 50, missed: 75, weight: 2 },
  low: { onTime: 25, missed: 30, weight: 1 }
};

const initialTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Client demo deck',
    description: 'Prepare the client demonstration deck for the upcoming product review. Ensure styling matches the client guidelines and includes the latest user statistics.',
    dueDate: '2026-06-30',
    priority: 'critical', // Changed to critical to demonstrate new priority
    status: 'todo',
    assignee: { name: 'Aarav Patel', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60' },
    checklist: [
      { id: 'c1', text: 'Gather feedback from marketing', completed: false },
      { id: 'c2', text: 'Format financial graphs and charts', completed: true },
      { id: 'c3', text: 'Update partner logo in slide master', completed: false }
    ],
    comments: [
      { id: 'comm-1', text: 'Please make sure to focus on the performance metrics slide.', author: 'Priya Sharma (COO)', authorAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&fit=crop&q=60', timestamp: '2026-06-29T14:30:00Z' }
    ],
    attachments: [
      { id: 'a1', name: 'demo_template_v1.pptx', size: '2.4 MB', type: 'presentation', url: '#' }
    ]
  },
  {
    id: 'task-2',
    title: 'Inventory reconciliation',
    description: 'Perform a full audit on warehouse inventories. Cross-check log files with inventory database records and report any discrepancy exceeding 1%.',
    dueDate: '2026-07-02',
    priority: 'medium',
    status: 'todo',
    assignee: { name: 'Aarav Patel', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60' },
    checklist: [
      { id: 'c4', text: 'Count warehouse box items in Zone A', completed: false },
      { id: 'c5', text: 'Verify log entries with manager approvals', completed: false }
    ],
    comments: [],
    attachments: []
  },
  {
    id: 'task-3',
    title: 'Vendor onboarding',
    description: 'Finalize agreements and terms with external logistics vendor. Upload onboarding certificates to document vault once finished.',
    dueDate: '2026-06-28', // Past due date!
    priority: 'medium',
    status: 'in_progress',
    assignee: { name: 'Aarav Patel', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60' },
    checklist: [
      { id: 'c6', text: 'Collect signed agreements', completed: true },
      { id: 'c7', text: 'Request company certificate', completed: false }
    ],
    comments: [
      { id: 'comm-2', text: 'Vendor is asking for a grace period on the SLA terms.', author: 'Aarav Patel', authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60', timestamp: '2026-06-28T09:15:00Z' }
    ],
    attachments: []
  },
  {
    id: 'task-4',
    title: 'Client report v2',
    description: 'Review and compile feedback for the client report release. Must align all formatting, metrics tables, and obtain management signoff.',
    dueDate: '2026-06-28', // Past due date!
    priority: 'high',
    status: 'awaiting_approval',
    assignee: { name: 'Aarav Patel', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60' },
    checklist: [
      { id: 'c8', text: 'Review formatting checklist', completed: true },
      { id: 'c9', text: 'Obtain initial draft feedback from team leads', completed: true }
    ],
    comments: [
      { id: 'comm-3', text: 'Ready for COO review and approval.', author: 'Aarav Patel', authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60', timestamp: '2026-06-29T17:40:00Z' }
    ],
    attachments: [
      { id: 'a2', name: 'client_report_draft_v2.pdf', size: '1.8 MB', type: 'pdf', url: '#' }
    ]
  },
  {
    id: 'task-5',
    title: 'Vendor follow-up',
    description: 'Follow up on the logistics delivery schedules for next month. Send weekly progress tables to management.',
    dueDate: '2026-07-05',
    priority: 'low',
    status: 'todo',
    assignee: { name: 'Aarav Patel', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60' },
    checklist: [],
    comments: [],
    attachments: []
  },
  {
    id: 'task-6',
    title: 'Prepare Q3 sales pitch',
    description: 'Design the core slide outline for Q3 corporate services expansion pitch. Key focuses are pricing grids and vendor SLAs.',
    dueDate: '2026-06-28', // Past due date!
    priority: 'high',
    status: 'todo',
    assignee: { name: 'Aarav Patel', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60' },
    checklist: [],
    comments: [],
    attachments: []
  },
  {
    id: 'task-7',
    title: 'Checklist Bug Test Task',
    description: 'Use this task to verify the checkbox visual state sync. Open this task in the detail drawer, click on checkboxes, and confirm the checkbox visually changes immediately.',
    dueDate: '2026-07-04',
    priority: 'medium',
    status: 'todo',
    assignee: { name: 'Aarav Patel', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60' },
    checklist: [
      { id: 'c10', text: 'Toggle this item and verify visual checkbox update', completed: false },
      { id: 'c11', text: 'Another checklist item to test toggle behavior', completed: false }
    ],
    comments: [],
    attachments: []
  },
  {
    id: 'task-8',
    title: 'Drag and Drop Order Test',
    description: 'Drag this task from TO DO and drop it into IN PROGRESS. It should automatically jump to the top of the In Progress column.',
    dueDate: '2026-07-06',
    priority: 'low',
    status: 'todo',
    assignee: { name: 'Aarav Patel', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60' },
    checklist: [],
    comments: [],
    attachments: []
  }
];

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
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('eopms_tasks_refactored');
    return saved ? JSON.parse(saved) : initialTasks;
  });

  const [ledger, setLedger] = useState<LedgerEntry[]>(() => {
    const saved = localStorage.getItem('eopms_ledger_refactored');
    return saved ? JSON.parse(saved) : initialLedger;
  });

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const saved = localStorage.getItem('eopms_role');
    return (saved as UserRole) || 'Admin'; // Default role is Admin
  });

  const MOCK_USER_ID = 'user-aarav';
  const [announcements, setAnnouncements] = useState<AnnouncementDTO[]>([]);

  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        const data = await announcementsApi.fetchAnnouncements(MOCK_USER_ID);
        setAnnouncements(data);
      } catch (err) {
        console.error('Failed to load announcements:', err);
      }
    };
    loadAnnouncements();
  }, []);

  const reactToAnnouncement = async (announcementId: string, emojiType: string) => {
    try {
      const updated = await announcementsApi.toggleReaction(announcementId, MOCK_USER_ID, emojiType);
      setAnnouncements(updated);
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  const readAnnouncement = async (announcementId: string) => {
    try {
      const updated = await announcementsApi.markAsRead(announcementId, MOCK_USER_ID);
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
        MOCK_USER_ID
      );
      setAnnouncements(updated);
      addToast(`New announcement posted: "${title}"`, 0, 'credit');
    } catch (err) {
      console.error('Failed to create announcement:', err);
    }
  };

  const awardPointsForTask = (task: Task) => {
    if (task.pointsProcessed) return null;

    const taskDueDate = new Date(`${task.dueDate}T23:59:59`);
    const completedOnTime = SIMULATED_TODAY <= taskDueDate;
    
    const ruleConfig = POINT_MATRIX[task.priority];
    const pointsValue = completedOnTime ? ruleConfig.onTime : ruleConfig.missed;
    const pointType: 'credit' | 'debit' = completedOnTime ? 'credit' : 'debit';
    
    const reasonMessage = completedOnTime 
      ? `Task completed before due date` 
      : `Task completed past due date`;

    const newLedgerEntry: LedgerEntry = {
      id: `led-${Date.now()}-${task.id}`,
      taskId: task.id,
      taskTitle: task.title,
      points: pointsValue,
      type: pointType,
      reason: `${reasonMessage} (${task.priority.toUpperCase()} priority)`,
      timestamp: new Date().toISOString()
    };

    return { newLedgerEntry, pointsValue, pointType, completedOnTime };
  };

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('eopms_tasks_refactored', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('eopms_ledger_refactored', JSON.stringify(ledger));
  }, [ledger]);

  useEffect(() => {
    localStorage.setItem('eopms_role', currentRole);
  }, [currentRole]);

  // Points Balance Calculation (Sum credits - Sum debits)
  // Let's set a base starting score of 1240 for Aarav
  const pointsBalance = 1190 + ledger.reduce((acc, curr) => {
    return curr.type === 'credit' ? acc + curr.points : acc - curr.points;
  }, 0);

  // Toast Management
  const addToast = (message: string, points: number, type: 'credit' | 'debit') => {
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
  const moveTask = (taskId: string, newStatus: TaskStatus) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const oldStatus = task.status;

    // Block employee manually moving tasks from in_progress to awaiting_approval
    if (currentRole === 'Employee' && oldStatus === 'in_progress' && newStatus === 'awaiting_approval') {
      addToast('Error: Employees cannot manually submit tasks for approval. Complete all checklist items to auto-submit.', 0, 'debit');
      return;
    }

    // Prevent manual moving to 'done' without approval
    let statusToSet = newStatus;
    if (statusToSet === 'done' && oldStatus !== 'awaiting_approval') {
      statusToSet = 'awaiting_approval';
    }

    let awardResult = null;
    if (statusToSet === 'done' && oldStatus !== 'done') {
      awardResult = awardPointsForTask(task);
    }

    setTasks((prevTasks) => {
      const filtered = prevTasks.filter((t) => t.id !== taskId);
      const updatedTask = { 
        ...task, 
        status: statusToSet, 
        pointsProcessed: awardResult ? true : task.pointsProcessed 
      };

      if (statusToSet === 'in_progress') {
        // Prepend task when transitioning/dropped into IN PROGRESS
        return [updatedTask, ...filtered];
      } else {
        // Maintain original position for other transitions
        const originalIndex = prevTasks.findIndex((t) => t.id === taskId);
        filtered.splice(originalIndex, 0, updatedTask);
        return filtered;
      }
    });

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
  const approveTask = (taskId: string) => {
    if (currentRole === 'Employee') {
      addToast('Error: Employees do not have permission to approve tasks.', 0, 'debit');
      return;
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    if (task.status !== 'done') {
      const awardResult = awardPointsForTask(task);

      setTasks((prevTasks) =>
        prevTasks.map((t) =>
          t.id === taskId ? { ...t, status: 'done', pointsProcessed: awardResult ? true : t.pointsProcessed } : t
        )
      );

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
    if (currentRole === 'Employee') {
      addToast('Error: Employees do not have permission to reject tasks.', 0, 'debit');
      return;
    }

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    setTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.id === taskId ? { ...t, status: 'in_progress' } : t
      )
    );

    addToast(`Rejected: "${task.title}" returned to In Progress`, 0, 'debit');
  };

  const updateTaskDetails = (taskId: string, updates: Partial<Task>) => {
    setTasks((prevTasks) =>
      prevTasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );
  };

  const addComment = (taskId: string, text: string) => {
    setTasks((prevTasks) =>
      prevTasks.map((t) => {
        if (t.id !== taskId) return t;
        const newComment = {
          id: `comm-${Date.now()}`,
          text,
          author: 'Aarav Patel',
          authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60',
          timestamp: new Date().toISOString()
        };
        return {
          ...t,
          comments: [...t.comments, newComment]
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
    if (task.status === 'in_progress' && allCompleted) {
      newStatus = 'awaiting_approval';
      autoTransitioned = true;
    }

    setTasks((prevTasks) =>
      prevTasks.map((t) =>
        t.id === taskId ? { ...t, checklist: updatedChecklist, status: newStatus } : t
      )
    );

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
        return {
          ...t,
          checklist: [...t.checklist, newItem]
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
        return {
          ...t,
          attachments: [...t.attachments, newAttachment]
        };
      })
    );
  };

  // Manual Administrative Penalty (Office Misconduct: -50, Late Entry: -25)
  // Restricted to Admin and HR roles
  const assertAdministrativePenalty = (type: 'misconduct' | 'late_entry' | 'custom', reason: string, customPoints?: number) => {
    if (currentRole !== 'Admin' && currentRole !== 'HR') {
      addToast('Access Denied: Only Admin and HR can manually debit points.', 0, 'debit');
      return;
    }

    const isMisconduct = type === 'misconduct';
    const isLateEntry = type === 'late_entry';
    const penaltyPoints = isMisconduct ? 50 : (isLateEntry ? 25 : (customPoints || 0));
    const ruleTitle = isMisconduct ? 'Office Misconduct Penalty' : (isLateEntry ? 'Late Entry Penalty' : 'Custom Penalty');

    const newLedgerEntry: LedgerEntry = {
      id: `led-admin-${Date.now()}`,
      taskTitle: ruleTitle,
      points: penaltyPoints,
      type: 'debit',
      reason: reason,
      timestamp: new Date().toISOString()
    };
    
    setLedger((prevLedger) => [newLedgerEntry, ...prevLedger]);
    addToast(`${ruleTitle} applied: "${reason}"`, penaltyPoints, 'debit');
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
        moveTask,
        approveTask,
        rejectTask,
        updateTaskDetails,
        addComment,
        toggleChecklistItem,
        addChecklistItem,
        addAttachment,
        assertAdministrativePenalty,
        addToast,
        dismissToast,
        announcements,
        reactToAnnouncement,
        readAnnouncement,
        addAnnouncement
      }}
    >
      {children}
    </EopmsContext.Provider>
  );
};
