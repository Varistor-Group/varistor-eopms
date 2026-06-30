import React, { useState } from 'react';
import { X, CheckSquare, MessageSquare, Paperclip, Plus, Calendar, Check, Send } from 'lucide-react';
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
    addComment, 
    addAttachment 
  } = useKanbanTasks();

  const [newCheckItem, setNewCheckItem] = useState('');
  const [commentText, setCommentText] = useState('');

  if (!task) return null;

  const handleAddCheckItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCheckItem.trim()) return;
    addChecklistItem(task.id, newCheckItem.trim());
    setNewCheckItem('');
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addComment(task.id, commentText.trim());
    setCommentText('');
  };

  const handleSimulateAttachment = () => {
    const fileNames = ['contract_amendment.pdf', 'invoice_copy.xlsx', 'user_feedback.docx', 'design_mockup.png'];
    const mockName = fileNames[Math.floor(Math.random() * fileNames.length)];
    const mockSize = `${(Math.random() * 3 + 0.5).toFixed(1)} MB`;
    const mockType = mockName.split('.').pop() || 'file';
    
    addAttachment(task.id, mockName, mockSize, mockType);
  };

  // Checklist statistics
  const completedCount = task.checklist.filter(c => c.completed).length;
  const totalCount = task.checklist.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/30 z-40 transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Drawer Body */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-white border-l border-varistor-border shadow-2xl z-50 flex flex-col transition-transform duration-200 ease-out transform translate-x-0 animate-[slideIn_200ms_ease-out]">
        
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-varistor-border flex-shrink-0">
          <span className="text-xs font-bold text-varistor-limeText bg-varistor-limeLight px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            {task.status.replace('_', ' ')}
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
            <h2 className="text-lg font-bold text-varistor-dark leading-snug">{task.title}</h2>
            <p className="text-xs text-varistor-muted mt-2 leading-relaxed whitespace-pre-line">
              {task.description}
            </p>
          </div>

          {/* Meta Details */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-[#fafbfa] rounded-varistor border border-varistor-border">
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
              <div className="flex items-center gap-1.5 text-xs text-varistor-dark font-semibold">
                <Calendar size={14} className="text-varistor-muted" />
                <span>{new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
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
              <span className="text-[10px] font-bold text-varistor-limeText bg-[#f7fee7] px-1.5 py-0.5 rounded">
                {progressPercent}%
              </span>
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-[#f1f3f0] h-1.5 rounded-full overflow-hidden">
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
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-transparent hover:border-varistor-border hover:bg-[#fafbfa] text-left transition-varistor group"
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
                Attachments ({task.attachments.length})
              </h3>
              <button 
                onClick={handleSimulateAttachment}
                className="text-[10px] text-varistor-limeText font-semibold bg-varistor-limeLight border border-varistor-successBorder px-2 py-0.5 rounded hover:bg-varistor-lime hover:text-black hover:border-transparent transition-varistor"
              >
                Add Mock File
              </button>
            </div>

            <div className="space-y-1.5">
              {task.attachments.length === 0 ? (
                <p className="text-[11px] text-varistor-muted italic">No attachments. Drag and drop file to simulate.</p>
              ) : (
                task.attachments.map((file) => (
                  <div 
                    key={file.id} 
                    className="flex items-center justify-between p-2 border border-varistor-border rounded-lg bg-white hover:bg-[#fafbfa] transition-varistor"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded bg-[#f1f3f0] flex items-center justify-center text-[10px] font-bold text-varistor-muted uppercase">
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
                      className="text-xs font-semibold text-varistor-limeText hover:text-black bg-[#f7fee7] px-2.5 py-1 rounded border border-[#d2f3a6] transition-colors"
                    >
                      Download
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Comments */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-varistor-dark flex items-center gap-1.5 uppercase tracking-wider">
              <MessageSquare size={16} className="text-[#555]" />
              Comments ({task.comments.length})
            </h3>

            {/* Comments List */}
            <div className="space-y-3">
              {task.comments.length === 0 ? (
                <p className="text-[11px] text-varistor-muted italic">No comments yet. Start the conversation!</p>
              ) : (
                task.comments.map((comm) => (
                  <div key={comm.id} className="flex gap-2.5">
                    <img 
                      src={comm.authorAvatar} 
                      alt={comm.author} 
                      className="w-6 h-6 rounded-full object-cover border border-varistor-border flex-shrink-0"
                    />
                    <div className="flex-1 bg-[#fafbfa] border border-[#edf0ec] rounded-lg p-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-varistor-dark">{comm.author}</span>
                        <span className="text-[9px] text-varistor-muted">
                          {new Date(comm.timestamp).toLocaleDateString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-[#555a52] mt-1 leading-relaxed">{comm.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Comment Form */}
            <form onSubmit={handleAddComment} className="flex gap-2 pt-2 border-t border-[#edf0ec]">
              <input
                type="text"
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="flex-1 bg-white border border-varistor-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-varistor-lime transition-colors"
              />
              <button 
                type="submit"
                className="bg-black hover:bg-gray-800 text-white px-3.5 py-1.5 rounded-lg flex items-center justify-center transition-colors"
              >
                <Send size={13} />
              </button>
            </form>
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
