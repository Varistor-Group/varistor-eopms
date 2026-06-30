import React, { useState } from 'react';
import { 
  DndContext, 
  useDraggable, 
  useDroppable, 
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, Check, FileText, CheckSquare, X } from 'lucide-react';
import { useKanbanTasks } from '../hooks/useKanbanTasks';
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

  return (
    <div 
      ref={setNodeRef}
      className={`flex-1 min-w-[280px] bg-[#f8faf7] border border-varistor-border rounded-varistor p-4 flex flex-col h-[calc(100vh-200px)] min-h-[500px] transition-all duration-200 ${
        isOver ? 'bg-[#f4f7f2] border-varistor-lime border-dashed border-2' : ''
      }`}
    >
      {/* Column Header */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h3 className="text-sm font-bold text-varistor-dark uppercase tracking-wider">{title}</h3>
        <span className="text-xs font-bold bg-[#edf0ec] px-2 py-0.5 rounded-full text-varistor-dark">
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
            onApprove={id === 'awaiting_approval' && currentRole !== 'Employee' ? () => approveTask(task.id) : undefined}
            onReject={id === 'awaiting_approval' && currentRole !== 'Employee' ? () => rejectTask(task.id) : undefined}
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
      }`}
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
        <div className="flex items-center gap-1 text-[10px] text-[#555a52] bg-[#f1f3f0] px-2 py-0.5 rounded-full">
          <Calendar size={11} className="text-[#888]" />
          <span>{new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
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
  const { tasks, moveTask } = useKanbanTasks();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Set up DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Allow regular clicks to open drawer without dragging instantly
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const targetStatus = over.id as TaskStatus;

    // Do not allow dragging to 'done' directly (requires clicking Approve in awaiting_approval column)
    if (targetStatus === 'done') return;

    moveTask(taskId, targetStatus);
  };

  // Group tasks by active statuses for Kanban Columns
  const todoTasks = tasks.filter(t => t.status === 'todo');
  const progressTasks = tasks.filter(t => t.status === 'in_progress');
  const approvalTasks = tasks.filter(t => t.status === 'awaiting_approval');

  return (
    <div className="space-y-6">
      {/* Board Description */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-varistor-dark">Task Board</h1>
          <p className="text-xs text-varistor-muted mt-0.5">Drag tasks across columns or approve completions to adjust Vari Points.</p>
        </div>
      </div>

      {/* DnD Context */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
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
      </DndContext>

      {/* Details Slide-out Drawer */}
      <TaskDrawer 
        task={selectedTask} 
        onClose={() => setSelectedTask(null)} 
      />
    </div>
  );
};
