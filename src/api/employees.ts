/**
 * EMPLOYEES SERVICE — Supabase
 * Replaces the localStorage-backed mock store.
 */

import { supabase } from '../lib/supabase';
import type { UserRole, FieldEmployeeLocation, LocationEntry, LatestLocation } from '../types';

export interface Employee {
  id: string;
  fullName: string;
  employeeId: string;
  username: string;
  personalEmail: string;
  phone: string;
  department: Department;
  reportingManager: string;
  role: UserRole;
  tempPassword: string;
  createdAt: string;
  status: 'Active' | 'Inactive';
  variPoints: number;
  is_field_employee?: boolean;
  avatarUrl?: string;
}

export type Department =
  | 'Finance'
  | 'Sales'
  | 'Operations'
  | 'Ops Heads'
  | 'Tech'
  | 'Digital Marketing'
  | 'Management'
  | 'Human Resources';

export interface CreateEmployeeInput {
  fullName: string;
  employeeId: string;
  username: string;
  personalEmail: string;
  phone: string;
  department: Department;
  reportingManager: string;
  role: UserRole;
  is_field_employee?: boolean;
  avatarUrl?: string;
}

// ─── DB row ↔ domain mapper ──────────────────────────────────────────────────

function rowToEmployee(row: Record<string, unknown>): Employee {
  return {
    id: row.id as string,
    fullName: row.full_name as string,
    employeeId: row.employee_id as string,
    username: row.username as string,
    personalEmail: row.personal_email as string,
    phone: (row.phone as string) ?? '',
    department: row.department as Department,
    reportingManager: (row.reporting_manager as string) ?? '',
    role: row.role as UserRole,
    tempPassword: (row.temp_password as string) ?? '',
    createdAt: row.created_at as string,
    status: row.status as 'Active' | 'Inactive',
    variPoints: (row.vari_points as number) ?? 0,
    is_field_employee: (row.is_field_employee as boolean) ?? false,
    avatarUrl: (row.avatar_url as string) ?? '',
  };
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function getEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[getEmployees]', error.message);
    return [];
  }
  return (data ?? []).map(rowToEmployee);
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

  const { data: rpcData, error: rpcError } = await supabase.rpc('create_employee_with_auth', {
    p_employee_id: input.employeeId,
    p_full_name: input.fullName,
    p_username: input.username,
    p_personal_email: input.personalEmail,
    p_phone: input.phone,
    p_department: input.department,
    p_reporting_manager: input.reportingManager,
    p_role: input.role,
    p_temp_password: tempPassword,
    p_is_field_employee: input.is_field_employee ?? false,
    p_avatar_url: input.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(input.fullName)}&background=84CC16&color=fff&size=200&bold=true`,
  });

  if (rpcError) {
    return { success: false, employee: null, error: rpcError.message };
  }

  // The RPC returns a JSON object. We typecast it to check success.
  const result = rpcData as unknown as { success: boolean; error?: string; employee_id?: string };
  
  if (!result.success) {
    return { success: false, employee: null, error: result.error || 'Failed to create employee.' };
  }

  // Fetch the newly created employee row to return it
  const { data: empRow } = await supabase
    .from('employees')
    .select('*')
    .eq('id', input.employeeId)
    .single();

  // Create leave balance entry
  await supabase.from('leave_balances').insert({ employee_id: input.employeeId });

  // Log activity
  await supabase.from('activity_log').insert({
    action: 'CREATE_EMPLOYEE',
    performed_by: input.employeeId,
    details: `Created employee ${input.fullName} (${input.employeeId})`,
  });

  let emailErrorMsg: string | null = null;
  const resendApiKey = import.meta.env.VITE_RESEND_API_KEY;

  if (resendApiKey) {
    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: input.personalEmail,
          subject: 'Welcome to Varistor EOPMS - Your Login Credentials',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
              <div style="background-color: #84CC16; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0;">Welcome to Varistor EOPMS!</h1>
              </div>
              <div style="padding: 20px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
                <p>Hi ${input.fullName},</p>
                <p>Your account has been successfully created. Here are your login credentials:</p>
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0;">
                  <p style="margin: 0 0 10px 0;"><strong>Username:</strong> ${input.username}</p>
                  <p style="margin: 0 0 10px 0;"><strong>Employee ID:</strong> ${input.employeeId}</p>
                  <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #eee; padding: 2px 6px; border-radius: 3px;">${tempPassword}</code></p>
                </div>
                <p>Please log in using the app URL and change your password as soon as possible.</p>
              </div>
            </div>
          `
        })
      });

      if (!emailRes.ok) {
        const errData = await emailRes.json().catch(() => null);
        emailErrorMsg = errData?.message || 'Failed to send welcome email via Resend API.';
        console.error('[Resend Error]', errData);
      }
    } catch (e: any) {
      emailErrorMsg = e.message;
      console.error('[Resend Exception]', e);
    }
  } else {
      emailErrorMsg = 'VITE_RESEND_API_KEY is not configured in .env.';
  }

  return { success: true, employee: empRow ? rowToEmployee(empRow) : null, error: null, emailError: emailErrorMsg };
}

export async function updateEmployee(
  id: string,
  updates: Partial<Employee>
): Promise<{ success: boolean; employee: Employee | null; error: string | null }> {
  const { data, error } = await supabase
    .from('employees')
    .update({
      ...(updates.fullName !== undefined && { full_name: updates.fullName }),
      ...(updates.phone !== undefined && { phone: updates.phone }),
      ...(updates.department !== undefined && { department: updates.department }),
      ...(updates.reportingManager !== undefined && { reporting_manager: updates.reportingManager }),
      ...(updates.role !== undefined && { role: updates.role }),
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.variPoints !== undefined && { vari_points: updates.variPoints }),
      ...(updates.is_field_employee !== undefined && { is_field_employee: updates.is_field_employee }),
      ...(updates.avatarUrl !== undefined && { avatar_url: updates.avatarUrl }),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) return { success: false, employee: null, error: error.message };
  return { success: true, employee: rowToEmployee(data as Record<string, unknown>), error: null };
}

export async function deleteEmployee(id: string): Promise<{ success: boolean; error: string | null }> {
  const { data, error } = await supabase.rpc('delete_employee_with_auth', { p_employee_id: id });
  
  if (error) {
    return { success: false, error: error.message };
  }

  // The RPC returns a JSON object. We typecast it to check success.
  const result = data as unknown as { success: boolean; error?: string };
  
  if (!result.success) {
    return { success: false, error: result.error || 'Failed to delete employee.' };
  }
  
  return { success: true, error: null };
}

export async function updateFieldStatus(
  employeeId: string,
  isField: boolean
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('employees')
    .update({ is_field_employee: isField })
    .eq('id', employeeId);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

// ─── Field location tracking (still in-memory, real-time TBD) ─────────────────

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const todayAt = (h: number, min: number) => {
  const d = new Date();
  d.setHours(h, min, 0, 0);
  return d.toISOString();
};

export const mockFieldLocations: FieldEmployeeLocation[] = [
  { employeeId: 'VAR-031', employeeName: 'Rohan Deshmukh', department: 'Sales', lat: 12.9716, lng: 77.5946, accuracy: 8, batteryLevel: 82, status: 'Active', lastUpdated: minutesAgo(2), todayCheckIn: todayAt(9, 5), distanceTravelledKm: 14.2, routeHistory: [[12.9352,77.6245],[12.9451,77.6100],[12.9716,77.5946]] },
  { employeeId: 'VAR-032', employeeName: 'Kavya Iyer', department: 'Operations', lat: 12.9345, lng: 77.5820, accuracy: 12, batteryLevel: 57, status: 'Active', lastUpdated: minutesAgo(5), todayCheckIn: todayAt(8, 50), distanceTravelledKm: 9.8, routeHistory: [[12.9081,77.6010],[12.9345,77.5820]] },
  { employeeId: 'VAR-033', employeeName: 'Mohammed Faisal', department: 'Sales', lat: 13.0067, lng: 77.5890, accuracy: 25, batteryLevel: 31, status: 'Idle', lastUpdated: minutesAgo(24), todayCheckIn: todayAt(9, 30), distanceTravelledKm: 21.5, routeHistory: [[12.9716,77.5946],[13.0067,77.5890]] },
];

let mockLocationHistory: LocationEntry[] = [];

export async function logLocation(data: Omit<LocationEntry, 'id'>): Promise<void> {
  const newEntry: LocationEntry = { ...data, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) };
  mockLocationHistory.push(newEntry);
  const employeeEntries = mockLocationHistory.filter(e => e.employeeId === data.employeeId);
  if (employeeEntries.length > 100) {
    const toRemove = employeeEntries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).slice(0, employeeEntries.length - 100).map(e => e.id);
    mockLocationHistory = mockLocationHistory.filter(e => !toRemove.includes(e.id));
  }
}

export async function getLatestLocations(): Promise<LatestLocation[]> {
  const employees = await getEmployees();
  const latestMap = new Map<string, LocationEntry>();
  mockLocationHistory.forEach(entry => {
    const current = latestMap.get(entry.employeeId);
    if (!current || new Date(entry.timestamp).getTime() > new Date(current.timestamp).getTime()) {
      latestMap.set(entry.employeeId, entry);
    }
  });
  const result: LatestLocation[] = [];
  employees.forEach(emp => {
    if (emp.is_field_employee) {
      const empId = emp.employeeId || emp.id;
      const entry = latestMap.get(empId) ?? { id: 'temp-' + empId, employeeId: empId, latitude: 12.9716, longitude: 77.5946, accuracy: 50, timestamp: new Date().toISOString() };
      result.push({ ...entry, employeeName: emp.fullName, department: emp.department });
    }
  });
  return result;
}

export async function getLocationHistory(employeeId: string, from: Date, to: Date): Promise<LocationEntry[]> {
  return mockLocationHistory.filter(e => e.employeeId === employeeId && new Date(e.timestamp).getTime() >= from.getTime() && new Date(e.timestamp).getTime() <= to.getTime()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
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
  const { data, error } = await supabase.from('employees').select('*').eq('is_field_employee', true);
  if (error) return [];
  return (data ?? []).map(rowToEmployee);
}

export const mockActivityLog: { timestamp: string; action: string; by: string; details: string }[] = [];
// Kept for backwards compatibility — writes now go to Supabase activity_log table
export let mockEmployeeStore: Employee[] = [];
// Lazy sync: populate on first access
getEmployees().then(emps => { mockEmployeeStore.splice(0, mockEmployeeStore.length, ...emps); });

export async function sendRecoveryEmail(employee: Employee): Promise<{ success: boolean; error: string | null }> {
  const resendApiKey = import.meta.env.VITE_RESEND_API_KEY;
  if (!resendApiKey) {
    return { success: false, error: 'VITE_RESEND_API_KEY is not configured in .env.' };
  }

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: employee.personalEmail,
        subject: 'Recovery: Varistor EOPMS Login Credentials',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
            <div style="background-color: #84CC16; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0;">Varistor EOPMS Credentials</h1>
            </div>
            <div style="padding: 20px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
              <p>Hi ${employee.fullName},</p>
              <p>An administrator has requested to resend your login credentials. Here they are:</p>
              <div style="background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0;">
                <p style="margin: 0 0 10px 0;"><strong>Username:</strong> ${employee.username}</p>
                <p style="margin: 0 0 10px 0;"><strong>Employee ID:</strong> ${employee.employeeId}</p>
                <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #eee; padding: 2px 6px; border-radius: 3px;">${employee.tempPassword}</code></p>
              </div>
              <p>Please log in using the app URL and change your password as soon as possible.</p>
            </div>
          </div>
        `
      })
    });

    if (!emailRes.ok) {
      const errData = await emailRes.json().catch(() => null);
      return { success: false, error: errData?.message || 'Failed to send recovery email via Resend API.' };
    }

    return { success: true, error: null };
  } catch (e: any) {
    console.error('[Resend Exception]', e);
    return { success: false, error: e.message };
  }
}
