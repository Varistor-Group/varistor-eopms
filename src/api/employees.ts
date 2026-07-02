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
  is_field_employee?: boolean;
}

// Temporary mock array for legacy components that haven't been migrated to the JSON DB yet
export const mockEmployeeStore: Employee[] = [
  {
    fullName: "akash kumar",
    employeeId: "2131",
    username: "21331",
    personalEmail: "cobbstark01@gmail.com",
    phone: "+917022630114",
    department: "Operations",
    reportingManager: "na",
    role: "Admin",
    id: "2131",
    tempPassword: "AK@2026!896",
    createdAt: "2026-07-01T07:27:17.041Z",
    status: "Active",
    variPoints: 0,
    is_field_employee: false
  },
  {
    fullName: "sathvik",
    employeeId: "2",
    username: "sathvikkillspeople",
    personalEmail: "sathvik@varistor.in",
    phone: "120393132241",
    department: "Operations",
    reportingManager: "2131",
    role: "Employee",
    is_field_employee: true,
    id: "2",
    tempPassword: "S@2026!441",
    createdAt: "2026-07-02T07:43:56.955Z",
    status: "Active",
    variPoints: 0
  }
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

// ─── Location Tracking (Mock Service Layer) ──────────────────────────────────

// In-memory array for locations (as requested for mock state)
let mockLocationHistory: LocationEntry[] = [];

export async function logLocation(data: Omit<LocationEntry, 'id'>): Promise<void> {
  const newEntry: LocationEntry = {
    ...data,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
  };
  
  mockLocationHistory.push(newEntry);
  
  // Keep only the last 100 entries per employee to avoid memory bloat
  const employeeEntries = mockLocationHistory.filter(e => e.employeeId === data.employeeId);
  if (employeeEntries.length > 100) {
    const sorted = employeeEntries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    const toRemove = sorted.slice(0, sorted.length - 100).map(e => e.id);
    mockLocationHistory = mockLocationHistory.filter(e => !toRemove.includes(e.id));
  }
}

export async function getLatestLocations(): Promise<LatestLocation[]> {
  const employees = await getEmployees();
  const latestLocations: LatestLocation[] = [];

  // Group by employeeId to find the latest
  const latestMap = new Map<string, LocationEntry>();
  mockLocationHistory.forEach(entry => {
    const current = latestMap.get(entry.employeeId);
    if (!current || new Date(entry.timestamp).getTime() > new Date(current.timestamp).getTime()) {
      latestMap.set(entry.employeeId, entry);
    }
  });

  employees.forEach(emp => {
    if (emp.is_field_employee) {
      const empId = emp.employeeId || emp.id;
      let entry = latestMap.get(empId);
      
      // If no location exists yet, provide and record a temporary starting location in Bangalore
      if (!entry) {
        entry = {
          id: 'temp-' + empId + '-' + Date.now(),
          employeeId: empId,
          latitude: 12.9716 + (Math.random() * 0.05 - 0.025), // slight randomization
          longitude: 77.5946 + (Math.random() * 0.05 - 0.025),
          accuracy: 50,
          timestamp: new Date().toISOString()
        };
        // Save it to history so it persists during this session
        mockLocationHistory.push(entry);
        latestMap.set(empId, entry);
      }

      latestLocations.push({
        ...entry,
        employeeName: emp.fullName,
        department: emp.department,
      });
    }
  });

  return latestLocations;
}

export async function getLocationHistory(employeeId: string, from: Date, to: Date): Promise<LocationEntry[]> {
  const fromTime = from.getTime();
  const toTime = to.getTime();
  
  return mockLocationHistory
    .filter(e => e.employeeId === employeeId)
    .filter(e => {
      const time = new Date(e.timestamp).getTime();
      return time >= fromTime && time <= toTime;
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export async function getFieldLocations(): Promise<FieldEmployeeLocation[]> {
  // Fetch real employees from the DB
  const employees = await getEmployees();
  
  // Consider Sales and Operations employees as field staff for the simulation
  const fieldStaff = employees.filter(e => e.department === 'Sales' || e.department === 'Operations');
  
  if (fieldStaff.length === 0) {
    return [];
  }

  // Map real employees to our mock coordinate routes so the map has data
  return fieldStaff.map((emp, index) => {
    const mockLoc = mockFieldLocations[index % mockFieldLocations.length];
    return {
      ...mockLoc,
      employeeId: emp.employeeId,
      employeeName: emp.fullName,
      department: emp.department,
      routeHistory: [...mockLoc.routeHistory]
    };
  });
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

export async function updateFieldStatus(employeeId: string, isField: boolean): Promise<{ success: boolean; error: string | null }> {
  try {
    const res = await fetch(`http://localhost:3001/api/employees/${employeeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_field_employee: isField })
    });
    if (!res.ok) throw new Error('Failed to update field status');
    return { success: true, error: null };
  } catch (err) {
    // Fallback for mock store if DB unreachable
    const idx = mockEmployeeStore.findIndex(e => e.id === employeeId || e.employeeId === employeeId);
    if (idx !== -1) {
      mockEmployeeStore[idx].is_field_employee = isField;
      return { success: true, error: null };
    }
    return { success: false, error: 'Server unreachable and user not in mock store' };
  }
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

export async function deleteEmployee(id: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const res = await fetch(`http://localhost:3001/api/employees/${id}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    return { success: result.success, error: result.error || null };
  } catch (err) {
    return { success: false, error: 'Database server unreachable.' };
  }
}
