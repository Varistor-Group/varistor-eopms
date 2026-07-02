/**
 * MOCK EMPLOYEES SERVICE
 *
 * TODO: Replace with real Supabase implementation:
 *  1. supabase.auth.admin.createUser({ email, password, ... })
 *  2. supabase.from('employees').insert(data)
 *  3. Trigger welcome email via Supabase Edge Function / Resend
 *
 * Expected return shape:
 *  { success: boolean, employee: Employee | null, error: string | null }
 */

import type { UserRole } from '../types';

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
}

export type Department =
  | 'Finance'
  | 'Sales'
  | 'Operations'
  | 'Ops Heads'
  | 'Tech'
  | 'Digital Marketing';

export interface CreateEmployeeInput {
  fullName: string;
  employeeId: string;
  username: string;
  personalEmail: string;
  phone: string;
  department: Department;
  reportingManager: string;
  role: UserRole;
}

// Temporary mock array for legacy components that haven't been migrated to the JSON DB yet
export const mockEmployeeStore: Employee[] = [
  {
    id: 'VAR-024',
    fullName: 'Aarav Patel',
    employeeId: 'VAR-024',
    username: 'aarav.patel',
    personalEmail: 'aarav.patel@gmail.com',
    phone: '+91 98765 43210',
    department: 'Operations',
    reportingManager: 'VAR-001',
    role: 'Employee',
    tempPassword: 'Employee@2026!',
    createdAt: '2026-01-15T09:00:00Z',
    status: 'Active',
    variPoints: 1800,
  },
  {
    id: 'VAR-001',
    fullName: 'Manager User',
    employeeId: 'VAR-001',
    username: 'manager.user',
    personalEmail: 'manager@example.com',
    phone: '+91 00000 00000',
    department: 'Operations',
    reportingManager: 'Admin User',
    role: 'Reporting Manager',
    tempPassword: 'Manager@2026!',
    createdAt: '2026-01-01T09:00:00Z',
    status: 'Active',
    variPoints: 2000,
  },
];

// Mock activity log
export const mockActivityLog: { timestamp: string; action: string; by: string; details: string }[] = [];

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
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 900));

  // Validation
  if (!input.fullName || !input.employeeId || !input.personalEmail || !input.department) {
    return { success: false, employee: null, error: 'Missing required fields.' };
  }

  // Build full Employee object
  const newEmployee: Employee = {
    ...input,
    id: input.employeeId,
    tempPassword: generateTempPassword(input.fullName),
    createdAt: new Date().toISOString(),
    status: 'Active',
    variPoints: 0,
  };

  // Call JSON DB API
  let employee: Employee;
  try {
    const res = await fetch('http://localhost:3001/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEmployee)
    });
    const result = await res.json();
    if (!result.success) {
      return { success: false, employee: null, error: result.error };
    }
    employee = result.employee;
  } catch (err) {
    return { success: false, employee: null, error: 'Database server unreachable.' };
  }

  console.log('[JSON DB] Employee created:', employee);

  let emailError = null;
  try {
    const res = await fetch('http://localhost:3001/api/send-credentials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: employee.fullName,
        email: employee.personalEmail,
        employeeId: employee.employeeId,
        tempPassword: employee.tempPassword
      }),
    });
    const result = await res.json();
    if (!result.success) {
      emailError = result.error || 'Failed to send welcome email.';
    }
  } catch (err) {
    emailError = 'Email server unreachable.';
  }

  return { success: true, employee, error: null, emailError };
}

export async function getEmployees(): Promise<Employee[]> {
  try {
    const res = await fetch('http://localhost:3001/api/employees');
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch employees', err);
    return [];
  }
}

export async function updateEmployee(id: string, updates: Partial<Employee>): Promise<{ success: boolean; employee: Employee | null; error: string | null }> {
  try {
    const res = await fetch(`http://localhost:3001/api/employees/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    const result = await res.json();
    return { success: result.success, employee: result.employee, error: result.error || null };
  } catch (err) {
    return { success: false, employee: null, error: 'Database server unreachable.' };
  }
}
