import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useKanbanTasks } from '../hooks/useKanbanTasks';
import { mockEmployeeStore } from '../api/employees';
import type { TaskPriority } from '../types';

export const TaskManagement: React.FC = () => {
  const { currentRole, createTask, tasks, approveTask, rejectTask } = useKanbanTasks();
  const MOCK_MANAGER_ID = 'VAR-001'; // Simulated logged-in manager

  // Subordinates are anyone whose reportingManager is the current manager. Or if Admin/HR, everyone.
  const subordinates = mockEmployeeStore.filter(emp => 
    (currentRole === 'Admin' || currentRole === 'HR') ? true : emp.reportingManager === MOCK_MANAGER_ID
  );

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [checkpoints, setCheckpoints] = useState<string[]>([]);

  const handleAssignTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !dueDate || !assigneeId) return;
    createTask(title, description, dueDate, priority, assigneeId, checkpoints.filter(c => c.trim() !== ''));
    setTitle('');
    setDescription('');
    setDueDate('');
    setPriority('medium');
    setAssigneeId('');
    setCheckpoints([]);
  };

  // Find tasks awaiting approval for subordinates
  const subordinateIds = new Set(subordinates.map(emp => emp.id));
  const awaitingApprovalTasks = tasks.filter(t => t.status === 'awaiting_approval' && subordinateIds.has(t.assigneeId!));

  return (
    <div className="space-y-6 animate-[fadeInPage_250ms_ease-out]">
      <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-6">
        <h2 className="text-lg font-bold text-varistor-dark mb-4">Assign New Task</h2>
        <form onSubmit={handleAssignTask} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-varistor-dark block mb-1.5">Task Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full border border-varistor-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-varistor-lime" />
            </div>
            <div>
              <label className="text-xs font-semibold text-varistor-dark block mb-1.5">Assignee</label>
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} required className="w-full border border-varistor-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-varistor-lime">
                <option value="" disabled>Select Employee</option>
                {subordinates.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-varistor-dark block mb-1.5">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} className="w-full border border-varistor-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-varistor-lime" />
            </div>
            <div>
              <label className="text-xs font-semibold text-varistor-dark block mb-1.5">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required className="w-full border border-varistor-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-varistor-lime" />
            </div>
            <div>
              <label className="text-xs font-semibold text-varistor-dark block mb-1.5">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} required className="w-full border border-varistor-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-varistor-lime">
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="md:col-span-2 pt-2 border-t border-varistor-border mt-2">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-varistor-dark">Task Checkpoints (Sub-tasks)</label>
                <button 
                  type="button" 
                  onClick={() => setCheckpoints([...checkpoints, ''])} 
                  className="text-xs text-[#5da00d] bg-[#f4f7f2] px-2 py-1 rounded border border-[#5da00d] font-bold flex items-center gap-1 hover:brightness-105"
                >
                  <Plus size={12} strokeWidth={3} /> Add Checkpoint
                </button>
              </div>
              <div className="space-y-2">
                {checkpoints.map((cp, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input 
                      type="text" 
                      value={cp} 
                      onChange={(e) => {
                        const newCp = [...checkpoints];
                        newCp[idx] = e.target.value;
                        setCheckpoints(newCp);
                      }} 
                      placeholder={`Checkpoint ${idx + 1}`}
                      className="flex-1 border border-varistor-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-varistor-lime bg-[#fafbfa]"
                    />
                    <button 
                      type="button" 
                      onClick={() => setCheckpoints(checkpoints.filter((_, i) => i !== idx))} 
                      className="text-red-500 hover:text-red-700 p-1.5 bg-red-50 rounded-lg border border-red-100"
                    >
                      <X size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                ))}
                {checkpoints.length === 0 && <p className="text-xs text-varistor-muted italic">No checkpoints added.</p>}
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="bg-varistor-lime text-varistor-dark font-bold text-sm px-6 py-2 rounded-full hover:brightness-105 transition-all">Assign Task</button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-6">
        <h2 className="text-lg font-bold text-varistor-dark mb-4">Tasks Awaiting Approval</h2>
        {awaitingApprovalTasks.length === 0 ? (
          <p className="text-sm text-varistor-muted">No tasks currently awaiting approval.</p>
        ) : (
          <div className="space-y-3">
            {awaitingApprovalTasks.map(task => (
              <div key={task.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 border border-[#f1f3f0] rounded-lg gap-4 bg-[#fafbfa]">
                <div>
                  <h3 className="font-bold text-sm text-varistor-dark">{task.title}</h3>
                  <p className="text-xs text-varistor-muted mt-1">{task.description}</p>
                  <p className="text-[10px] text-varistor-limeText font-semibold mt-2">Assigned to: {subordinates.find(e => e.id === task.assigneeId)?.fullName || 'Unknown'}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => approveTask(task.id)} className="bg-varistor-lime text-varistor-dark text-xs font-bold px-4 py-2 rounded-full hover:brightness-105 transition-all cursor-pointer">Approve</button>
                  <button onClick={() => rejectTask(task.id)} className="bg-red-50 text-red-600 border border-red-200 text-xs font-bold px-4 py-2 rounded-full hover:bg-red-100 transition-all cursor-pointer">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
