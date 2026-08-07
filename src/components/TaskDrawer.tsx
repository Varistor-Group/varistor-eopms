import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Calendar, Check, Pencil, Save, XCircle } from 'lucide-react';
import type { Task, TaskPriority } from '../types';
import { useKanbanTasks } from '../hooks/useKanbanTasks';

interface TaskDrawerProps {
  task: Task | null;
  onClose: () => void;
}

export const TaskDrawer: React.FC<TaskDrawerProps> = ({ task, onClose }) => {
  const { 
    toggleChecklistItem,
    updateTaskDetails,
    currentRole
  } = useKanbanTasks();

  const [isClosing, setIsClosing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
  const [editDueDate, setEditDueDate] = useState('');

  const canEdit = currentRole === 'HR' || currentRole === 'Admin' || currentRole === 'Reporting Manager';

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
      setIsEditing(false);
    }, 200);
  };

  useEffect(() => {
    const handleBackButton = (e: Event) => {
      e.preventDefault();
      handleClose();
    };
    window.addEventListener('app_back_button', handleBackButton);
    return () => window.removeEventListener('app_back_button', handleBackButton);
  }, [onClose]);

  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDescription(task.description);
      setEditPriority(task.priority);
      setEditDueDate(task.dueDate);
      setIsEditing(false);
    }
  }, [task]);

  if (!task) return null;

  const completedCount = task.checklist.filter(c => c.completed).length;
  const totalCount = task.checklist.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleSave = async () => {
    if (!editTitle.trim() || !editDueDate) return;
    setIsSaving(true);
    await updateTaskDetails(task.id, editTitle.trim(), editDescription.trim(), editPriority, editDueDate);
    setIsSaving(false);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate);
    setIsEditing(false);
  };

  return (
    <>
      <div 
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'animate-fade-in opacity-100'}`}
        onClick={handleClose}
      />

      <div className={`fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white border-l border-varistor-border shadow-2xl z-50 flex flex-col transition-transform duration-200 ease-out transform ${isClosing ? 'translate-x-full' : 'translate-x-0 animate-[slideIn_200ms_ease-out]'}`}>
        
        <div className="h-16 flex items-center justify-between px-6 border-b border-varistor-border flex-shrink-0">
          <span className="text-xs font-bold text-varistor-limeText bg-varistor-limeLight px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            {task.status.replace('_', ' ')}
          </span>
          <div className="flex items-center gap-2">
            {canEdit && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="p-1.5 rounded-full text-varistor-muted hover:text-varistor-dark hover:bg-gray-100 transition-colors"
                title="Edit task"
              >
                <Pencil size={16} />
              </button>
            )}
            <button 
              onClick={handleClose}
              className="p-1 rounded-full text-varistor-muted hover:text-black hover:bg-gray-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title & Description */}
          <div>
            {isEditing ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="w-full text-lg font-bold text-varistor-dark border border-varistor-border rounded-lg px-3 py-2 focus:outline-none focus:border-varistor-lime"
                  placeholder="Task title"
                />
                <textarea
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full text-xs text-varistor-dark border border-varistor-border rounded-lg px-3 py-2 focus:outline-none focus:border-varistor-lime resize-none"
                  placeholder="Description"
                />
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-varistor-dark leading-snug">{task.title}</h2>
                <p className="text-xs text-varistor-muted mt-2 leading-relaxed whitespace-pre-line">
                  {task.description}
                </p>
              </>
            )}
          </div>

          {/* Meta Details */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-varistor-pageBg rounded-varistor border border-varistor-border">
            <div className="space-y-1">
              <span className="text-[10px] text-varistor-muted font-semibold uppercase tracking-wider block">Assignee</span>
              <div className="flex items-center gap-2">
                <img 
                  src={task.assignee.avatarUrl} 
                  alt={task.assignee.name} 
                  className="w-6 h-6 rounded-full object-cover border border-varistor-border"
                />
                <span className="text-xs font-semibold text-varistor-dark">{task.assignee.name}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-varistor-muted font-semibold uppercase tracking-wider block">Due Date</span>
              {isEditing ? (
                <input
                  type="date"
                  value={editDueDate}
                  onChange={e => setEditDueDate(e.target.value)}
                  className="w-full text-xs text-varistor-dark border border-varistor-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-varistor-lime"
                />
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-varistor-dark font-semibold">
                  <Calendar size={14} className="text-varistor-muted" />
                  <span>{new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
              )}
            </div>

            {isEditing && (
              <div className="space-y-1 col-span-2">
                <span className="text-[10px] text-varistor-muted font-semibold uppercase tracking-wider block">Priority</span>
                <select
                  value={editPriority}
                  onChange={e => setEditPriority(e.target.value as TaskPriority)}
                  className="w-full text-xs text-varistor-dark border border-varistor-border rounded-lg px-2 py-1.5 focus:outline-none focus:border-varistor-lime"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            )}
          </div>

          {isEditing && (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving || !editTitle.trim() || !editDueDate}
                className="flex-1 flex items-center justify-center gap-1.5 bg-varistor-lime text-black text-xs font-bold py-2 rounded-lg hover:bg-[#7bc012] transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                {isSaving ? 'Saving…' : 'Save Changes'}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 text-varistor-dark text-xs font-bold py-2 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <XCircle size={14} />
                Cancel
              </button>
            </div>
          )}

          {/* Checklist */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-varistor-dark flex items-center gap-1.5 uppercase tracking-wider">
                <CheckSquare size={16} className="text-[#555]" />
                Checklist ({completedCount}/{totalCount})
              </h3>
              <span className="text-[10px] font-bold text-varistor-limeText bg-varistor-limeLight px-1.5 py-0.5 rounded">
                {progressPercent}%
              </span>
            </div>
            
            <div className="w-full bg-varistor-pageBg h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-varistor-lime h-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="space-y-1.5">
              {task.checklist.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleChecklistItem(task.id, item.id)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-transparent hover:border-varistor-border hover:bg-varistor-pageBg text-left transition-varistor group"
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-varistor ${
                    item.completed 
                      ? 'bg-varistor-lime border-varistor-lime text-black' 
                      : 'border-varistor-border group-hover:border-varistor-lime'
                  }`}>
                    {item.completed && <Check size={11} strokeWidth={3} />}
                  </div>
                  <span className={`text-xs ${item.completed ? 'line-through text-varistor-muted' : 'text-varistor-dark font-medium'}`}>
                    {item.text}
                  </span>
                </button>
              ))}
            </div>

          </div>

        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
};