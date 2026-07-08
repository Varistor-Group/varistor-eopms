/**
 * LEAVE MANAGEMENT SERVICE — Supabase
 * Replaces the localStorage-backed store.
 */

import { supabase } from '../lib/supabase';
import type { LeaveRequest, LeaveBalance } from '../types';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToLeaveBalance(row: any): LeaveBalance {
  return {
    employeeId: row.employee_id,
    casual: { total: row.casual_total, used: row.casual_used },
    sick: { total: row.sick_total, used: row.sick_used },
    earned: { total: row.earned_total, used: row.earned_used },
    unpaidTaken: row.unpaid_taken,
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────

export async function getLeaveBalance(employeeId: string): Promise<LeaveBalance> {
  const { data, error } = await supabase
    .from('leave_balances')
    .select('*')
    .eq('employee_id', employeeId)
    .single();

  if (error || !data) {
    // Auto-create balance if missing
    const { data: newBal } = await supabase
      .from('leave_balances')
      .insert({ employee_id: employeeId })
      .select()
      .single();
    return newBal ? rowToLeaveBalance(newBal) : { employeeId, casual: { total: 12, used: 0 }, sick: { total: 10, used: 0 }, earned: { total: 15, used: 0 }, unpaidTaken: 0 };
  }
  return rowToLeaveBalance(data);
}

export function getLeaveRequests(employeeId?: string): LeaveRequest[] {
  // Sync wrapper — components that call this should use getLeaveRequestsAsync instead.
  // Kept for backwards-compat; returns whatever is in the in-memory cache.
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
  // Sync wrapper that fires-and-forgets to Supabase
  const optimistic: LeaveRequest = {
    ...input,
    id: `LV-${String(Date.now()).slice(-6)}`,
    status: 'Pending',
    submittedAt: new Date().toISOString(),
  };
  mockLeaveRequests.unshift(optimistic);

  // Async persist
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

export function approveLeaveRequest(leaveId: string, reviewerName: string): void {
  const request = mockLeaveRequests.find(r => r.id === leaveId);
  if (!request || request.status !== 'Pending') return;

  request.status = 'Approved';
  request.reviewerName = reviewerName;
  request.reviewedAt = new Date().toISOString();

  // Persist to Supabase
  supabase.from('leave_requests').update({
    status: 'Approved',
    reviewer_name: reviewerName,
    reviewed_at: request.reviewedAt,
  }).eq('id', leaveId).then(({ error }) => {
    if (error) console.error('[approveLeaveRequest]', error.message);
  });

  // Deduct from balance via direct column update
  const balanceColumnMap: Record<string, keyof { casual_used: number; sick_used: number; earned_used: number }> = {
    Casual: 'casual_used',
    Sick: 'sick_used',
    Earned: 'earned_used',
  };
  const balanceCol = balanceColumnMap[request.type];

  supabase.from('leave_balances').select('casual_used,sick_used,earned_used,unpaid_taken').eq('employee_id', request.employeeId).single()
    .then(({ data }) => {
      if (!data) return;
      if (balanceCol) {
        const newVal = (data[balanceCol] as number) + request.days;
        const updates: Record<string, number> = {};
        updates[balanceCol] = newVal;
        supabase.from('leave_balances').update(updates as any).eq('employee_id', request.employeeId)
          .then(({ error }) => { if (error) console.error(error); });
      } else {
        // Unpaid
        supabase.from('leave_balances').update({ unpaid_taken: data.unpaid_taken + request.days }).eq('employee_id', request.employeeId)
          .then(({ error }) => { if (error) console.error(error); });
      }
    });
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
