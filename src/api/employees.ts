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

import type { UserRole, FieldEmployeeLocation } from '../types';

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
    id: 'VAR-031',
    fullName: 'Rohan Deshmukh',
    employeeId: 'VAR-031',
    username: 'rohan.deshmukh',
    personalEmail: 'rohan.deshmukh@gmail.com',
    phone: '+91 98450 12233',
    department: 'Sales',
    reportingManager: 'Aarav Patel',
    role: 'Field Employee',
    tempPassword: 'RD@2026!482',
    createdAt: '2026-02-03T09:30:00Z',
    status: 'Active',
    variPoints: 950,
  },
  {
    id: 'VAR-032',
    fullName: 'Kavya Iyer',
    employeeId: 'VAR-032',
    username: 'kavya.iyer',
    personalEmail: 'kavya.iyer@gmail.com',
    phone: '+91 99720 45611',
    department: 'Operations',
    reportingManager: 'Aarav Patel',
    role: 'Field Employee',
    tempPassword: 'KI@2026!917',
    createdAt: '2026-02-10T10:00:00Z',
    status: 'Active',
    variPoints: 1120,
  },
  {
    id: 'VAR-033',
    fullName: 'Mohammed Faisal',
    employeeId: 'VAR-033',
    username: 'mohammed.faisal',
    personalEmail: 'md.faisal@gmail.com',
    phone: '+91 96860 78090',
    department: 'Sales',
    reportingManager: 'Aarav Patel',
    role: 'Field Employee',
    tempPassword: 'MF@2026!305',
    createdAt: '2026-02-18T08:45:00Z',
    status: 'Active',
    variPoints: 780,
  },
  {
    id: 'VAR-034',
    fullName: 'Sneha Reddy',
    employeeId: 'VAR-034',
    username: 'sneha.reddy',
    personalEmail: 'sneha.reddy@gmail.com',
    phone: '+91 90080 23445',
    department: 'Operations',
    reportingManager: 'Aarav Patel',
    role: 'Field Employee',
    tempPassword: 'SR@2026!664',
    createdAt: '2026-03-01T09:15:00Z',
    status: 'Active',
    variPoints: 1340,
  },
  {
    id: 'VAR-035',
    fullName: 'Arjun Nair',
    employeeId: 'VAR-035',
    username: 'arjun.nair',
    personalEmail: 'arjun.nair@gmail.com',
    phone: '+91 98410 56728',
    department: 'Digital Marketing',
    reportingManager: 'Aarav Patel',
    role: 'Field Employee',
    tempPassword: 'AN@2026!129',
    createdAt: '2026-03-12T11:20:00Z',
    status: 'Active',
    variPoints: 610,
  },
];

// ─── Field Tracker mock location store ───────────────────────────────────────

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const todayAt = (h: number, min: number) => {
  const d = new Date();
  d.setHours(h, min, 0, 0);
  return d.toISOString();
};

// Seeded with realistic coordinates spread around Bangalore/Chennai
export const mockFieldLocations: FieldEmployeeLocation[] = [
  {
    employeeId: 'VAR-031',
    employeeName: 'Rohan Deshmukh',
    department: 'Sales',
    lat: 12.9716, // MG Road, Bangalore
    lng: 77.5946,
    accuracy: 8,
    batteryLevel: 82,
    status: 'Active',
    lastUpdated: minutesAgo(2),
    todayCheckIn: todayAt(9, 5),
    distanceTravelledKm: 14.2,
    routeHistory: [
      [12.9352, 77.6245],
      [12.9451, 77.6100],
      [12.9563, 77.6010],
      [12.9660, 77.5970],
      [12.9716, 77.5946],
    ],
  },
  {
    employeeId: 'VAR-032',
    employeeName: 'Kavya Iyer',
    department: 'Operations',
    lat: 12.9345, // Jayanagar, Bangalore
    lng: 77.5820,
    accuracy: 12,
    batteryLevel: 57,
    status: 'Active',
    lastUpdated: minutesAgo(5),
    todayCheckIn: todayAt(8, 50),
    distanceTravelledKm: 9.8,
    routeHistory: [
      [12.9081, 77.6010],
      [12.9155, 77.5932],
      [12.9240, 77.5880],
      [12.9345, 77.5820],
    ],
  },
  {
    employeeId: 'VAR-033',
    employeeName: 'Mohammed Faisal',
    department: 'Sales',
    lat: 13.0067, // Hebbal, Bangalore
    lng: 77.5890,
    accuracy: 25,
    batteryLevel: 31,
    status: 'Idle',
    lastUpdated: minutesAgo(24),
    todayCheckIn: todayAt(9, 30),
    distanceTravelledKm: 21.5,
    routeHistory: [
      [12.9716, 77.5946],
      [12.9855, 77.5910],
      [12.9975, 77.5902],
      [13.0067, 77.5890],
    ],
  },
  {
    employeeId: 'VAR-034',
    employeeName: 'Sneha Reddy',
    department: 'Operations',
    lat: 12.9698, // Whitefield, Bangalore
    lng: 77.7499,
    accuracy: 10,
    batteryLevel: 91,
    status: 'Active',
    lastUpdated: minutesAgo(1),
    todayCheckIn: todayAt(9, 0),
    distanceTravelledKm: 6.4,
    routeHistory: [
      [12.9569, 77.7011],
      [12.9610, 77.7205],
      [12.9655, 77.7350],
      [12.9698, 77.7499],
    ],
  },
  {
    employeeId: 'VAR-035',
    employeeName: 'Arjun Nair',
    department: 'Digital Marketing',
    lat: 13.0827, // Chennai Central
    lng: 80.2707,
    accuracy: 40,
    batteryLevel: 12,
    status: 'Offline',
    lastUpdated: minutesAgo(95),
    todayCheckIn: todayAt(8, 40),
    todayCheckOut: todayAt(17, 10),
    distanceTravelledKm: 18.9,
    routeHistory: [
      [13.0475, 80.2090],
      [13.0569, 80.2320],
      [13.0700, 80.2510],
      [13.0827, 80.2707],
    ],
  },
];

export async function getFieldEmployees(): Promise<Employee[]> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockEmployeeStore.filter(e => e.role === 'Field Employee');
}

export async function getFieldLocations(): Promise<FieldEmployeeLocation[]> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockFieldLocations.map(l => ({ ...l, routeHistory: [...l.routeHistory] }));
}

export function updateFieldLocation(employeeId: string, patch: Partial<FieldEmployeeLocation>): void {
  const index = mockFieldLocations.findIndex(l => l.employeeId === employeeId);
  if (index === -1) return;
  mockFieldLocations[index] = { ...mockFieldLocations[index], ...patch };
}

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
