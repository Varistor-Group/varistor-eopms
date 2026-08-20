import React, { useState, useEffect } from 'react';
import { 
  DndContext, 
  useDraggable, 
  useDroppable, 
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, Check, FileText, CheckSquare, X } from 'lucide-react';
import { useKanbanTasks } from '../hooks/useKanbanTasks';
import { getEmployees, type Employee } from '../api/employees';
import type { Task, TaskStatus, TaskPriority } from '../types';
import { TaskDrawer } from './TaskDrawer';

interface ColumnProps {
  id: TaskStatus;
  title: string;
  tasks: Task[];
  onCardClick: (task: Task) => void;
}

// Droppable Column Component
const KanbanColumn: React.FC<ColumnProps> = ({ id, title, tasks, onCardClick }) => {
  const { isOver, setNodeRef } = useDroppable({ id });
  const { approveTask, rejectTask, currentRole } = useKanbanTasks();
  const canModerate = currentRole !== 'Employee' && currentRole !== 'Field Employee';

  return (
    <div 
      ref={setNodeRef}
      className={`flex-1 min-w-[280px] bg-varistor-pageBg border border-varistor-border rounded-varistor p-4 flex flex-col h-[calc(100vh-200px)] min-h-[500px] transition-all duration-200 ${
        isOver ? 'bg-varistor-pageBg border-varistor-lime border-dashed border-2' : ''
      }`}
    >
      {/* Column Header */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h3 className="text-sm font-bold text-varistor-dark uppercase tracking-wider">{title}</h3>
        <span className="text-xs font-bold bg-varistor-pageBg px-2 py-0.5 rounded-full text-varistor-dark">
          {tasks.length}
        </span>
      </div>

      {/* Cards List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {tasks.map((task) => (
          <KanbanCard 
            key={task.id} 
            task={task} 
            onClick={() => onCardClick(task)}
            onApprove={id === 'awaiting_approval' && canModerate ? () => approveTask(task.id) : undefined}
            onReject={id === 'awaiting_approval' && canModerate ? () => rejectTask(task.id) : undefined}
          />
        ))}

        {/* Empty State */}
        {tasks.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center border border-dashed border-[#d8ded2] rounded-lg p-6 bg-white bg-opacity-40 select-none">
            <svg 
              className="w-12 h-12 text-[#b0b8a7] mb-2" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth={1.2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <p className="text-xs text-varistor-muted font-semibold">Drop tasks here</p>
          </div>
        )}

        {/* Drag Over Active Placeholder */}
        {isOver && (
          <div className="border-2 border-dashed border-varistor-lime rounded-lg p-5 h-24 bg-varistor-limeLight bg-opacity-20 flex items-center justify-center">
            <span className="text-xs text-varistor-limeText font-bold">Release to drop task</span>
          </div>
        )}
      </div>
    </div>
  );
};

interface CardProps {
  task: Task;
  onClick: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}

// Draggable Card Component
const KanbanCard: React.FC<CardProps> = ({ task, onClick, onApprove, onReject }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style: React.CSSProperties = transform ? {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 999 : 1,
  } : {};

  const getPriorityDot = (priority: TaskPriority) => {
    switch (priority) {
      case 'critical': return 'bg-red-700 animate-pulse';
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-amber-400';
      case 'low': return 'bg-varistor-lime';
      default: return 'bg-gray-300';
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // If user clicked any interactive item (buttons, links), do not open drawer
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    onClick();
  };

  // Checklist stats
  const completedChecklist = task.checklist.filter(c => c.completed).length;
  const totalChecklist = task.checklist.length;

  // A task is overdue if its due date has passed and it hasn't been completed —
  // matches the same condition the backend's overdue-sweep job uses for emails.
  const isOverdue = task.status !== 'done' && new Date(task.dueDate + 'T23:59:59') < new Date();

  const getPointsText = (priority: TaskPriority) => {
    switch (priority) {
      case 'critical': return '+100';
      case 'high': return '+75';
      case 'medium': return '+50';
      case 'low': return '+25';
      default: return '+0';
    }
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-white rounded-lg border border-varistor-border p-4 shadow-varistor hover:shadow-md cursor-grab active:cursor-grabbing select-none transition-varistor group relative ${
        isDragging ? 'shadow-lg border-varistor-lime border-2' : ''
      } ${isOverdue ? 'border-l-4 border-l-red-500' : ''}`}
      onClick={handleCardClick}
    >
      {/* Top row: Priority & Points */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${getPriorityDot(task.priority)}`} />
          <span className="text-[10px] text-varistor-muted font-bold capitalize">{task.priority}</span>
        </div>
        <span className="text-[10px] font-bold text-varistor-limeText bg-varistor-limeLight border border-varistor-successBorder px-1.5 py-0.5 rounded">
          {getPointsText(task.priority)} VP
        </span>
      </div>

      {/* Task Title */}
      <h4 className="text-xs font-bold text-varistor-dark leading-snug group-hover:text-black mb-3 pr-2">
        {task.title}
      </h4>

      {/* Task description preview */}
      <p className="text-[11px] text-varistor-muted truncate mb-3">{task.description}</p>

      {/* Bottom checklist/files indicators */}
      <div className="flex items-center gap-3 text-[10px] text-varistor-muted mb-3.5">
        {totalChecklist > 0 && (
          <span className="flex items-center gap-1">
            <CheckSquare size={12} />
            {completedChecklist}/{totalChecklist}
          </span>
        )}
        {task.attachments.length > 0 && (
          <span className="flex items-center gap-1">
            <FileText size={12} />
            {task.attachments.length}
          </span>
        )}
      </div>

      {/* Card Footer: Date chip and Avatar */}
      <div className="flex justify-between items-center pt-3 border-t border-[#f1f3f0]">
        <div className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
          isOverdue ? 'text-red-700 bg-red-50 font-bold' : 'text-[#555a52] bg-varistor-pageBg'
        }`}>
          <Calendar size={11} className={isOverdue ? 'text-red-600' : 'text-[#888]'} />
          <span>{new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          {isOverdue && <span className="uppercase tracking-wide">· Overdue</span>}
        </div>
        
        <img 
          src={task.assignee.avatarUrl} 
          alt={task.assignee.name} 
          className="w-5 h-5 rounded-full object-cover border border-varistor-border"
          title={task.assignee.name}
        />
      </div>

      {/* Manager Actions (Approve/Reject buttons inline in Awaiting Approval column) */}
      {onApprove && onReject && (
        <div className="mt-3.5 pt-3 border-t border-[#f1f3f0] flex gap-2 w-full">
          <button
            onClick={onApprove}
            className="flex-1 bg-varistor-lime text-black py-1.5 rounded-lg text-[10px] font-bold hover:bg-[#7bc012] transition-colors flex items-center justify-center gap-1"
          >
            <Check size={12} strokeWidth={2.5} />
            Approve
          </button>
          <button
            onClick={onReject}
            className="flex-1 bg-red-50 text-red-700 border border-red-200 py-1.5 rounded-lg text-[10px] font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
          >
            <X size={12} strokeWidth={2.5} />
            Reject
          </button>
        </div>
      )}
    </div>
  );
};

export const KanbanBoard: React.FC = () => {
  const { tasks, moveTask, currentRole, currentUser, requestTask, cancelTaskRequest } = useKanbanTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);

  const canRequestTask = currentRole === 'Employee' || currentRole === 'Field Employee';
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reqTitle, setReqTitle] = useState('');
  const [reqDescription, setReqDescription] = useState('');
  const [reqDueDate, setReqDueDate] = useState('');
  const [reqPriority, setReqPriority] = useState<TaskPriority>('medium');
  const [reqNotes, setReqNotes] = useState('');

  const myPendingRequests = tasks.filter(t => t.status === 'pending_review' && t.assigneeId === currentUser?.id);

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle || !reqDescription || !reqDueDate) return;
    requestTask(reqTitle, reqDescription, reqDueDate, reqPriority, reqNotes);
    setReqTitle('');
    setReqDescription('');
    setReqDueDate('');
    setReqPriority('medium');
    setReqNotes('');
    setShowRequestForm(false);
  };

  useEffect(() => {
    if (currentRole === 'Reporting Manager') {
      getEmployees().then(setAllEmployees);
    }
  }, [currentRole]);

  // Employees/Field Employees: only their own tasks.
  // Reporting Managers: only tasks assigned to their direct reports.
  // HR/Admin: everyone's tasks.
 const visibleTasks = (() => {
    if (currentRole === 'Employee' || currentRole === 'Field Employee') {
      return tasks.filter(t => t.assigneeId === currentUser?.id);
    }
    if (currentRole === 'Reporting Manager') {
      const subordinateIds = new Set(
        allEmployees.filter(e => e.reportingManagerId === currentUser?.id).map(e => e.id)
      );
      return tasks.filter(t => 
        t.assigneeId && (t.assigneeId === currentUser?.id || subordinateIds.has(t.assigneeId))
      );
    }
    return tasks; // HR / Admin
  })();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const targetStatus = over.id as TaskStatus;
    
    const task = visibleTasks.find(t => t.id === taskId);
    if (!task) return;

    if (targetStatus === 'done') return;
    if (task.status === 'todo' && targetStatus === 'awaiting_approval') {
      return;
    }

    moveTask(taskId, targetStatus);
  };

  const todoTasks = visibleTasks.filter(t => t.status === 'todo');
  const progressTasks = visibleTasks.filter(t => t.status === 'in_progress');
  const approvalTasks = visibleTasks.filter(t => t.status === 'awaiting_approval');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-varistor-dark">Task Board</h1>
          <p className="text-xs text-varistor-muted mt-0.5">Drag tasks across columns or approve completions to adjust Vari Points.</p>
        </div>
        {canRequestTask && (
          <button
            onClick={() => setShowRequestForm(!showRequestForm)}
            className="bg-varistor-lime text-varistor-dark font-bold text-xs px-4 py-2 rounded-full hover:brightness-105 transition-all cursor-pointer"
          >
            {showRequestForm ? 'Cancel' : '+ Request a Task'}
          </button>
        )}
      </div>

      {canRequestTask && showRequestForm && (
        <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-6">
          <h2 className="text-sm font-bold text-varistor-dark mb-4">Request a New Task</h2>
          <p className="text-xs text-varistor-muted -mt-3 mb-4">Your manager will review this before it becomes an active task.</p>
          <form onSubmit={handleSubmitRequest} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-varistor-dark block mb-1.5">Task Title</label>
                <input type="text" value={reqTitle} onChange={(e) => setReqTitle(e.target.value)} required className="w-full border border-varistor-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-varistor-lime bg-varistor-pageBg text-varistor-dark" />
              </div>
              <div>
                <label className="text-xs font-semibold text-varistor-dark block mb-1.5">Priority</label>
                <select value={reqPriority} onChange={(e) => setReqPriority(e.target.value as TaskPriority)} required className="w-full border border-varistor-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-varistor-lime bg-varistor-pageBg text-varistor-dark">
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-varistor-dark block mb-1.5">Description</label>
                <textarea value={reqDescription} onChange={(e) => setReqDescription(e.target.value)} required rows={3} className="w-full border border-varistor-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-varistor-lime bg-varistor-pageBg text-varistor-dark" />
              </div>
              <div>
                <label className="text-xs font-semibold text-varistor-dark block mb-1.5">Due Date</label>
                <input type="date" value={reqDueDate} onChange={(e) => setReqDueDate(e.target.value)} required className="w-full border border-varistor-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-varistor-lime bg-varistor-pageBg text-varistor-dark" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-semibold text-varistor-dark block mb-1.5">Notes for your manager (optional)</label>
                <textarea value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} rows={2} placeholder="Any context that helps your manager review this request..." className="w-full border border-varistor-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-varistor-lime bg-varistor-pageBg text-varistor-dark" />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" className="bg-varistor-lime text-varistor-dark font-bold text-sm px-6 py-2 rounded-full hover:brightness-105 transition-all">Send Request</button>
            </div>
          </form>
        </div>
      )}

      {canRequestTask && myPendingRequests.length > 0 && (
        <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-6">
          <h2 className="text-sm font-bold text-varistor-dark mb-4">Your Task Requests ({myPendingRequests.length})</h2>
          <div className="space-y-3">
            {myPendingRequests.map(t => (
              <div key={t.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 border border-[#f1f3f0] rounded-lg gap-3 bg-varistor-pageBg">
                <div>
                  <h3 className="font-bold text-xs text-varistor-dark">{t.title}</h3>
                  <p className="text-[10px] text-varistor-muted mt-1">{t.description}</p>
                  <div className="mt-2 flex items-center gap-2 text-[10px]">
                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase">Pending Manager Review</span>
                    <span className="text-varistor-muted">Due: {new Date(t.dueDate).toLocaleDateString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => cancelTaskRequest(t.id)}
                  className="text-[10px] text-red-600 hover:text-red-800 font-semibold shrink-0 bg-red-50 border border-red-100 px-3 py-1.5 rounded-full"
                >
                  Cancel Request
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          <KanbanColumn 
            id="todo" 
            title="To Do" 
            tasks={todoTasks} 
            onCardClick={setSelectedTask}
          />
          <KanbanColumn 
            id="in_progress" 
            title="In Progress" 
            tasks={progressTasks} 
            onCardClick={setSelectedTask}
          />
          <KanbanColumn 
            id="awaiting_approval" 
            title="Awaiting Approval" 
            tasks={approvalTasks} 
            onCardClick={setSelectedTask}
          />
        </div>
        <DragOverlay>
          {activeId ? (
            <KanbanCard 
              task={visibleTasks.find(t => t.id === activeId)!} 
              onClick={() => {}} 
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskDrawer 
        task={selectedTask ? visibleTasks.find(t => t.id === selectedTask.id) || null : null} 
        onClose={() => setSelectedTask(null)} 
      />
    </div>
  );
};
