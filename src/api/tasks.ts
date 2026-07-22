import { supabase } from '../lib/supabase';
import type { Task, TaskPriority, TaskStatus, ChecklistItem, Comment, Attachment } from '../types';

export const tasksApi = {
  async fetchTasks(): Promise<Task[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }

    return (data || []).map(mapDbToTask);
  },

  async createTask(task: Omit<Task, 'id' | 'assignee' | 'comments' | 'attachments'> & { id: string }): Promise<Task> {
    const dbPayload = {
      id: task.id,
      title: task.title,
      description: task.description,
      due_date: task.dueDate,
      priority: task.priority,
      status: task.status,
      assignee_id: task.assigneeId,
      checklist: task.checklist as any,
      comments: [] as any,
      attachments: [] as any,
      points_processed: task.pointsProcessed || false,
      is_overdue_swept: task.isOverdueSwept || false
    };

    const { data, error } = await supabase
      .from('tasks')
      .insert([dbPayload])
      .select()
      .single();

    if (error) {
      console.error('Error creating task:', error);
      throw error;
    }

    return mapDbToTask(data);
  },

  async updateTaskStatus(taskId: string, status: TaskStatus, pointsProcessed?: boolean): Promise<Task> {
    const updates: any = { status };
    if (pointsProcessed !== undefined) {
      updates.points_processed = pointsProcessed;
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error('Error updating task status:', error);
      throw error;
    }

    return mapDbToTask(data);
  },

  async updateTaskDetails(taskId: string, title: string, description: string, priority: TaskPriority, dueDate: string): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .update({ title, description, priority, due_date: dueDate })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error('Error updating task details:', error);
      throw error;
    }

    return mapDbToTask(data);
  },

  async updateTaskChecklist(taskId: string, checklist: ChecklistItem[], status?: TaskStatus): Promise<Task> {
    const updates: any = { checklist: checklist as any };
    if (status !== undefined) {
      updates.status = status;
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error('Error updating task checklist:', error);
      throw error;
    }

    return mapDbToTask(data);
  },

  async updateTaskComments(taskId: string, comments: Comment[]): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .update({ comments: comments as any })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error('Error updating task comments:', error);
      throw error;
    }

    return mapDbToTask(data);
  },

  async updateTaskAttachments(taskId: string, attachments: Attachment[]): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .update({ attachments: attachments as any })
      .eq('id', taskId)
      .select()
      .single();

    if (error) {
      console.error('Error updating task attachments:', error);
      throw error;
    }

    return mapDbToTask(data);
  }
};

// Helper to map DB row to frontend Task type
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapDbToTask(row: any): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    priority: row.priority as TaskPriority,
    status: row.status as TaskStatus,
    assigneeId: row.assignee_id,
    assignee: { name: 'Unknown', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60' }, // Frontend will map actual employee details in Context
    checklist: row.checklist || [],
    comments: row.comments || [],
    attachments: row.attachments || [],
    pointsProcessed: row.points_processed,
    isOverdueSwept: row.is_overdue_swept
  };
}
