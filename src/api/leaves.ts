/**
 * MOCK LEAVE MANAGEMENT SERVICE
 *
 * Mirrors the pattern in src/api/employees.ts — in-memory stores that act as
 * the DB until Supabase is connected.
 */

import type { LeaveRequest, LeaveBalance } from '../types';

// ─── Leave balances (one entry per employee in mockEmployeeStore) ────────────

export const mockLeaveBalances: LeaveBalance[] = [
  {
    employeeId: '2', // sathvik (the logged-in Employee)
    casual:  { total: 12, used: 5 },
    sick:    { total: 10, used: 3 },
    earned:  { total: 15, used: 6 },
    unpaidTaken: 2,
  },
  {
    employeeId: '2131', // akash kumar (Admin)
    casual:  { total: 12, used: 2 },
    sick:    { total: 10, used: 1 },
    earned:  { total: 15, used: 4 },
    unpaidTaken: 0,
  },
  {
    employeeId: 'VAR-003', // Priya Sharma (HR)
    casual:  { total: 12, used: 4 },
    sick:    { total: 10, used: 2 },
    earned:  { total: 15, used: 3 },
    unpaidTaken: 0,
  },
  {
    employeeId: 'VAR-005', // Ravi Kumar (HR)
    casual:  { total: 12, used: 1 },
    sick:    { total: 10, used: 0 },
    earned:  { total: 15, used: 2 },
    unpaidTaken: 1,
  },
  {
    employeeId: 'VAR-031', // Rohan Deshmukh (Field)
    casual:  { total: 12, used: 6 },
    sick:    { total: 10, used: 2 },
    earned:  { total: 15, used: 5 },
    unpaidTaken: 0,
  },
  {
    employeeId: 'VAR-032', // Kavya Iyer (Field)
    casual:  { total: 12, used: 3 },
    sick:    { total: 10, used: 4 },
    earned:  { total: 15, used: 1 },
    unpaidTaken: 0,
  },
  {
    employeeId: 'VAR-033', // Mohammed Faisal (Field)
    casual:  { total: 12, used: 7 },
    sick:    { total: 10, used: 1 },
    earned:  { total: 15, used: 8 },
    unpaidTaken: 3,
  },
  {
    employeeId: 'VAR-034', // Sneha Reddy (Field)
    casual:  { total: 12, used: 2 },
    sick:    { total: 10, used: 0 },
    earned:  { total: 15, used: 4 },
    unpaidTaken: 0,
  },
  {
    employeeId: 'VAR-035', // Arjun Nair (Field)
    casual:  { total: 12, used: 5 },
    sick:    { total: 10, used: 3 },
    earned:  { total: 15, used: 0 },
    unpaidTaken: 1,
  },
];

// ─── Leave requests ───────────────────────────────────────────────────────────

export const mockLeaveRequests: LeaveRequest[] = [
  {
    id: 'LV-0044',
    employeeId: '2',
    employeeName: 'sathvik',
    type: 'Casual',
    from: '2026-07-03',
    to: '2026-07-03',
    days: 1,
    reason: 'Bank work',
    status: 'Pending',
    submittedAt: '2026-07-01T09:00:00Z',
  },
  {
    id: 'LV-0033',
    employeeId: '2',
    employeeName: 'sathvik',
    type: 'Sick',
    from: '2026-06-10',
    to: '2026-06-14',
    days: 5,
    reason: 'Family vacation to Goa',
    status: 'Pending',
    submittedAt: '2026-06-05T11:30:00Z',
  },
  {
    id: 'LV-0018',
    employeeId: '2',
    employeeName: 'sathvik',
    type: 'Sick',
    from: '2026-05-04',
    to: '2026-05-05',
    days: 2,
    reason: 'Viral fever, doctor advised rest',
    status: 'Approved',
    reviewerName: 'Priya Menon (Ops Head)',
    submittedAt: '2026-05-04T08:10:00Z',
    reviewedAt: '2026-05-04T10:45:00Z',
  },
  {
    id: 'LV-0096',
    employeeId: '2',
    employeeName: 'sathvik',
    type: 'Casual',
    from: '2026-04-18',
    to: '2026-04-18',
    days: 1,
    reason: 'Personal errand',
    status: 'Rejected',
    reviewerName: 'Rahul Shah (Ops Head)',
    rejectionComment: 'Quarter close week – please reschedule',
    submittedAt: '2026-04-15T09:20:00Z',
    reviewedAt: '2026-04-16T12:00:00Z',
  },
  {
    id: 'LV-0043',
    employeeId: '2',
    employeeName: 'sathvik',
    type: 'Casual',
    from: '2026-03-28',
    to: '2026-03-30',
    days: 3,
    reason: "Cousin's wedding",
    status: 'Approved',
    reviewerName: 'Priya Menon',
    submittedAt: '2026-03-20T15:00:00Z',
    reviewedAt: '2026-03-21T09:30:00Z',
  },
  {
    id: 'LV-0017',
    employeeId: '2',
    employeeName: 'sathvik',
    type: 'Sick',
    from: '2026-02-12',
    to: '2026-02-12',
    days: 1,
    reason: 'Migraine',
    status: 'Approved',
    reviewerName: 'Priya Menon',
    submittedAt: '2026-02-12T07:45:00Z',
    reviewedAt: '2026-02-12T09:00:00Z',
  },
  {
    id: 'LV-0051',
    employeeId: 'VAR-003',
    employeeName: 'Priya Sharma',
    type: 'Earned',
    from: '2026-07-13',
    to: '2026-07-15',
    days: 3,
    reason: 'Trip to Kerala with family',
    status: 'Pending',
    submittedAt: '2026-06-30T10:15:00Z',
  },
  {
    id: 'LV-0029',
    employeeId: 'VAR-003',
    employeeName: 'Priya Sharma',
    type: 'Casual',
    from: '2026-05-22',
    to: '2026-05-22',
    days: 1,
    reason: 'School admission for daughter',
    status: 'Approved',
    reviewerName: 'Admin',
    submittedAt: '2026-05-18T14:00:00Z',
    reviewedAt: '2026-05-19T09:10:00Z',
  },
];

// ─── Indian public holidays 2026 ─────────────────────────────────────────────

export const INDIA_HOLIDAYS_2026: string[] = [
  '2026-01-26', // Republic Day
  '2026-03-25', // Holi
  '2026-04-02', // Good Friday
  '2026-04-14', // Dr. Ambedkar Jayanti
  '2026-04-29', // Eid ul-Fitr (approx)
  '2026-06-06', // Eid ul-Adha (approx)
  '2026-08-15', // Independence Day
  '2026-10-02', // Gandhi Jayanti
  '2026-10-22', // Dussehra (approx)
  '2026-11-11', // Diwali (approx)
  '2026-12-25', // Christmas
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function isWeekend(isoDate: string): boolean {
  const day = new Date(`${isoDate}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

export function isHoliday(isoDate: string): boolean {
  return INDIA_HOLIDAYS_2026.includes(isoDate);
}

// Calculate working days between two dates (exclude weekends and public holidays)
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

// Get leave balance for an employee
export function getLeaveBalance(employeeId: string): LeaveBalance | undefined {
  return mockLeaveBalances.find(b => b.employeeId === employeeId);
}

// Get all leave requests (optionally filtered by employeeId)
export function getLeaveRequests(employeeId?: string): LeaveRequest[] {
  const list = employeeId
    ? mockLeaveRequests.filter(r => r.employeeId === employeeId)
    : mockLeaveRequests;
  return [...list];
}

let leaveIdCounter = 100;

// Submit a new leave request — adds to mockLeaveRequests, deducts nothing until approved
export function submitLeaveRequest(input: Omit<LeaveRequest, 'id' | 'status' | 'submittedAt'>): LeaveRequest {
  const newRequest: LeaveRequest = {
    ...input,
    id: `LV-${String(leaveIdCounter++).padStart(4, '0')}`,
    status: 'Pending',
    submittedAt: new Date().toISOString(),
  };
  mockLeaveRequests.unshift(newRequest);
  return newRequest;
}

// Approve a leave request — updates status, sets reviewerName, deducts from balance
export function approveLeaveRequest(leaveId: string, reviewerName: string): void {
  const request = mockLeaveRequests.find(r => r.id === leaveId);
  if (!request || request.status !== 'Pending') return;

  request.status = 'Approved';
  request.reviewerName = reviewerName;
  request.reviewedAt = new Date().toISOString();

  const balance = getLeaveBalance(request.employeeId);
  if (!balance) return;
  switch (request.type) {
    case 'Casual': balance.casual.used += request.days; break;
    case 'Sick': balance.sick.used += request.days; break;
    case 'Earned': balance.earned.used += request.days; break;
    case 'Unpaid': balance.unpaidTaken += request.days; break;
  }
}

// Reject a leave request — updates status, requires a comment
export function rejectLeaveRequest(leaveId: string, reviewerName: string, comment: string): void {
  const request = mockLeaveRequests.find(r => r.id === leaveId);
  if (!request || request.status !== 'Pending') return;

  request.status = 'Rejected';
  request.reviewerName = reviewerName;
  request.rejectionComment = comment;
  request.reviewedAt = new Date().toISOString();
}
