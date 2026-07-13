import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { useKanbanTasks } from '../hooks/useKanbanTasks';
import type { TaskPriority } from '../types';

export const TaskSummary: React.FC = () => {
  const { tasks, moveTask } = useKanbanTasks();

  // Active tasks (not done)
  const activeTasks = tasks.filter(t => t.status !== 'done');

  const getPriorityStyles = (priority: TaskPriority) => {
    switch (priority) {
      case 'high':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'low':
        return 'bg-varistor-limeLight text-varistor-limeText border-varistor-successBorder';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const handleCheckboxClick = (taskId: string, currentStatus: string) => {
    if (currentStatus === 'todo') {
      moveTask(taskId, 'in_progress');
    } else if (currentStatus === 'in_progress') {
      moveTask(taskId, 'awaiting_approval');
    }
  };

  return (
    <div 
      onClick={() => window.dispatchEvent(new CustomEvent('navigateTab', { detail: 'kanban' }))}
      className="bg-white rounded-varistor border border-varistor-border p-5 shadow-varistor flex flex-col h-[280px] transition-varistor hover:shadow-md cursor-pointer"
    >
      <div className="flex justify-between items-center pb-2 border-b border-[#edf0ec] mb-3">
        <h3 className="text-sm font-semibold text-varistor-dark">Today's tasks</h3>
        <span className="text-xs font-bold text-varistor-limeText bg-varistor-limeLight px-2 py-0.5 rounded-full">
          {activeTasks.length} active
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {activeTasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-6">
            <CheckCircle2 size={28} className="text-varistor-lime mb-2" />
            <p className="text-xs text-varistor-muted font-medium">All caught up! No active tasks.</p>
          </div>
        ) : (
          activeTasks.map((task) => (
            <div 
              key={task.id} 
              className="flex items-center justify-between p-3 border border-[#edf0ec] rounded-lg bg-varistor-pageBg hover:bg-white hover:border-[#d2d8ce] transition-varistor group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => handleCheckboxClick(task.id, task.status)}
                  className="text-varistor-muted hover:text-varistor-lime flex-shrink-0 transition-colors"
                  title={
                    task.status === 'todo' 
                      ? 'Start task' 
                      : task.status === 'in_progress' 
                        ? 'Submit for approval' 
                        : 'Awaiting manager approval'
                  }
                  disabled={task.status === 'awaiting_approval'}
                >
                  {task.status === 'awaiting_approval' ? (
                    <CheckCircle2 size={18} className="text-varistor-lime animate-pulse" />
                  ) : task.status === 'in_progress' ? (
                    <div className="w-[18px] h-[18px] rounded-full border-2 border-varistor-lime border-t-transparent animate-spin" />
                  ) : (
                    <Circle size={18} className="group-hover:text-varistor-lime" />
                  )}
                </button>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-varistor-dark truncate group-hover:text-black">
                    {task.title}
                  </p>
                  <p className="text-[10px] text-varistor-muted mt-0.5 truncate">
                    Due {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Priority Badges */}
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border capitalize ${getPriorityStyles(task.priority)}`}>
                  {task.priority}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
