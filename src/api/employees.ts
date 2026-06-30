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

// In-memory store (acts as the DB until Supabase is connected)
export const mockEmployeeStore: Employee[] = [
  {
    id: 'VAR-024',
    fullName: 'Aarav Patel',
    employeeId: 'VAR-024',
    username: 'aarav.patel',
    personalEmail: 'aarav.patel@gmail.com',
    phone: '+91 98765 43210',
    department: 'Operations',
    reportingManager: 'Admin User',
    role: 'Employee',
    tempPassword: 'Employee@2026!',
    createdAt: '2026-01-15T09:00:00Z',
    status: 'Active',
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
}> {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 900));

  // Validation
  if (!input.fullName || !input.employeeId || !input.personalEmail || !input.department) {
    return { success: false, employee: null, error: 'Missing required fields.' };
  }

  // Duplicate check
  const duplicate = mockEmployeeStore.find(
    e => e.employeeId === input.employeeId || e.personalEmail === input.personalEmail
  );
  if (duplicate) {
    return { success: false, employee: null, error: 'Employee ID or email already exists.' };
  }

  const employee: Employee = {
    ...input,
    id: input.employeeId,
    tempPassword: generateTempPassword(input.fullName),
    createdAt: new Date().toISOString(),
    status: 'Active',
  };

  mockEmployeeStore.push(employee);

  // Log to activity log
  mockActivityLog.push({
    timestamp: new Date().toISOString(),
    action: 'CREATE_EMPLOYEE',
    by: 'admin@varistor.in',
    details: `Created employee ${input.fullName} (${input.employeeId}) in ${input.department}`,
  });

  console.log('[Mock DB] Employee created:', employee);
  console.log('[Audit Log]', mockActivityLog[mockActivityLog.length - 1]);

  return { success: true, employee, error: null };
}

export async function getEmployees(): Promise<Employee[]> {
  await new Promise(resolve => setTimeout(resolve, 400));
  return [...mockEmployeeStore];
}
