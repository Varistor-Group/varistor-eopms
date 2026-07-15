/**
 * LEAVE MANAGEMENT SERVICE — Supabase
 * Replaces the localStorage-backed store.
 */

import { supabase } from '../lib/supabase';
import type { LeaveRequest, LeaveBalance, LeaveTypeModel, EmployeeLeaveBalance } from '../types';

export const INDIA_HOLIDAYS_2026: string[] = [
  '2026-01-26','2026-03-25','2026-04-02','2026-04-14','2026-04-29',
  '2026-06-06','2026-08-15','2026-10-02','2026-10-22','2026-11-11','2026-12-25',
];

export function isWeekend(isoDate: string): boolean {
  const day = new Date(`${isoDate}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

export function isHoliday(isoDate: string): boolean {
  return INDIA_HOLIDAYS_2026.includes(isoDate);
}

export function calcWorkingDays(from: string, to: string): number {
  if (!from || !to) return 0;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  if (end < start) return 0;
  let days = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const iso = cursor.toISOString().split('T')[0];
    if (!isWeekend(iso) && !isHoliday(iso)) days++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

// ─── DB row ↔ domain mappers ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToLeaveRequest(row: any): LeaveRequest {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    type: row.type,
    from: row.from_date,
    to: row.to_date,
    days: row.days,
    reason: row.reason,
    status: row.status,
    reviewerId: row.reviewer_id ?? undefined,
    reviewerName: row.reviewer_name ?? undefined,
    rejectionComment: row.rejection_comment ?? undefined,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at ?? undefined,
  };
}

// ─── Dynamic Leave Types ──────────────────────────────────────────────────────

export async function getLeaveTypes(): Promise<LeaveTypeModel[]> {
  const { data, error } = await (supabase as any).from('leave_types').select('*').order('name');
  if (error) { console.error('[getLeaveTypes]', error.message); return []; }
  return data ?? [];
}

export async function createLeaveType(input: Omit<LeaveTypeModel, 'id'>): Promise<LeaveTypeModel | null> {
  const { data, error } = await (supabase as any).from('leave_types').insert([input]).select().single();
  if (error) { console.error('[createLeaveType]', error.message); return null; }
  return data;
}

export async function deleteLeaveType(id: string): Promise<boolean> {
  const { error } = await (supabase as any).from('leave_types').delete().eq('id', id);
  if (error) { console.error('[deleteLeaveType]', error.message); return false; }
  return true;
}

// ─── Dynamic Leave Balances ───────────────────────────────────────────────────

export async function getEmployeeBalances(employeeId: string): Promise<EmployeeLeaveBalance[]> {
  const { data, error } = await (supabase as any)
    .from('employee_leave_balances')
    .select('*')
    .eq('employee_id', employeeId);
  if (error) { console.error('[getEmployeeBalances]', error.message); return []; }
  return data ?? [];
}

export async function updateEmployeeBalance(employeeId: string, leaveTypeName: string, total: number, used: number): Promise<void> {
  const { error } = await (supabase as any)
    .from('employee_leave_balances')
    .upsert({ employee_id: employeeId, leave_type_name: leaveTypeName, total, used }, { onConflict: 'employee_id,leave_type_name' });
  if (error) { console.error('[updateEmployeeBalance]', error.message); }
}

export async function getAllEmployeeBalances(): Promise<EmployeeLeaveBalance[]> {
  const { data, error } = await (supabase as any).from('employee_leave_balances').select('*');
  if (error) { console.error('[getAllEmployeeBalances]', error.message); return []; }
  return data ?? [];
}

// ─── API ──────────────────────────────────────────────────────────────────────

// Legacy wrapper for existing code, can be refactored out later
export async function getLeaveBalance(employeeId: string): Promise<LeaveBalance> {
  const balances = await getEmployeeBalances(employeeId);
  const legacy: LeaveBalance = { employeeId };
  for (const b of balances) {
    if (b.leave_type_name === 'Casual Leave') legacy.casual = { total: b.total, used: b.used };
    if (b.leave_type_name === 'Sick Leave') legacy.sick = { total: b.total, used: b.used };
    if (b.leave_type_name === 'Earned Leave') legacy.earned = { total: b.total, used: b.used };
    if (b.leave_type_name === 'Loss of Pay') legacy.unpaidTaken = b.used;
  }
  return legacy;
}

export function getLeaveRequests(employeeId?: string): LeaveRequest[] {
  // Sync wrapper — components that call this should use getLeaveRequestsAsync instead.
  return mockLeaveRequests.filter(r => !employeeId || r.employeeId === employeeId);
}

export async function getLeaveRequestsAsync(employeeId?: string): Promise<LeaveRequest[]> {
  let query = supabase.from('leave_requests').select('*').order('submitted_at', { ascending: false });
  if (employeeId) query = query.eq('employee_id', employeeId);
  const { data, error } = await query;
  if (error) { console.error('[getLeaveRequestsAsync]', error.message); return []; }
  const requests = (data ?? []).map(rowToLeaveRequest);
  mockLeaveRequests.splice(0, mockLeaveRequests.length, ...requests);
  return requests;
}

export function submitLeaveRequest(input: Omit<LeaveRequest, 'id' | 'status' | 'submittedAt'>): LeaveRequest {
  const optimistic: LeaveRequest = {
    ...input,
    id: `LV-${String(Date.now()).slice(-6)}`,
    status: 'Pending',
    submittedAt: new Date().toISOString(),
  };
  mockLeaveRequests.unshift(optimistic);

  supabase.from('leave_requests').insert({
    id: optimistic.id,
    employee_id: input.employeeId,
    employee_name: input.employeeName,
    department: (input as LeaveRequest & { department?: string }).department ?? '',
    type: input.type,
    from_date: input.from,
    to_date: input.to,
    days: input.days,
    reason: input.reason,
    status: 'Pending',
  }).then(({ error }) => {
    if (error) console.error('[submitLeaveRequest]', error.message);
  });

  return optimistic;
}

export async function approveLeaveRequest(leaveId: string, reviewerName: string): Promise<void> {
  const request = mockLeaveRequests.find(r => r.id === leaveId);
  if (!request || request.status !== 'Pending') return;

  request.status = 'Approved';
  request.reviewerName = reviewerName;
  request.reviewedAt = new Date().toISOString();

  // Persist to Supabase
  await supabase.from('leave_requests').update({
    status: 'Approved',
    reviewer_name: reviewerName,
    reviewed_at: request.reviewedAt,
  }).eq('id', leaveId);

  // Deduct from balance
  const { data: balData } = await (supabase as any)
    .from('employee_leave_balances')
    .select('used')
    .eq('employee_id', request.employeeId)
    .eq('leave_type_name', request.type)
    .single();

  if (balData) {
    await (supabase as any)
      .from('employee_leave_balances')
      .update({ used: balData.used + request.days })
      .eq('employee_id', request.employeeId)
      .eq('leave_type_name', request.type);
  } else {
    await (supabase as any)
      .from('employee_leave_balances')
      .insert({
         employee_id: request.employeeId,
         leave_type_name: request.type,
         total: 0,
         used: request.days
      });
  }
}

export function rejectLeaveRequest(leaveId: string, reviewerName: string, comment: string): void {
  const request = mockLeaveRequests.find(r => r.id === leaveId);
  if (!request || request.status !== 'Pending') return;

  request.status = 'Rejected';
  request.reviewerName = reviewerName;
  request.rejectionComment = comment;
  request.reviewedAt = new Date().toISOString();

  supabase.from('leave_requests').update({
    status: 'Rejected',
    reviewer_name: reviewerName,
    rejection_comment: comment,
    reviewed_at: request.reviewedAt,
  }).eq('id', leaveId).then(({ error }) => {
    if (error) console.error('[rejectLeaveRequest]', error.message);
  });
}

// In-memory cache (populated on first load)
export let mockLeaveRequests: LeaveRequest[] = [];
export let mockLeaveBalances: LeaveBalance[] = [];
