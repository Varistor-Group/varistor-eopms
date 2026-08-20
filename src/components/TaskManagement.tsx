import React, { useState, useEffect } from 'react';
import { X, Plus, FileText, CheckCircle2, Clock } from 'lucide-react';
import { useKanbanTasks } from '../hooks/useKanbanTasks';
import { useVariPoints } from '../hooks/useVariPoints';
import { getEmployees, type Employee } from '../api/employees';
import type { TaskPriority } from '../types';

export const TaskManagement: React.FC = () => {
  const { currentRole, createTask, tasks, approveTask, rejectTask, updateTaskDetails, approveTaskRequest, rejectTaskRequest } = useKanbanTasks();
  const { currentUser } = useVariPoints();

  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);

  useEffect(() => {
    getEmployees().then(setAllEmployees);
  }, []);

  // Subordinates are anyone whose reportingManagerId matches the current logged-in
  // manager's real id. Or if Admin/HR, everyone.
  const subordinates = allEmployees.filter(emp => 
    (currentRole === 'Admin' || currentRole === 'HR') ? true : emp.reportingManagerId === currentUser?.id
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

    if (assigneeId === 'ALL') {
      subordinates.forEach(emp => {
        createTask(title, description, dueDate, priority, emp.id, checkpoints.filter(c => c.trim() !== ''));
      });
    } else {
      createTask(title, description, dueDate, priority, assigneeId, checkpoints.filter(c => c.trim() !== ''));
    }

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

  // Employee-requested tasks awaiting manager review (a separate flow from completion approval)
  const taskRequests = tasks.filter(t => t.status === 'pending_review' && subordinateIds.has(t.assigneeId!));

  // State for Employee Overview
  const [selectedOverviewEmployeeId, setSelectedOverviewEmployeeId] = useState('');
  const selectedEmployeeTasks = selectedOverviewEmployeeId 
    ? tasks.filter(t => t.assigneeId === selectedOverviewEmployeeId)
    : [];
  const pendingTasks = selectedEmployeeTasks.filter(t => t.status === 'todo' || t.status === 'in_progress');
  const completedTasks = selectedEmployeeTasks.filter(t => t.status === 'done' || t.status === 'awaiting_approval');

  // Edit-task state (RM / Admin / HR can edit title, description, priority, due date)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<TaskPriority>('medium');
  const [editDueDate, setEditDueDate] = useState('');

  const startEditingTask = (t: { id: string; title: string; description: string; priority: TaskPriority; dueDate: string }) => {
    setEditingTaskId(t.id);
    setEditTitle(t.title);
    setEditDescription(t.description);
    setEditPriority(t.priority);
    setEditDueDate(t.dueDate ? t.dueDate.slice(0, 10) : '');
  };

  const cancelEditingTask = () => setEditingTaskId(null);

  const saveEditingTask = () => {
    if (!editingTaskId || !editTitle.trim() || !editDueDate) return;
    updateTaskDetails(editingTaskId, editTitle, editDescription, editPriority, editDueDate);
    setEditingTaskId(null);
  };

  return (
    <div className="space-y-6 animate-[fadeInPage_250ms_ease-out]">
      <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-6">
        <h2 className="text-lg font-bold text-varistor-dark mb-4">Assign New Task</h2>
        <form onSubmit={handleAssignTask} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-varistor-dark block mb-1.5">Task Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full border border-varistor-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-varistor-lime bg-varistor-pageBg text-varistor-dark" />
            </div>
            <div>
              <label className="text-xs font-semibold text-varistor-dark block mb-1.5">Assignee</label>
              <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} required className="w-full border border-varistor-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-varistor-lime bg-varistor-pageBg text-varistor-dark">
                <option value="" disabled>Select Employee</option>
                {(currentRole === 'Admin' || currentRole === 'HR') && (
                  <option value="ALL" className="font-bold text-[#5da00d]">-- Select All Employees --</option>
                )}
                {subordinates.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-varistor-dark block mb-1.5">Description</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} required rows={3} className="w-full border border-varistor-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-varistor-lime bg-varistor-pageBg text-varistor-dark" />
            </div>
            <div>
              <label className="text-xs font-semibold text-varistor-dark block mb-1.5">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required className="w-full border border-varistor-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-varistor-lime bg-varistor-pageBg text-varistor-dark" />
            </div>
            <div>
              <label className="text-xs font-semibold text-varistor-dark block mb-1.5">Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} required className="w-full border border-varistor-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-varistor-lime bg-varistor-pageBg text-varistor-dark">
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
                  className="text-xs text-[#5da00d] bg-varistor-pageBg px-2 py-1 rounded border border-[#5da00d] font-bold flex items-center gap-1 hover:brightness-105"
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
                      className="flex-1 border border-varistor-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-varistor-lime bg-varistor-pageBg"
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
        <h2 className="text-lg font-bold text-varistor-dark mb-4">Task Requests Pending Approval</h2>
        <p className="text-xs text-varistor-muted -mt-3 mb-4">Employee-submitted task requests. Review, edit if needed (e.g. deadline), then approve or reject.</p>
        {taskRequests.length === 0 ? (
          <p className="text-sm text-varistor-muted">No task requests currently pending.</p>
        ) : (
          <div className="space-y-3">
            {taskRequests.map(task => (
              <div key={task.id} className="p-4 border border-[#f1f3f0] rounded-lg bg-varistor-pageBg">
                {editingTaskId === task.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full border border-varistor-border rounded px-2 py-1.5 text-sm font-bold bg-white"
                      placeholder="Title"
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={2}
                      className="w-full border border-varistor-border rounded px-2 py-1.5 text-xs bg-white"
                      placeholder="Description"
                    />
                    <div className="flex gap-2">
                      <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                        className="flex-1 border border-varistor-border rounded px-2 py-1.5 text-xs bg-white"
                      >
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className="flex-1 border border-varistor-border rounded px-2 py-1.5 text-xs bg-white"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button onClick={cancelEditingTask} className="text-xs text-gray-500 hover:text-gray-800 font-semibold px-2 py-1">Cancel</button>
                      <button onClick={saveEditingTask} className="text-xs bg-varistor-lime text-varistor-dark font-bold px-3 py-1.5 rounded-full hover:brightness-105">Save Changes</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <h3 className="font-bold text-sm text-varistor-dark">{task.title}</h3>
                      <p className="text-xs text-varistor-muted mt-1">{task.description}</p>
                      {task.comments.length > 0 && (
                        <p className="text-[10px] text-varistor-dark bg-white border border-varistor-border rounded px-2 py-1 mt-2 italic">
                          Note: {task.comments[task.comments.length - 1].text}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2 text-[10px]">
                        <span className="text-varistor-limeText font-semibold">Requested by: {subordinates.find(e => e.id === task.assigneeId)?.fullName || 'Unknown'}</span>
                        <span className="text-varistor-muted">· Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                        <span className="text-varistor-muted capitalize">· {task.priority} priority</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => startEditingTask(task)} className="bg-white border border-varistor-border text-varistor-dark text-xs font-bold px-3 py-2 rounded-full hover:bg-varistor-pageBg transition-all cursor-pointer">Edit</button>
                      <button onClick={() => approveTaskRequest(task.id)} className="bg-varistor-lime text-varistor-dark text-xs font-bold px-4 py-2 rounded-full hover:brightness-105 transition-all cursor-pointer">Approve</button>
                      <button onClick={() => rejectTaskRequest(task.id)} className="bg-red-50 text-red-600 border border-red-200 text-xs font-bold px-4 py-2 rounded-full hover:bg-red-100 transition-all cursor-pointer">Reject</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-6">
        <h2 className="text-lg font-bold text-varistor-dark mb-4">Task Awaiting Approvable for Completion</h2>
        {awaitingApprovalTasks.length === 0 ? (
          <p className="text-sm text-varistor-muted">No tasks currently awaiting approval.</p>
        ) : (
          <div className="space-y-3">
            {awaitingApprovalTasks.map(task => (
              <div key={task.id} className="flex flex-col sm:flex-row justify-between sm:items-center p-4 border border-[#f1f3f0] rounded-lg gap-4 bg-varistor-pageBg">
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

      <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-6">
        <h2 className="text-lg font-bold text-varistor-dark mb-4">Employee Task Overview</h2>
        <div className="mb-6">
          <label className="text-xs font-semibold text-varistor-dark block mb-1.5">Select Employee to View</label>
          <select 
            value={selectedOverviewEmployeeId} 
            onChange={(e) => setSelectedOverviewEmployeeId(e.target.value)} 
            className="w-full md:w-1/2 border border-varistor-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-varistor-lime bg-varistor-pageBg text-varistor-dark"
          >
            <option value="">-- Choose an employee --</option>
            {subordinates.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.fullName}</option>
            ))}
          </select>
        </div>

        {selectedOverviewEmployeeId ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Pending Tasks */}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-varistor-dark mb-3">
                <Clock size={16} className="text-amber-500" /> Pending Tasks ({pendingTasks.length})
              </h3>
              {pendingTasks.length === 0 ? (
                <p className="text-xs text-varistor-muted italic">No pending tasks.</p>
              ) : (
                <div className="space-y-3">
                  {pendingTasks.map(t => {
                    const isOverdue = t.status !== 'done' && new Date(t.dueDate + 'T23:59:59') < new Date();
                    return (
                    <div key={t.id} className={`p-3 bg-varistor-pageBg border rounded-lg ${isOverdue ? 'border-l-4 border-l-red-500 border-[#f1f3f0]' : 'border-[#f1f3f0]'}`}>
                      {editingTaskId === t.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="w-full border border-varistor-border rounded px-2 py-1 text-xs font-bold bg-white"
                            placeholder="Title"
                          />
                          <textarea
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            rows={2}
                            className="w-full border border-varistor-border rounded px-2 py-1 text-[10px] bg-white"
                            placeholder="Description"
                          />
                          <div className="flex gap-2">
                            <select
                              value={editPriority}
                              onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                              className="flex-1 border border-varistor-border rounded px-2 py-1 text-[10px] bg-white"
                            >
                              <option value="critical">Critical</option>
                              <option value="high">High</option>
                              <option value="medium">Medium</option>
                              <option value="low">Low</option>
                            </select>
                            <input
                              type="date"
                              value={editDueDate}
                              onChange={(e) => setEditDueDate(e.target.value)}
                              className="flex-1 border border-varistor-border rounded px-2 py-1 text-[10px] bg-white"
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-1">
                            <button onClick={cancelEditingTask} className="text-[10px] text-gray-500 hover:text-gray-800 font-semibold px-2 py-1">Cancel</button>
                            <button onClick={saveEditingTask} className="text-[10px] bg-varistor-lime text-varistor-dark font-bold px-3 py-1 rounded-full hover:brightness-105">Save</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start gap-2">
                            <p className="font-bold text-xs text-varistor-dark">{t.title}</p>
                            <button
                              onClick={() => startEditingTask(t)}
                              className="text-[10px] text-blue-500 hover:text-blue-700 font-semibold shrink-0"
                            >
                              Edit
                            </button>
                          </div>
                          <p className="text-[10px] text-varistor-muted mt-1 truncate">{t.description}</p>
                          <div className="mt-2 flex justify-between items-center text-[10px]">
                            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold uppercase">{t.status.replace('_', ' ')}</span>
                            <span className={isOverdue ? 'text-red-700 font-bold' : 'text-varistor-muted'}>
                              Due: {new Date(t.dueDate).toLocaleDateString()}{isOverdue ? ' · Overdue' : ''}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Completed Tasks */}
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-varistor-dark mb-3">
                <CheckCircle2 size={16} className="text-green-500" /> Completed Tasks ({completedTasks.length})
              </h3>
              {completedTasks.length === 0 ? (
                <p className="text-xs text-varistor-muted italic">No completed tasks yet.</p>
              ) : (
                <div className="space-y-3">
                  {completedTasks.map(t => (
                    <div key={t.id} className="p-3 bg-green-50/50 border border-green-100 rounded-lg">
                      <p className="font-bold text-xs text-varistor-dark">{t.title}</p>
                      <p className="text-[10px] text-varistor-muted mt-1 truncate">{t.description}</p>
                      <div className="mt-2 flex justify-between items-center text-[10px]">
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase">{t.status.replace('_', ' ')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-varistor-muted">
            <FileText size={32} strokeWidth={1.5} className="mb-2 opacity-50" />
            <p className="text-sm">Select an employee from the dropdown to see their tasks.</p>
          </div>
        )}
      </div>
    </div>
  );
};
