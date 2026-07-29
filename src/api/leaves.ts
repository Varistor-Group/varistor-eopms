/**
 * LEAVE MANAGEMENT SERVICE — MySQL (via PHP backend)
 * Converted from Supabase. Note: rejectLeaveRequest still calls
 * updateAttendance() from attendance.ts, which is not yet converted —
 * that dependency will resolve once attendance.ts is done separately.
 */

import { apiFetch } from './httpClient';
import type { LeaveRequest, LeaveBalance, LeaveTypeModel, EmployeeLeaveBalance } from '../types';
import { getEmployees } from './employees';
import { updateAttendance } from './attendance';

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

// ─── Leave Types ───────────────────────────────────────────────────────────

export async function getLeaveTypes(): Promise<LeaveTypeModel[]> {
  try {
    const res = await apiFetch('/api/leave-types');
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('[getLeaveTypes]', e);
    return [];
  }
}

export async function createLeaveType(input: Omit<LeaveTypeModel, 'id'>): Promise<LeaveTypeModel | null> {
  try {
    const res = await apiFetch('/api/leave-types', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) return null;
    return data.leaveType;
  } catch (e) {
    console.error('[createLeaveType]', e);
    return null;
  }
}

export async function deleteLeaveType(id: string): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/leave-types/${id}`, { method: 'DELETE' });
    return res.ok;
  } catch (e) {
    console.error('[deleteLeaveType]', e);
    return false;
  }
}

// ─── Employee Leave Balances ───────────────────────────────────────────────

export async function getEmployeeBalances(employeeId: string): Promise<EmployeeLeaveBalance[]> {
  try {
    const res = await apiFetch(`/api/employee-leave-balances/${employeeId}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('[getEmployeeBalances]', e);
    return [];
  }
}

export async function updateEmployeeBalance(employeeId: string, leaveTypeName: string, total: number, used: number): Promise<void> {
  try {
    await apiFetch(`/api/employee-leave-balances/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify({ leaveTypeName, total, used }),
    });
  } catch (e) {
    console.error('[updateEmployeeBalance]', e);
  }
}

export async function getAllEmployeeBalances(): Promise<EmployeeLeaveBalance[]> {
  try {
    const res = await apiFetch('/api/employee-leave-balances');
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.error('[getAllEmployeeBalances]', e);
    return [];
  }
}

export async function initEmployeeLeaveBalances(employeeId: string): Promise<void> {
  const types = await getLeaveTypes();
  if (types.length === 0) {
    await updateEmployeeBalance(employeeId, 'Annual Leave', 12, 0);
    return;
  }
  for (const t of types) {
    await updateEmployeeBalance(employeeId, t.name, t.default_allocation > 0 ? t.default_allocation : 12, 0);
  }
}

export async function migrateExistingEmployeeBalances(): Promise<{ seeded: number; skipped: number }> {
  const [employees, existingBalances] = await Promise.all([
    getEmployees(),
    getAllEmployeeBalances(),
  ]);

  const employeesWithBalances = new Set(existingBalances.map(b => b.employee_id));
  const missing = employees.filter(e => e.status === 'Active' && !employeesWithBalances.has(e.employeeId));

  let seeded = 0;
  for (const emp of missing) {
    await initEmployeeLeaveBalances(emp.employeeId);
    seeded++;
  }

  return { seeded, skipped: employees.length - missing.length };
}

// ─── Legacy balance wrapper ─────────────────────────────────────────────────

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

// ─── Leave Requests ─────────────────────────────────────────────────────────

export function getLeaveRequests(employeeId?: string): LeaveRequest[] {
  return mockLeaveRequests.filter(r => !employeeId || r.employeeId === employeeId);
}

export async function getLeaveRequestsAsync(employeeId?: string): Promise<LeaveRequest[]> {
  try {
    const res = await apiFetch('/api/leaves');
    if (!res.ok) return [];
    const rows = await res.json();
    let requests = (rows ?? []).map(rowToLeaveRequest);
    if (employeeId) requests = requests.filter((r: LeaveRequest) => r.employeeId === employeeId);
    mockLeaveRequests.splice(0, mockLeaveRequests.length, ...requests);
    return requests;
  } catch (e) {
    console.error('[getLeaveRequestsAsync]', e);
    return [];
  }
}

export function submitLeaveRequest(input: Omit<LeaveRequest, 'id' | 'status' | 'submittedAt'>): LeaveRequest {
  const optimistic: LeaveRequest = {
    ...input,
    id: `LV-${String(Date.now()).slice(-6)}`,
    status: 'Pending',
    submittedAt: new Date().toISOString(),
  };
  mockLeaveRequests.unshift(optimistic);

  apiFetch('/api/leaves', {
    method: 'POST',
    body: JSON.stringify({
      type: input.type,
      from_date: input.from,
      to_date: input.to,
      days: input.days,
      reason: input.reason,
    }),
  }).then(async (res) => {
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      console.error('[submitLeaveRequest]', data?.error || 'Failed');
    } else if (data.leave) {
      // Replace optimistic entry with the real server-assigned id
      const idx = mockLeaveRequests.findIndex(r => r.id === optimistic.id);
      if (idx !== -1) mockLeaveRequests[idx] = rowToLeaveRequest(data.leave);
    }
  }).catch(e => console.error('[submitLeaveRequest]', e));

  return optimistic;
}

export async function approveLeaveRequest(leaveId: string, reviewerName: string): Promise<void> {
  const request = mockLeaveRequests.find(r => r.id === leaveId);
  if (!request || request.status !== 'Pending') return;

  request.status = 'Approved';
  request.reviewerName = reviewerName;
  request.reviewedAt = new Date().toISOString();

  const res = await apiFetch(`/api/leaves/${leaveId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'Approved' }),
  });
  if (!res.ok) {
    console.error('[approveLeaveRequest] failed to persist status');
    return;
  }

  // Deduct from balance
  const balances = await getEmployeeBalances(request.employeeId);
  const existing = balances.find(b => b.leave_type_name === request.type);
  const newUsed = (existing?.used ?? 0) + request.days;
  await updateEmployeeBalance(request.employeeId, request.type, existing?.total ?? 0, newUsed);
}

export async function rejectLeaveRequest(leaveId: string, reviewerName: string, comment: string): Promise<void> {
  const request = mockLeaveRequests.find(r => r.id === leaveId);
  if (!request || request.status !== 'Pending') return;

  request.status = 'Rejected';
  request.reviewerName = reviewerName;
  request.rejectionComment = comment;
  request.reviewedAt = new Date().toISOString();

  const res = await apiFetch(`/api/leaves/${leaveId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'Rejected', comment }),
  });
  if (!res.ok) {
    console.error('[rejectLeaveRequest] failed to persist status');
  }

  // Mark each working day in the rejected leave period as Absent in attendance
  // NOTE: updateAttendance still comes from attendance.ts, not yet converted

// ...

try {
    const start = new Date(request.from + 'T00:00:00');
    const end = new Date(request.to + 'T00:00:00');
    const cursor = new Date(start);
    while (cursor <= end) {
      const dateStr = cursor.toISOString().split('T')[0];
      if (!isWeekend(dateStr) && !isHoliday(dateStr)) {
        const dayEntries = await getAttendanceByDate(dateStr);
        const myEntry = dayEntries.find(e => e.employee_id === request.employeeId);
        if (myEntry) {
          const ledgerId = getEditableLedgerId(myEntry);
          await updateAttendance(
            ledgerId,
            { status: 'Absent' },
            `Leave rejected: ${comment || 'No reason provided'}`
          );
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  } catch (e) {
    console.error('[rejectLeaveRequest] attendance update failed', e);
  }
}
export let mockLeaveRequests: LeaveRequest[] = [];
export let mockLeaveBalances: LeaveBalance[] = [];