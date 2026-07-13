import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Paperclip, Plus, Calendar, Check } from 'lucide-react';
import type { Task } from '../types';
import { useKanbanTasks } from '../hooks/useKanbanTasks';

interface TaskDrawerProps {
  task: Task | null;
  onClose: () => void;
}

export const TaskDrawer: React.FC<TaskDrawerProps> = ({ task, onClose }) => {
  const { 
    toggleChecklistItem, 
    addChecklistItem, 
    addAttachment 
  } = useKanbanTasks();

  const [newCheckItem, setNewCheckItem] = useState('');
  const [internalTask, setInternalTask] = useState<Task | null>(task);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (task) {
      setInternalTask(task);
      setIsClosing(false);
    } else if (internalTask) {
      setIsClosing(true);
      const timer = setTimeout(() => {
        setInternalTask(null);
        setIsClosing(false);
      }, 200); // Wait for slideOut animation to finish
      return () => clearTimeout(timer);
    }
  }, [task, internalTask]);

  if (!internalTask) return null;

  const currentTask = internalTask;

  const handleAddCheckItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheckItem.trim()) return;
    addChecklistItem(currentTask.id, newCheckItem.trim());
    setNewCheckItem('');
  };

  const handleSimulateAttachment = () => {
    const fileNames = ['contract_amendment.pdf', 'invoice_copy.xlsx', 'user_feedback.docx', 'design_mockup.png'];
    const mockName = fileNames[Math.floor(Math.random() * fileNames.length)];
    const mockSize = `${(Math.random() * 3 + 0.5).toFixed(1)} MB`;
    const mockType = mockName.split('.').pop() || 'file';
    
    addAttachment(currentTask.id, mockName, mockSize, mockType);
  };

  // Checklist statistics
  const completedCount = currentTask.checklist.filter(c => c.completed).length;
  const totalCount = currentTask.checklist.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'animate-fade-in opacity-100'}`}
        onClick={onClose}
      />

      {/* Drawer Body */}
      <div className={`fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white border-l border-varistor-border shadow-2xl z-50 flex flex-col ${isClosing ? 'animate-[slideOut_200ms_ease-in]' : 'animate-[slideIn_200ms_ease-out]'}`}>
        
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-varistor-border flex-shrink-0">
          <span className="text-xs font-bold text-varistor-limeText bg-varistor-limeLight px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            {currentTask.status.replace('_', ' ')}
          </span>
          <button 
            onClick={onClose}
            className="p-1 rounded-full text-varistor-muted hover:text-black hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Title & Description */}
          <div>
            <h2 className="text-lg font-bold text-varistor-dark leading-snug">{currentTask.title}</h2>
            <p className="text-xs text-varistor-muted mt-2 leading-relaxed whitespace-pre-line">
              {currentTask.description}
            </p>
          </div>

          {/* Meta Details */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-varistor-pageBg rounded-varistor border border-varistor-border">
            <div className="space-y-1">
              <span className="text-[10px] text-varistor-muted font-semibold uppercase tracking-wider block">Assignee</span>
              <div className="flex items-center gap-2">
                <img 
                  src={currentTask.assignee.avatarUrl} 
                  alt={currentTask.assignee.name} 
                  className="w-6 h-6 rounded-full object-cover border border-varistor-border"
                />
                <span className="text-xs font-semibold text-varistor-dark">{currentTask.assignee.name}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-varistor-muted font-semibold uppercase tracking-wider block">Due Date</span>
              <div className="flex items-center gap-1.5 text-xs text-varistor-dark font-semibold">
                <Calendar size={14} className="text-varistor-muted" />
                <span>{new Date(currentTask.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </div>
          </div>

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
            
            {/* Progress bar */}
            <div className="w-full bg-varistor-pageBg h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-varistor-lime h-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="space-y-1.5">
              {currentTask.checklist.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleChecklistItem(currentTask.id, item.id)}
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

            {/* Add checklist input */}
            <form onSubmit={handleAddCheckItem} className="flex gap-2 pt-1.5">
              <input
                type="text"
                placeholder="Add item..."
                value={newCheckItem}
                onChange={(e) => setNewCheckItem(e.target.value)}
                className="flex-1 bg-white border border-varistor-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-varistor-lime transition-colors"
              />
              <button 
                type="submit"
                className="bg-varistor-lime text-black px-3 py-1.5 rounded-lg font-bold hover:bg-[#7bc012] transition-colors flex items-center justify-center"
              >
                <Plus size={14} />
              </button>
            </form>
          </div>

          {/* Attachments */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-varistor-dark flex items-center gap-1.5 uppercase tracking-wider">
                <Paperclip size={16} className="text-[#555]" />
                Attachments ({currentTask.attachments.length})
              </h3>
              <button 
                onClick={handleSimulateAttachment}
                className="text-[10px] text-varistor-limeText font-semibold bg-varistor-limeLight border border-varistor-successBorder px-2 py-0.5 rounded hover:bg-varistor-lime hover:text-black hover:border-transparent transition-varistor"
              >
                Add Mock File
              </button>
            </div>

            <div className="space-y-1.5">
              {currentTask.attachments.length === 0 ? (
                <p className="text-[11px] text-varistor-muted italic">No attachments. Drag and drop file to simulate.</p>
              ) : (
                currentTask.attachments.map((file) => (
                  <div 
                    key={file.id} 
                    className="flex items-center justify-between p-2 border border-varistor-border rounded-lg bg-white hover:bg-varistor-pageBg transition-varistor"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded bg-varistor-pageBg flex items-center justify-center text-[10px] font-bold text-varistor-muted uppercase">
                        {file.type.substring(0, 3)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-varistor-dark truncate">{file.name}</p>
                        <p className="text-[9px] text-varistor-muted">{file.size}</p>
                      </div>
                    </div>
                    <a 
                      href="#" 
                      onClick={(e) => e.preventDefault()}
                      className="text-xs font-semibold text-varistor-limeText hover:text-black bg-varistor-limeLight px-2.5 py-1 rounded border border-[#d2f3a6] transition-colors"
                    >
                      Download
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slideOut {
          from { transform: translateX(0); }
          to { transform: translateX(100%); }
        }
      `}</style>
    </>
  );
};
