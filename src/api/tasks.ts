/**
 * TASKS SERVICE — MySQL (via PHP backend)
 * Note: no realtime — EopmsContext.tsx's Supabase postgres_changes
 * subscription for tasks needs removing/replacing with polling separately.
 */

import { apiFetch } from './httpClient';
import type { Task, TaskPriority, TaskStatus, ChecklistItem, Comment, Attachment } from '../types';

export const tasksApi = {
  async fetchTasks(): Promise<Task[]> {
    const res = await apiFetch('/api/tasks');
    if (!res.ok) {
      console.error('Error fetching tasks:', res.statusText);
      throw new Error('Failed to fetch tasks');
    }
    const rows = await res.json();
    return (rows || []).map(mapDbToTask);
  },

  async createTask(task: Omit<Task, 'id' | 'assignee' | 'comments' | 'attachments'> & { id: string }): Promise<Task> {
    const res = await apiFetch('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({
        id: task.id,
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        priority: task.priority,
        status: task.status,
        completedAt: row.completedAt,
        assigneeId: task.assigneeId,
        checklist: task.checklist,
      }),
    });
    if (!res.ok) {
      console.error('Error creating task:', res.statusText);
      throw new Error('Failed to create task');
    }
    return mapDbToTask(await res.json());
  },

  async updateTaskStatus(taskId: string, status: TaskStatus, pointsProcessed?: boolean): Promise<Task> {
    const body: Record<string, unknown> = { status };
    if (pointsProcessed !== undefined) body.pointsProcessed = pointsProcessed;

    const res = await apiFetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('Error updating task status:', res.statusText);
      throw new Error('Failed to update task status');
    }
    return mapDbToTask(await res.json());
  },

  async updateTaskDetails(taskId: string, title: string, description: string, priority: TaskPriority, dueDate: string): Promise<Task> {
    const res = await apiFetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ title, description, priority, dueDate }),
    });
    if (!res.ok) {
      console.error('Error updating task details:', res.statusText);
      throw new Error('Failed to update task details');
    }
    return mapDbToTask(await res.json());
  },

  async updateTaskChecklist(taskId: string, checklist: ChecklistItem[], status?: TaskStatus): Promise<Task> {
    const body: Record<string, unknown> = { checklist };
    if (status !== undefined) body.status = status;

    const res = await apiFetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('Error updating task checklist:', res.statusText);
      throw new Error('Failed to update task checklist');
    }
    return mapDbToTask(await res.json());
  },

  async updateTaskComments(taskId: string, comments: Comment[]): Promise<Task> {
    const res = await apiFetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ comments }),
    });
    if (!res.ok) {
      console.error('Error updating task comments:', res.statusText);
      throw new Error('Failed to update task comments');
    }
    return mapDbToTask(await res.json());
  },

  async updateTaskAttachments(taskId: string, attachments: Attachment[]): Promise<Task> {
    const res = await apiFetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify({ attachments }),
    });
    if (!res.ok) {
      console.error('Error updating task attachments:', res.statusText);
      throw new Error('Failed to update task attachments');
    }
    return mapDbToTask(await res.json());
  },

  async deleteTask(taskId: string): Promise<void> {
    const res = await apiFetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    if (!res.ok) {
      console.error('Error deleting task:', res.statusText);
      throw new Error('Failed to delete task');
    }
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDbToTask(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.dueDate,
    priority: row.priority as TaskPriority,
    status: row.status as TaskStatus,
    completedAt: row.completedAt,
    assigneeId: row.assigneeId,
    assignee: { name: 'Unknown', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60' },
    checklist: row.checklist || [],
    comments: row.comments || [],
    attachments: row.attachments || [],
    pointsProcessed: row.pointsProcessed,
    isOverdueSwept: row.isOverdueSwept,
  };
}