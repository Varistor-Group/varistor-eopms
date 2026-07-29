/**
 * ATTENDANCE SERVICE — MySQL (via PHP backend)
 * Converted from a hybrid mock/Supabase file. The fake seeded-random data
 * generator is GONE ENTIRELY — missing records now honestly show as
 * Absent/W.O/Holiday based on real data, never fabricated.
 *
 * Door biometric device (Task 4) stays on hold — self-punch button
 * (punchSelf/getPunchStatus) is the real attendance capture mechanism now.
 */

import { apiFetch } from './httpClient';
import { getEmployees } from './employees';
import type { Employee } from './employees';

// ─── Types ─────────────────────────────────────────────────────────────────

export type AttendanceStatus =
  | 'Present' | 'Late' | 'Half-day' | 'Holiday' | 'W.O' | 'Leave' | 'Absent';

export type AttendanceSource = 'device' | 'field_photo' | 'hr_override' | 'self_punch' | 'none';
export type PunchType = 'in' | 'out';
export type VerificationStatus = 'Pending' | 'Verified' | 'Rejected';
export type HolidayType = 'National' | 'Festival' | 'Optional';

export interface AttendanceLedgerEntry {
  id: string | null; // null = no real record for this date (honest gap, not fabricated)
  employee_id: string;
  employeeName: string;
  department: string;
  date: string;
  punch_in?: string;
  punch_out?: string;
  work_hours?: number;
  status: AttendanceStatus;
  source: AttendanceSource;
  confidence?: number;
  photo_url?: string;
  override_reason?: string;
  editor_id?: string;
  edited_at?: string;
  created_at: string | null;
  is_field_employee: boolean;
}

export interface AttendanceEdit {
  id: string;
  ledger_id: string;
  employee_id: string;
  editor_id: string;
  old_punch_in?: string;
  old_punch_out?: string;
  old_status: string;
  new_punch_in?: string;
  new_punch_out?: string;
  new_status: string;
  reason: string;
  edited_at: string;
}

export interface MonthlyReportRow {
  employee_id: string;
  employeeName: string;
  department: string;
  present: number;
  late: number;
  leaves: number;
  weekOff: number;
  holidays: number;
  halfDay: number;
  absent: number;
  totalHrs: number;
  payableDays: number;
  workingDays: number;
  dailyRecords: { date: string; punch_in?: string; punch_out?: string; work_hours?: number; status?: string }[];
}

export interface Holiday {
  id: string;
  date: string;
  occasion: string;
  type: HolidayType;
  apply_to_all: boolean;
  created_by?: string;
  created_at: string;
}

export interface HolidayInput {
  date: string;
  occasion: string;
  type: HolidayType;
  apply_to_all: boolean;
}

export interface FieldPhotoEntry {
  id: string;
  employee_id: string;
  employeeName: string;
  department: string;
  date: string;
  photo_url: string;
  uploaded_at: string;
  punch_type: PunchType;
  verification_status: VerificationStatus;
  verified_by?: string;
  verified_at?: string;
  confidence_score?: number;
  latitude?: number;
  longitude?: number;
  location_accuracy?: number;
  punch_time?: string;
}

export interface PayrollAttendanceRow {
  employee_id: string;
  employeeName: string;
  payableDays: number;
  workingDays: number;
  totalHrs: number;
}

export interface DeviceStatus {
  ipAddress: string;
  enrolledFaces: number;
  lastSync: string | null;
  firmware: string;
  uptime: string;
  online: boolean;
}

export interface LivePunchEvent {
  id: string;
  timestamp: string;
  employeeId: string;
  employeeName: string;
  type: 'in' | 'out';
  confidence: number;
  success: boolean;
}

export interface RosterEmployee {
  id: string;
  name: string;
  dept: string;
  isField: boolean;
  shiftStart?: string;
  shiftEnd?: string;
}

export type DayCode = 'P' | 'L' | 'A' | 'H' | 'WO' | 'HD' | '-';

export interface DayRecord {
  date: string;
  code: DayCode;
  status: AttendanceStatus;
  isLeavePaidOut: boolean;
}

export interface EmployeeYearlyReport {
  employee_id: string;
  employeeName: string;
  department: string;
  year: string;
  months: { month: string; monthLabel: string; days: DayRecord[] }[];
  totals: {
    present: number;
    paidLeave: number;
    unpaidLeave: number;
    absent: number;
    holidays: number;
    weekOff: number;
    halfDay: number;
    totalLeaveBalance: number;
    usedLeaveBalance: number;
  };
}

export interface EmployeeYearlySummary {
  employee_id: string;
  employeeName: string;
  department: string;
  present: number;
  paidLeave: number;
  unpaidLeave: number;
  absent: number;
  holidays: number;
  weekOff: number;
  halfDay: number;
}

export interface PunchStatus {
  punchedIn: boolean;
  punchedOut: boolean;
  record: { id: string; punch_in: string; punch_out: string | null; status: string } | null;
}

// ─── Roster ──────────────────────────────────────────────────────────────

let _cachedRoster: RosterEmployee[] | null = null;

export async function fetchAttendanceRoster(): Promise<RosterEmployee[]> {
  if (!_cachedRoster) {
    const emps = await getEmployees();
    _cachedRoster = emps
      .filter((e: Employee) => e.status !== 'Inactive')
      .map((e: Employee) => ({
        id: e.employeeId,
        name: e.fullName,
        dept: e.department,
        isField: !!e.is_field_employee,
        shiftStart: e.shiftStart,
        shiftEnd: e.shiftEnd,
      }));
  }
  return _cachedRoster;
}

// ─── Ledger ──────────────────────────────────────────────────────────────

export async function getAttendanceByDate(date: string): Promise<AttendanceLedgerEntry[]> {
  try {
    const res = await apiFetch(`/api/attendance-ledger/date/${date}`);
    if (!res.ok) { console.error('[getAttendanceByDate]', res.statusText); return []; }
    return await res.json();
  } catch (err) {
    console.error('[getAttendanceByDate]', err);
    return [];
  }
}

export async function getAttendanceByEmployee(employeeId: string, month: string): Promise<AttendanceLedgerEntry[]> {
  try {
    const res = await apiFetch(`/api/attendance-ledger/employee/${employeeId}/${month}`);
    if (!res.ok) { console.error('[getAttendanceByEmployee]', res.statusText); return []; }
    return await res.json();
  } catch (err) {
    console.error('[getAttendanceByEmployee]', err);
    return [];
  }
}

/**
 * Given a ledger entry (possibly with id === null, meaning no real record
 * exists yet for that day), returns the string to pass as ledgerId into
 * updateAttendance — either the real id, or the "new:employeeId:date"
 * sentinel the backend uses to create a fresh row.
 */
export function getEditableLedgerId(entry: AttendanceLedgerEntry): string {
  return entry.id ?? `new:${entry.employee_id}:${entry.date}`;
}

/**
 * HR/Admin edit. editorId is no longer a parameter — the server derives the
 * editor from the auth token, never trusted from the client.
 */
export async function updateAttendance(
  ledgerId: string,
  updates: { punch_in?: string; punch_out?: string; status?: AttendanceStatus },
  reason: string
): Promise<{ success: boolean; error: string | null }> {
  if (!reason.trim()) {
    return { success: false, error: 'Reason is required for attendance edits.' };
  }
  try {
    const res = await apiFetch(`/api/attendance-ledger/${ledgerId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...updates, reason }),
    });
    const result = await res.json().catch(() => null);
    if (!res.ok || !result?.success) return { success: false, error: result?.error || 'Failed to update attendance.' };
    return { success: true, error: null };
  } catch (err: any) {
    console.error('[updateAttendance]', err);
    return { success: false, error: err.message || 'Failed to update attendance.' };
  }
}

// ─── Monthly Report ──────────────────────────────────────────────────────

export async function getMonthlyReport(month: string, employeeIds?: string[]): Promise<MonthlyReportRow[]> {
  try {
    const query = employeeIds && employeeIds.length > 0 ? `?employeeIds=${employeeIds.join(',')}` : '';
    const res = await apiFetch(`/api/attendance-monthly-report/${month}${query}`);
    if (!res.ok) { console.error('[getMonthlyReport]', res.statusText); return []; }
    return await res.json();
  } catch (err) {
    console.error('[getMonthlyReport]', err);
    return [];
  }
}

export async function getPayrollAttendanceSnapshot(month: string): Promise<PayrollAttendanceRow[]> {
  const report = await getMonthlyReport(month);
  return report.map(r => ({
    employee_id: r.employee_id,
    employeeName: r.employeeName,
    payableDays: r.payableDays,
    workingDays: r.workingDays,
    totalHrs: r.totalHrs,
  }));
}

// ─── Holidays ────────────────────────────────────────────────────────────

export async function getHolidays(year: string): Promise<Holiday[]> {
  try {
    const res = await apiFetch(`/api/holidays/${year}`);
    if (!res.ok) { console.error('[getHolidays]', res.statusText); return []; }
    return await res.json();
  } catch (err) {
    console.error('[getHolidays]', err);
    return [];
  }
}

/** createdBy is no longer a parameter — server derives it from the auth token. */
export async function addHoliday(data: HolidayInput): Promise<{ success: boolean; error: string | null }> {
  const res = await apiFetch('/api/holidays', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result) return { success: false, error: result?.error || 'Failed to add holiday.' };
  return { success: true, error: null };
}

/** New — didn't exist in the original file, endpoint was added during conversion. */
export async function deleteHoliday(holidayId: string): Promise<{ success: boolean; error: string | null }> {
  const res = await apiFetch(`/api/holidays/${holidayId}`, { method: 'DELETE' });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.success) return { success: false, error: result?.error || 'Failed to delete holiday.' };
  return { success: true, error: null };
}

// ─── Self-Punch (replaces door device for now) ──────────────────────────

export async function getPunchStatus(): Promise<PunchStatus> {
  try {
    const res = await apiFetch('/api/attendance/punch/status');
    if (!res.ok) return { punchedIn: false, punchedOut: false, record: null };
    return await res.json();
  } catch {
    return { punchedIn: false, punchedOut: false, record: null };
  }
}

export async function punchSelf(): Promise<{ success: boolean; type?: 'in' | 'out'; time?: string; status?: string; workHours?: number; error?: string }> {
  try {
    const res = await apiFetch('/api/attendance/punch', { method: 'POST' });
    const result = await res.json().catch(() => null);
    if (!res.ok || !result?.success) return { success: false, error: result?.error || 'Punch failed.' };
    return result;
  } catch (err: any) {
    return { success: false, error: err.message || 'Punch failed.' };
  }
}

// ─── Attendance Settings ─────────────────────────────────────────────────

export async function getAttendanceSettings(): Promise<Record<string, string>> {
  try {
    const res = await apiFetch('/api/attendance-settings');
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

export async function updateAttendanceSetting(key: string, value: string): Promise<{ success: boolean; error: string | null }> {
  const res = await apiFetch(`/api/attendance-settings/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.success) return { success: false, error: result?.error || 'Failed to update setting.' };
  return { success: true, error: null };
}

// ─── Field Attendance ────────────────────────────────────────────────────

/**
 * employeeId and date are no longer parameters — the server derives the
 * employee from the auth token and always uses today's date, same hardening
 * pattern as the rest of this conversion.
 */
export async function uploadFieldPhoto(
  punchType: PunchType,
  file: File,
  confidenceScore?: number,
  location?: { lat: number; lng: number; accuracy: number }
): Promise<{ success: boolean; photoUrl?: string; error: string | null }> {
  try {
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('punchType', punchType);
    if (confidenceScore !== undefined) formData.append('confidenceScore', String(confidenceScore));
    if (location) {
      formData.append('lat', String(location.lat));
      formData.append('lng', String(location.lng));
      formData.append('accuracy', String(location.accuracy));
    }

    const res = await apiFetch('/api/attendance/field-punch', {
      method: 'POST',
      body: formData,
      isMultipart: true,
    });
    const result = await res.json().catch(() => null);
    if (!res.ok || !result?.success) return { success: false, error: result?.error || 'Upload failed.' };
    return { success: true, photoUrl: result.photoUrl, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Upload failed.' };
  }
}

/** No longer takes employeeId — always checks the logged-in employee's own status. */
export async function isFieldEmployeePunchedIn(): Promise<boolean> {
  try {
    const res = await apiFetch('/api/attendance/field-punch/status');
    if (!res.ok) return false;
    const data = await res.json();
    return !!data?.punchedIn;
  } catch {
    return false;
  }
}

export async function getFieldPendingVerifications(): Promise<FieldPhotoEntry[]> {
  try {
    const res = await apiFetch('/api/attendance/field-photos/pending');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/** verifiedBy is no longer a parameter — server derives it from the auth token. */
export async function verifyFieldPhoto(
  photoId: string,
  status: 'Verified' | 'Rejected'
): Promise<{ success: boolean; error: string | null }> {
  try {
    const res = await apiFetch('/api/attendance/field-photos/verify', {
      method: 'POST',
      body: JSON.stringify({ photoId, status }),
    });
    const result = await res.json().catch(() => null);
    if (!res.ok || !result?.success) return { success: false, error: result?.error || 'Failed to verify photo.' };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to verify photo.' };
  }
}

export async function getFieldAttendanceHistory(): Promise<FieldPhotoEntry[]> {
  try {
    const res = await apiFetch('/api/field-attendance-history');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// ─── Device Bridge (stub — door device stays on hold) ───────────────────

export async function getDeviceStatus(): Promise<DeviceStatus> {
  try {
    const res = await apiFetch('/api/attendance/device-status');
    if (!res.ok) throw new Error('Bridge unreachable');
    return await res.json();
  } catch {
    return {
      ipAddress: '192.168.1.42',
      enrolledFaces: 0,
      lastSync: null,
      firmware: 'N/A (device offline)',
      uptime: '—',
      online: false,
    };
  }
}

export async function getLivePunchFeed(): Promise<LivePunchEvent[]> {
  try {
    const res = await apiFetch('/api/attendance/live-feed');
    if (!res.ok) throw new Error('Bridge unreachable');
    return await res.json();
  } catch {
    return [];
  }
}

export async function forceDeviceResync(): Promise<{ success: boolean; error: string | null }> {
  try {
    const res = await apiFetch('/api/attendance/force-resync', { method: 'POST' });
    if (!res.ok) throw new Error('Resync failed');
    return { success: true, error: null };
  } catch {
    return { success: false, error: 'Device bridge unreachable.' };
  }
}

// ─── Audit Trail ─────────────────────────────────────────────────────────

export async function getAttendanceEdits(): Promise<AttendanceEdit[]> {
  try {
    const res = await apiFetch('/api/attendance-edits');
    if (!res.ok) { console.error('[getAttendanceEdits]', res.statusText); return []; }
    return await res.json();
  } catch (err) {
    console.error('[getAttendanceEdits]', err);
    return [];
  }
}

// ─── Yearly Reports ──────────────────────────────────────────────────────

/**
 * leaveBalances is no longer a parameter — the server computes the real
 * remaining balance from employee_leave_balances instead of trusting
 * client-supplied numbers.
 */
export async function getYearlyAttendanceReport(year: string, employeeId: string): Promise<EmployeeYearlyReport | null> {
  try {
    const res = await apiFetch(`/api/attendance-yearly-report/${year}/${employeeId}`);
    if (!res.ok) { console.error('[getYearlyAttendanceReport]', res.statusText); return null; }
    return await res.json();
  } catch (err) {
    console.error('[getYearlyAttendanceReport]', err);
    return null;
  }
}

export async function getEmployeeYearlySummaries(year: string): Promise<EmployeeYearlySummary[]> {
  try {
    const res = await apiFetch(`/api/attendance-yearly-summary/${year}`);
    if (!res.ok) { console.error('[getEmployeeYearlySummaries]', res.statusText); return []; }
    return await res.json();
  } catch (err) {
    console.error('[getEmployeeYearlySummaries]', err);
    return [];
  }
}