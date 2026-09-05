/**
 * EMPLOYEES SERVICE — MySQL (via PHP backend)
 * Converted from Supabase. See HANDOVER notes: Task 2 (Authentication)
 * not yet built, so login-account creation/deletion is stubbed — flagged below.
 */

import { apiFetch } from './httpClient';
import type { UserRole, FieldEmployeeLocation, LocationEntry, LatestLocation } from '../types';
import { API_URL } from '../config/api';
import { initEmployeeLeaveBalances } from './leaves';

export interface Employee {
  id: string;
  fullName: string;
  employeeId: string;
  username: string;
  personalEmail: string;
  phone: string;
  department: Department;
  designation?: string;
  reportingManager: string;
  reportingManagerId?: string;
  role: UserRole;
  tempPassword: string;
  createdAt: string;
  dob?: string;
  status: 'Active' | 'Inactive';
  variPoints: number;
  is_field_employee?: boolean;
  avatarUrl?: string;
  dateOfJoining: string;
  dateOfBirth?: string;
  uanNumber?: string;
  shiftStart?: string;
  shiftEnd?: string;
  optOutPF?: boolean;
  optOutPT?: boolean;
}

export type Department = string;

const DEFAULT_DEPARTMENTS = [
  'Finance', 'Sales', 'Operations', 'Ops Heads', 'Tech',
  'Digital Marketing', 'Management', 'Human Resources'
];

export function getDepartments(): string[] {
  const custom = JSON.parse(localStorage.getItem('eopms_custom_departments') || '[]');
  return Array.from(new Set([...DEFAULT_DEPARTMENTS, ...custom]));
}

export function addDepartment(name: string) {
  const custom = JSON.parse(localStorage.getItem('eopms_custom_departments') || '[]');
  if (!custom.includes(name) && !DEFAULT_DEPARTMENTS.includes(name)) {
    custom.push(name);
    localStorage.setItem('eopms_custom_departments', JSON.stringify(custom));
  }
}

export interface CreateEmployeeInput {
  fullName: string;
  employeeId: string;
  username: string;
  personalEmail: string;
  phone: string;
  department: Department;
  designation?: string;
  reportingManager: string;
  reportingManagerId?: string;
  role: UserRole;
  is_field_employee?: boolean;
  avatarUrl?: string;
  dateOfJoining: string;
  dateOfBirth?: string;
  uanNumber?: string;
  shiftStart?: string;
  shiftEnd?: string;
  optOutPF?: boolean;
  optOutPT?: boolean;
}

// ─── DB row ↔ domain mapper ──────────────────────────────────────────────────
// NOTE: MySQL TINYINT(1) columns come back as 0/1 numbers via PHP's JSON encode,
// not true booleans like Postgres gave us — wrapped in Boolean() below to fix.

function rowToEmployee(row: Record<string, unknown>): Employee {
  return {
    id: row.id as string,
    fullName: row.full_name as string,
    employeeId: row.employee_id as string,
    username: row.username as string,
    personalEmail: row.personal_email as string,
    phone: (row.phone as string) ?? '',
    department: row.department as Department,
    designation: (row.designation as string) ?? undefined,
    reportingManager: (row.reporting_manager as string) ?? '',
    reportingManagerId: (row.reporting_manager_id as string) ?? undefined,
    role: row.role as UserRole,
    tempPassword: (row.temp_password as string) ?? '',
    createdAt: row.created_at as string,
    status: row.status as 'Active' | 'Inactive',
    variPoints: (row.vari_points as number) ?? 0,
    is_field_employee: Boolean(row.is_field_employee),
    avatarUrl: (row.avatar_url as string) ?? '',
    shiftStart: (row.shift_start as string) ?? undefined,
    shiftEnd: (row.shift_end as string) ?? undefined,
    dateOfJoining: (row.date_of_joining as string) ?? new Date().toISOString().split('T')[0],
    dateOfBirth: (row.date_of_birth as string) ?? undefined,
    uanNumber: (row.uan_number as string) ?? undefined,
    optOutPF: Boolean(row.opt_out_pf),
    optOutPT: Boolean(row.opt_out_pt),
  };
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function getEmployees(): Promise<Employee[]> {
  try {
    const res = await apiFetch('/api/employees');
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      console.error('[getEmployees]', err?.error || res.statusText);
      return [];
    }
    const rows = await res.json();
    const employees = (rows ?? []).map(rowToEmployee);
    employees.sort((a: Employee, b: Employee) => {
      if (a.status !== b.status) return a.status.localeCompare(b.status);
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    return employees;
  } catch (e) {
    console.error('[getEmployees]', e);
    return [];
  }
}

function generateTempPassword(name: string): string {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
  const year = new Date().getFullYear();
  const rand = Math.floor(100 + Math.random() * 900);
  return `${initials}@${year}!${rand}`;
}

export async function createEmployee(input: CreateEmployeeInput): Promise<{
  success: boolean;
  employee: Employee | null;
  error: string | null;
  emailError?: string | null;
}> {
  if (!input.fullName || !input.employeeId || !input.personalEmail || !input.department) {
    return { success: false, employee: null, error: 'Missing required fields.' };
  }

  const tempPassword = generateTempPassword(input.fullName);

  let finalAvatarUrl = input.avatarUrl;
  if (!finalAvatarUrl) {
    finalAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(input.fullName)}&background=random`;
  }

  const res = await apiFetch('/api/employees', {
    method: 'POST',
    body: JSON.stringify({
      employeeId: input.employeeId,
      fullName: input.fullName,
      username: input.username,
      personalEmail: input.personalEmail,
      phone: input.phone,
      department: input.department,
      designation: input.designation,
      reportingManager: input.reportingManager,
      reportingManagerId: input.reportingManagerId,
      role: input.role,
      tempPassword,
      status: 'Active',
      variPoints: 0,
      isFieldEmployee: input.is_field_employee ?? false,
      avatarUrl: finalAvatarUrl,
      dateOfJoining: input.dateOfJoining,
      dateOfBirth: input.dateOfBirth,
      uanNumber: input.uanNumber,
      shiftStart: input.shiftStart,
      shiftEnd: input.shiftEnd,
      optOutPF: input.optOutPF ?? false,
      optOutPT: input.optOutPT ?? false,
    }),
  });

  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.success) {
    return { success: false, employee: null, error: result?.error || 'Failed to create employee.' };
  }

  await initEmployeeLeaveBalances(input.employeeId);

  let emailErrorMsg: string | null = null;
  try {
    const emailRes = await fetch(`${API_URL}/api/send-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: input.fullName,
        email: input.personalEmail,
        employeeId: input.employeeId,
        tempPassword,
      }),
    });
    const emailResult = await emailRes.json().catch(() => null);
    if (!emailResult?.success) {
      emailErrorMsg = emailResult?.error || 'Failed to send welcome email.';
      console.error('[Email]', emailErrorMsg);
    }
  } catch (e: any) {
    emailErrorMsg = e.message;
    console.error('[Email Exception]', e);
  }

  return {
    success: true,
    employee: result.employee ? rowToEmployee(result.employee) : null,
    error: null,
    emailError: emailErrorMsg,
  };
}

export async function updateEmployee(
  id: string,
  updates: Partial<Employee>
): Promise<{ success: boolean; employee: Employee | null; error: string | null }> {
  const body: Record<string, unknown> = {};
  if (updates.fullName !== undefined) body.fullName = updates.fullName;
  if (updates.department !== undefined) body.department = updates.department;
  if (updates.designation !== undefined) body.designation = updates.designation;
  if (updates.reportingManager !== undefined) body.reportingManager = updates.reportingManager;
  if (updates.phone !== undefined) body.phone = updates.phone;
  if (updates.department !== undefined) body.department = updates.department;
  if (updates.reportingManager !== undefined) body.reportingManager = updates.reportingManager;
  if (updates.reportingManagerId !== undefined) body.reportingManagerId = updates.reportingManagerId;
  if (updates.role !== undefined) body.role = updates.role;
  if (updates.status !== undefined) body.status = updates.status;
  if (updates.variPoints !== undefined) body.variPoints = updates.variPoints;
  if (updates.is_field_employee !== undefined) body.isFieldEmployee = updates.is_field_employee;
  if (updates.avatarUrl !== undefined) body.avatarUrl = updates.avatarUrl;
  if (updates.shiftStart !== undefined) body.shiftStart = updates.shiftStart;
  if (updates.shiftEnd !== undefined) body.shiftEnd = updates.shiftEnd;
  if (updates.dateOfBirth !== undefined) body.dateOfBirth = updates.dateOfBirth;
  if (updates.uanNumber !== undefined) body.uanNumber = updates.uanNumber;
  if (updates.dateOfJoining !== undefined) body.dateOfJoining = updates.dateOfJoining;
  if (updates.optOutPF !== undefined) body.optOutPF = updates.optOutPF;
  if (updates.optOutPT !== undefined) body.optOutPT = updates.optOutPT;

  const res = await apiFetch(`/api/employees/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.success) {
    return { success: false, employee: null, error: result?.error || 'Failed to update employee.' };
  }
  return { success: true, employee: result.employee ? rowToEmployee(result.employee) : null, error: null };
}

export async function deleteEmployee(id: string): Promise<{ success: boolean; error: string | null }> {
  const res = await apiFetch(`/api/employees/${id}`, { method: 'DELETE' });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.success) {
    return { success: false, error: result?.error || 'Failed to delete employee.' };
  }
  return { success: true, error: null };
}

export async function updateFieldStatus(
  employeeId: string,
  isField: boolean
): Promise<{ success: boolean; error: string | null }> {
  const res = await apiFetch(`/api/employees/${employeeId}`, {
    method: 'PUT',
    body: JSON.stringify({ isFieldEmployee: isField }),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.success) {
    return { success: false, error: result?.error || 'Failed to update field status.' };
  }
  return { success: true, error: null };
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const todayAt = (h: number, min: number) => {
  const d = new Date();
  d.setHours(h, min, 0, 0);
  return d.toISOString();
};

export const mockFieldLocations: FieldEmployeeLocation[] = [
  { employeeId: 'VAR-031', employeeName: 'Rohan Deshmukh', department: 'Sales', lat: 12.9716, lng: 77.5946, accuracy: 8, batteryLevel: 82, status: 'Active', lastUpdated: minutesAgo(2), todayCheckIn: todayAt(9, 5), distanceTravelledKm: 14.2, routeHistory: [[12.9352, 77.6245], [12.9451, 77.6100], [12.9716, 77.5946]] },
  { employeeId: 'VAR-032', employeeName: 'Kavya Iyer', department: 'Operations', lat: 12.9345, lng: 77.5820, accuracy: 12, batteryLevel: 57, status: 'Active', lastUpdated: minutesAgo(5), todayCheckIn: todayAt(8, 50), distanceTravelledKm: 9.8, routeHistory: [[12.9081, 77.6010], [12.9345, 77.5820]] },
  { employeeId: 'VAR-033', employeeName: 'Mohammed Faisal', department: 'Sales', lat: 13.0067, lng: 77.5890, accuracy: 25, batteryLevel: 31, status: 'Idle', lastUpdated: minutesAgo(24), todayCheckIn: todayAt(9, 30), distanceTravelledKm: 21.5, routeHistory: [[12.9716, 77.5946], [13.0067, 77.5890]] },
];

export async function logLocation(data: Omit<LocationEntry, 'id' | 'employeeId'>): Promise<void> {
  try {
    await apiFetch('/api/employees/location', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  } catch {}
}

export async function getLatestLocations(): Promise<LatestLocation[]> {
  try {
    const res = await apiFetch('/api/employees/locations');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function getLocationHistory(employeeId: string, from: Date, to: Date): Promise<LocationEntry[]> {
  try {
    const res = await apiFetch(`/api/employees/locations?history=true&employeeId=${employeeId}&from=${from.toISOString()}&to=${to.toISOString()}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function getFieldLocations(): Promise<FieldEmployeeLocation[]> {
  const employees = await getEmployees();
  const fieldStaff = employees.filter(e => e.department === 'Sales' || e.department === 'Operations');
  if (fieldStaff.length === 0) return [];
  return fieldStaff.map((emp, index) => {
    const mockLoc = mockFieldLocations[index % mockFieldLocations.length];
    return { ...mockLoc, employeeId: emp.employeeId, employeeName: emp.fullName, department: emp.department, routeHistory: [...mockLoc.routeHistory] };
  });
}

export function updateFieldLocation(employeeId: string, patch: Partial<FieldEmployeeLocation>): void {
  const index = mockFieldLocations.findIndex(l => l.employeeId === employeeId);
  if (index === -1) return;
  mockFieldLocations[index] = { ...mockFieldLocations[index], ...patch };
}

export async function getFieldEmployees(): Promise<Employee[]> {
  const employees = await getEmployees();
  return employees.filter(e => e.is_field_employee);
}

export const mockActivityLog: { timestamp: string; action: string; by: string; details: string }[] = [];
export let mockEmployeeStore: Employee[] = [];
getEmployees().then(emps => { mockEmployeeStore.splice(0, mockEmployeeStore.length, ...emps); });

export async function sendRecoveryEmail(employee: Employee): Promise<{ success: boolean; error: string | null }> {
  try {
    const emailRes = await fetch(`${API_URL}/api/send-credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: employee.fullName,
        email: employee.personalEmail,
        employeeId: employee.employeeId,
        tempPassword: employee.tempPassword || '(contact HR for your temporary password)',
      }),
    });
    const result = await emailRes.json().catch(() => null);
    if (!result?.success) {
      return { success: false, error: result?.error || 'Failed to send recovery email.' };
    }
    return { success: true, error: null };
  } catch (e: any) {
    console.error('[Email Exception]', e);
    return { success: false, error: e.message };
  }
}