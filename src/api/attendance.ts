/**
 * MOCK ATTENDANCE SERVICE — Bio Park D-01 Face-Punch Integration
 *
 * TODO: Replace with Supabase implementation:
 *  supabase.from('attendance_ledger').select/insert/update
 *  supabase.storage.from('attendance-photos').upload / createSignedUrl
 *
 * Expected return shapes (consistent with existing services):
 *  Reads   → Direct typed array
 *  Mutates → { success: boolean; error: string | null }
 */

import { API_URL } from '../config/api';
import { supabase } from '../lib/supabase';

// Lazy import to avoid circular deps (leaves imports from attendance for rejection)
async function getApprovedLeavesForMonth(month: string): Promise<{ employeeId: string; date: string }[]> {
  try {
    const [year, mon] = month.split('-');
    const startDate = `${year}-${mon}-01`;
    const daysInMonth = new Date(Number(year), Number(mon), 0).getDate();
    const endDate = `${year}-${mon}-${String(daysInMonth).padStart(2, '0')}`;
    const { data } = await supabase
      .from('leave_requests')
      .select('employee_id, from_date, to_date')
      .eq('status', 'Approved')
      .lte('from_date', endDate)
      .gte('to_date', startDate);
    const result: { employeeId: string; date: string }[] = [];
    for (const row of data ?? []) {
      const start = new Date(row.from_date + 'T00:00:00');
      const end = new Date(row.to_date + 'T00:00:00');
      const cursor = new Date(start);
      while (cursor <= end) {
        const d = cursor.toISOString().split('T')[0];
        if (d >= startDate && d <= endDate) result.push({ employeeId: row.employee_id, date: d });
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return result;
  } catch { return []; }
}

async function getAllBalancesMap(): Promise<Map<string, number>> {
  try {
    const { data } = await (supabase as any).from('employee_leave_balances').select('employee_id,total,used');
    const map = new Map<string, number>();
    for (const row of data ?? []) {
      const empId: string = row.employee_id;
      const remaining = (row.total as number) - (row.used as number);
      map.set(empId, (map.get(empId) ?? 0) + Math.max(0, remaining));
    }
    return map;
  } catch { return new Map(); }
}


// ─── Types ─────────────────────────────────────────────────────────────────

export type AttendanceStatus =
  | 'Present'
  | 'Late'
  | 'Half-day'
  | 'Holiday'
  | 'W.O'
  | 'Leave'
  | 'Absent';

export type AttendanceSource = 'device' | 'field_photo' | 'hr_override';
export type PunchType = 'in' | 'out';
export type VerificationStatus = 'Pending' | 'Verified' | 'Rejected';
export type HolidayType = 'National' | 'Festival' | 'Optional';

export interface AttendanceLedgerEntry {
  id: string;
  employee_id: string;
  employeeName: string;
  department: string;
  date: string;             // YYYY-MM-DD
  punch_in?: string;        // ISO timestamptz
  punch_out?: string;       // ISO timestamptz
  work_hours?: number;
  status: AttendanceStatus;
  source: AttendanceSource;
  confidence?: number;      // face recognition %
  photo_url?: string;       // field employees only
  override_reason?: string;
  editor_id?: string;
  edited_at?: string;
  created_at: string;
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
  date: string;            // YYYY-MM-DD
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
  // Location captured from browser Geolocation API at punch time
  latitude?: number;
  longitude?: number;
  location_accuracy?: number;  // metres
  punch_time?: string;         // ISO timestamp at moment of photo capture
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
  lastSync: string;        // ISO timestamp
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

// ─── Dynamic employee roster ────────────────────────────────────────────────

import { getEmployees } from './employees';
import type { Employee } from './employees';

export interface RosterEmployee {
  id: string;
  name: string;
  dept: string;
  isField: boolean;
  shiftStart?: string;
  shiftEnd?: string;
}

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
        shiftEnd: e.shiftEnd
      }));
  }
  return _cachedRoster;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

/** Generate a time string for a given date at HH:MM local time */
function dateTimeAt(dateISO: string, hour: number, minute: number): string {
  const d = new Date(dateISO + 'T00:00:00');
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function calcWorkHours(punchIn?: string, punchOut?: string): number | undefined {
  if (!punchIn || !punchOut) return undefined;
  const diff = (new Date(punchOut).getTime() - new Date(punchIn).getTime()) / 3600000;
  return parseFloat(diff.toFixed(2));
}

/** Deterministic "random" using a seed so mock data is stable across refreshes */
function seededRand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateEntryForEmployee(
  emp: RosterEmployee,
  date: string,
  index: number,
  holidays: string[]
): AttendanceLedgerEntry {
  const d = new Date(date);
  const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat
  const isWeekend = dayOfWeek === 0; // Sun only — Sat is half-day
  const isHoliday = holidays.includes(date);
  const seed = index + date.charCodeAt(5) * 100 + date.charCodeAt(8) * 10;

  let status: AttendanceStatus;
  let punchIn: string | undefined;
  let punchOut: string | undefined;
  let source: AttendanceSource = emp.isField ? 'field_photo' : 'device';
  let confidence: number | undefined;
  let photo_url: string | undefined;

  if (isWeekend) {
    status = 'W.O';
    source = 'hr_override';
  } else if (isHoliday) {
    status = 'Holiday';
    source = 'hr_override';
  } else if (dayOfWeek === 6) {
    // Saturday — half day
    const r = seededRand(seed);
    if (r < 0.1) {
      status = 'Absent';
    } else {
      status = 'Half-day';
      punchIn = dateTimeAt(date, 9, Math.floor(seededRand(seed + 1) * 30));
      punchOut = dateTimeAt(date, 13, Math.floor(seededRand(seed + 2) * 30));
      confidence = emp.isField ? undefined : parseFloat((88 + seededRand(seed + 3) * 10).toFixed(1));
      if (emp.isField) {
        photo_url = `attendance-photos/${emp.id}/${date}/in.jpg`;
      }
    }
  } else {
    // Working day
    const r = seededRand(seed);
    if (r < 0.05) {
      status = 'Leave';
      source = 'hr_override';
    } else if (r < 0.08) {
      status = 'Absent';
      source = 'hr_override';
    } else if (r < 0.18) {
      status = 'Late';
      punchIn = dateTimeAt(date, 9, 20 + Math.floor(seededRand(seed + 1) * 40));
      punchOut = dateTimeAt(date, 18, Math.floor(seededRand(seed + 2) * 30));
      confidence = emp.isField ? undefined : parseFloat((78 + seededRand(seed + 3) * 15).toFixed(1));
      if (emp.isField) photo_url = `attendance-photos/${emp.id}/${date}/in.jpg`;
    } else {
      status = 'Present';
      punchIn = dateTimeAt(date, 8, 45 + Math.floor(seededRand(seed + 1) * 20));
      punchOut = dateTimeAt(date, 17, 30 + Math.floor(seededRand(seed + 2) * 60));
      confidence = emp.isField ? undefined : parseFloat((88 + seededRand(seed + 3) * 10).toFixed(1));
      if (emp.isField) photo_url = `attendance-photos/${emp.id}/${date}/in.jpg`;
    }
  }

  const work_hours = calcWorkHours(punchIn, punchOut);

  return {
    id: `atl-${emp.id}-${date}`,
    employee_id: emp.id,
    employeeName: emp.name,
    department: emp.dept,
    date,
    punch_in: punchIn,
    punch_out: punchOut,
    work_hours,
    status,
    source,
    confidence,
    photo_url,
    created_at: new Date(date + 'T07:00:00').toISOString(),
    is_field_employee: emp.isField,
  };
}

/** Get all working dates in a YYYY-MM month string up to today */
function getDatesInMonth(month: string): string[] {
  const [year, mon] = month.split('-').map(Number);
  const today = new Date();
  const dates: string[] = [];
  const daysInMonth = new Date(year, mon, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, mon - 1, d);
    if (date > today) break;
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

// ─── In-memory stores ──────────────────────────────────────────────────────

/** National holidays for 2026 */
let _holidays: Holiday[] = [
  { id: 'hol-1', date: '2026-01-26', occasion: 'Republic Day', type: 'National', apply_to_all: true, created_by: 'HR', created_at: '2026-01-01T00:00:00Z' },
  { id: 'hol-2', date: '2026-03-28', occasion: 'Holi', type: 'Festival', apply_to_all: true, created_by: 'HR', created_at: '2026-01-01T00:00:00Z' },
  { id: 'hol-3', date: '2026-04-14', occasion: 'Dr. Ambedkar Jayanti', type: 'National', apply_to_all: true, created_by: 'HR', created_at: '2026-01-01T00:00:00Z' },
  { id: 'hol-4', date: '2026-04-10', occasion: 'Good Friday', type: 'National', apply_to_all: true, created_by: 'HR', created_at: '2026-01-01T00:00:00Z' },
  { id: 'hol-5', date: '2026-08-15', occasion: 'Independence Day', type: 'National', apply_to_all: true, created_by: 'HR', created_at: '2026-01-01T00:00:00Z' },
  { id: 'hol-6', date: '2026-10-02', occasion: 'Gandhi Jayanti', type: 'National', apply_to_all: true, created_by: 'HR', created_at: '2026-01-01T00:00:00Z' },
  { id: 'hol-7', date: '2026-11-04', occasion: 'Diwali', type: 'Festival', apply_to_all: true, created_by: 'HR', created_at: '2026-01-01T00:00:00Z' },
  { id: 'hol-8', date: '2026-11-05', occasion: 'Diwali (2nd day)', type: 'Festival', apply_to_all: true, created_by: 'HR', created_at: '2026-01-01T00:00:00Z' },
  { id: 'hol-9', date: '2026-12-25', occasion: 'Christmas', type: 'National', apply_to_all: true, created_by: 'HR', created_at: '2026-01-01T00:00:00Z' },
];

const _holidayDates = () => _holidays.map(h => h.date);

let _attendanceEdits: AttendanceEdit[] = [];

/** Dynamic field photos array */
let _fieldPhotos: FieldPhotoEntry[] = [];

// Override store: HR-edited entries (stored by id for quick lookup)
const _overrides = new Map<string, Partial<AttendanceLedgerEntry>>();

// ─── API Functions ─────────────────────────────────────────────────────────

/**
 * Returns all employees' attendance for a given date.
 * TODO: supabase.from('attendance_ledger').select('*').eq('date', date)
 */
export async function getAttendanceByDate(date: string): Promise<AttendanceLedgerEntry[]> {
  try {
    const { data, error } = await supabase
      .from('attendance_ledger')
      .select('*')
      .eq('date', date);

    if (error) {
      console.error('Error fetching daily attendance from Supabase:', error);
      return [];
    }

    const roster = await fetchAttendanceRoster();
    const ledgerMap = new Map<string, any>();
    for (const row of (data || [])) {
      ledgerMap.set(row.employee_id, row);
    }

    const holidaysList = _holidayDates();
    const dateObj = new Date(date);
    const isSunday = dateObj.getDay() === 0;
    const isHoliday = holidaysList.includes(date);

    return roster.map(emp => {
      const dbEntry = ledgerMap.get(emp.id);
      
      let finalStatus: AttendanceStatus = 'Absent';
      if (dbEntry) {
        finalStatus = dbEntry.status as AttendanceStatus;
      } else {
        if (isSunday) finalStatus = 'W.O';
        else if (isHoliday) finalStatus = 'Holiday';
      }

      return {
        id: dbEntry?.id || `atl-${emp.id}-${date}`, // Provide composite ID if no record exists so HR can update it
        employee_id: emp.id,
        employeeName: emp.name,
        department: emp.dept,
        date: date,
        punch_in: dbEntry?.punch_in,
        punch_out: dbEntry?.punch_out,
        work_hours: dbEntry?.work_hours,
        status: finalStatus,
        source: (dbEntry?.source || 'device') as AttendanceSource,
        confidence: dbEntry?.confidence,
        photo_url: dbEntry?.photo_url,
        override_reason: dbEntry?.override_reason,
        editor_id: dbEntry?.editor_id,
        edited_at: dbEntry?.edited_at,
        is_field_employee: emp.isField,
        created_at: dbEntry?.created_at || new Date().toISOString(),
      };
    }) as AttendanceLedgerEntry[];
  } catch (err) {
    console.error('Unexpected error fetching daily attendance:', err);
    return [];
  }
}

/**
 * Returns one employee's attendance for a full month (YYYY-MM).
 * TODO: supabase.from('attendance_ledger').select('*').eq('employee_id', employeeId).gte('date', ...).lte('date', ...)
 */
export async function getAttendanceByEmployee(
  employeeId: string,
  month: string
): Promise<AttendanceLedgerEntry[]> {
  try {
    const { data, error } = await supabase
      .from('attendance_ledger')
      .select('*')
      .eq('employee_id', employeeId)
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error fetching employee attendance from Supabase:', error);
      return [];
    }

    const roster = await fetchAttendanceRoster();
    const emp = roster.find(e => e.id === employeeId);

    return (data || []).map(row => ({
      ...row,
      status: row.status as AttendanceStatus,
      source: row.source as AttendanceSource,
      employeeName: emp?.name || 'Unknown',
      department: emp?.dept || 'Unknown',
    })) as AttendanceLedgerEntry[];
  } catch (err) {
    console.error('Unexpected error fetching attendance:', err);
    return [];
  }
}

/**
 * Updates an attendance_ledger entry. Writes audit row to attendance_edits.
 * HR/Admin only — enforced at UI level and Supabase RLS.
 * TODO: supabase.from('attendance_ledger').update({...}).eq('id', ledgerId)
 *       supabase.from('attendance_edits').insert({...})
 */
export async function updateAttendance(
  ledgerId: string,
  updates: { punch_in?: string; punch_out?: string; status?: AttendanceStatus },
  reason: string,
  editorId: string
): Promise<{ success: boolean; error: string | null }> {
  if (!reason.trim()) {
    return { success: false, error: 'Reason is required for attendance edits.' };
  }

  try {
    let existingRecord: any = null;
    let employeeId = '';
    let date = '';
    let isNew = false;

    if (ledgerId.startsWith('atl-')) {
      isNew = true;
      const dateMatch = ledgerId.match(/(\d{4}-\d{2}-\d{2})$/);
      if (!dateMatch) return { success: false, error: 'Invalid record ID format.' };
      date = dateMatch[1];
      employeeId = ledgerId.replace('atl-', '').replace(`-${date}`, '');
    } else {
      const { data, error } = await supabase.from('attendance_ledger').select('*').eq('id', ledgerId).single();
      if (error || !data) return { success: false, error: 'Attendance record not found.' };
      existingRecord = data;
      employeeId = data.employee_id;
      date = data.date;
    }

    const newWorkHours = calcWorkHours(
      updates.punch_in ?? existingRecord?.punch_in,
      updates.punch_out ?? existingRecord?.punch_out
    );

    const updatedFields = {
      punch_in: updates.punch_in ?? existingRecord?.punch_in,
      punch_out: updates.punch_out ?? existingRecord?.punch_out,
      status: updates.status ?? existingRecord?.status,
      work_hours: newWorkHours,
      source: 'hr_override',
      override_reason: reason,
      editor_id: editorId,
      edited_at: new Date().toISOString(),
    };

    if (isNew) {
      const roster = await fetchAttendanceRoster();
      const emp = roster.find(e => e.id === employeeId);
      
      const { error: insertError } = await supabase.from('attendance_ledger').insert({
        employee_id: employeeId,
        date: date,
        ...updatedFields,
        is_field_employee: emp?.isField || false,
      });
      if (insertError) throw insertError;
    } else {
      const { error: updateError } = await supabase.from('attendance_ledger').update(updatedFields).eq('id', ledgerId);
      if (updateError) throw updateError;
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error('Error updating attendance:', err);
    return { success: false, error: err.message || 'Failed to update attendance' };
  }
}

/**
 * Aggregates present/leave/WO/holiday/total hrs/payable days per employee for a month.
 * TODO: supabase.from('attendance_ledger').select('*').eq('date', ...) with aggregation
 */
export async function getMonthlyReport(
  month: string,
  employeeIds?: string[]
): Promise<MonthlyReportRow[]> {
  try {
    const dates = getDatesInMonth(month);
    const fullRoster = await fetchAttendanceRoster();
    const roster = employeeIds
      ? fullRoster.filter(e => employeeIds.includes(e.id))
      : fullRoster;

    const [approvedLeaves, balancesMap] = await Promise.all([
      getApprovedLeavesForMonth(month),
      getAllBalancesMap(),
    ]);
    const approvedLeaveSet = new Set(approvedLeaves.map(l => `${l.employeeId}|${l.date}`));

    let query = supabase
      .from('attendance_ledger')
      .select('*')
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`);

    if (employeeIds && employeeIds.length > 0) {
      query = query.in('employee_id', employeeIds);
    }

    const { data: rawData, error } = await query;
    if (error) {
      console.error('Error fetching monthly report data:', error);
    }
    const data = rawData || [];
    
    const ledgerMap = new Map<string, any>();
    for (const row of data) {
      ledgerMap.set(`${row.employee_id}|${row.date}`, row);
    }
    
    const holidaysList = _holidayDates();

    return roster.map((emp) => {
      let present = 0, late = 0, leaves = 0, weekOff = 0, holidays = 0, halfDay = 0, absent = 0, totalHrs = 0;
      const dailyRecords: { date: string; punch_in?: string; punch_out?: string; work_hours?: number; status?: string }[] = [];

      dates.forEach((date) => {
        const dbEntry = ledgerMap.get(`${emp.id}|${date}`);
        let finalStatus: AttendanceStatus = 'Absent';
        
        const dateObj = new Date(date);
        const isSunday = dateObj.getDay() === 0;
        const isHoliday = holidaysList.includes(date);

        if (dbEntry) {
          finalStatus = dbEntry.status as AttendanceStatus;
        } else {
          if (isSunday) finalStatus = 'W.O';
          else if (isHoliday) finalStatus = 'Holiday';
        }

        const final = {
          date,
          punch_in: dbEntry?.punch_in,
          punch_out: dbEntry?.punch_out,
          work_hours: dbEntry?.work_hours,
          status: finalStatus,
        };

        const isWorking = final.status !== 'W.O' && final.status !== 'Holiday';
        if (isWorking) {
          const hasApprovedLeave = approvedLeaveSet.has(`${emp.id}|${date}`);
          const remainingBalance = balancesMap.get(emp.id) ?? 0;
          const hasPunchIn = !!final.punch_in;

          if (hasApprovedLeave) {
            if (remainingBalance <= 0) {
              final.status = 'Absent';
            } else {
              final.status = 'Leave';
            }
          } else if (!hasPunchIn && final.status !== 'Leave' && final.status !== 'Absent' && final.status !== 'Half-day') {
            final.status = 'Absent';
          }
        }

        dailyRecords.push({
          date: final.date,
          punch_in: final.punch_in,
          punch_out: final.punch_out,
          work_hours: final.work_hours ?? undefined,
          status: final.status,
        });

        switch (final.status) {
          case 'Present': present++; break;
          case 'Late': late++; present++; break;
          case 'Half-day': halfDay++; break;
          case 'Holiday': holidays++; break;
          case 'W.O': weekOff++; break;
          case 'Leave': leaves++; break;
          case 'Absent': absent++; break;
        }
        if (final.work_hours) totalHrs += final.work_hours;
      });

      const workingDays = dates.length - weekOff - holidays;
      const payableDays = present + late + halfDay * 0.5;

      return {
        employee_id: emp.id,
        employeeName: emp.name,
        department: emp.dept,
        present,
        late,
        leaves,
        weekOff,
        holidays,
        halfDay,
        absent,
        totalHrs: parseFloat(totalHrs.toFixed(1)),
        payableDays: parseFloat(payableDays.toFixed(1)),
        workingDays,
        dailyRecords,
      };
    });
  } catch (err) {
    console.error('Unexpected error fetching monthly report:', err);
    return [];
  }
}

// ─── Holidays ──────────────────────────────────────────────────────────────

/**
 * Returns holidays for a given year.
 * TODO: supabase.from('holidays').select('*').gte('date', `${year}-01-01`).lte('date', `${year}-12-31`)
 */
export async function getHolidays(year: string): Promise<Holiday[]> {
  await delay(120);
  return _holidays.filter(h => h.date.startsWith(year));
}

/**
 * Adds a holiday and auto-marks all employee attendance for that date as Holiday.
 * TODO: supabase.from('holidays').insert(data)
 *       + supabase.from('attendance_ledger').upsert(rows, { onConflict: 'employee_id,date' })
 */
export async function addHoliday(
  data: HolidayInput,
  createdBy: string
): Promise<{ success: boolean; error: string | null }> {
  await delay(400);
  if (_holidays.some(h => h.date === data.date)) {
    return { success: false, error: 'A holiday is already recorded for this date.' };
  }

  const newHoliday: Holiday = {
    id: `hol-${Date.now()}`,
    ...data,
    created_by: createdBy,
    created_at: new Date().toISOString(),
  };
  _holidays.push(newHoliday);

  // Auto-insert "Holiday" override for all employees on that date
  if (data.apply_to_all) {
    const roster = await fetchAttendanceRoster();
    roster.forEach(emp => {
      const ledgerId = `atl-${emp.id}-${data.date}`;
      _overrides.set(ledgerId, {
        status: 'Holiday',
        source: 'hr_override',
        override_reason: `Holiday: ${data.occasion}`,
        editor_id: createdBy,
        edited_at: new Date().toISOString(),
      });
    });
  }

  return { success: true, error: null };
}

// ─── Field Attendance ──────────────────────────────────────────────────────

/**
 * Uploads a field employee selfie and creates/updates attendance_ledger.
 * TODO: supabase.storage.from('attendance-photos').upload(path, file)
 *       supabase.from('field_attendance_photos').upsert({...})
 *       supabase.from('attendance_ledger').upsert({...}, { onConflict: 'employee_id,date' })
 */
export async function uploadFieldPhoto(
  employeeId: string,
  date: string,
  punchType: PunchType,
  _file: File,
  confidenceScore: number,
  location?: { lat: number; lng: number; accuracy: number }
): Promise<{ success: boolean; photoUrl?: string; error: string | null }> {
  await delay(800);

  const roster = await fetchAttendanceRoster();
  const emp = roster.find(e => e.id === employeeId);
  if (!emp) return { success: false, error: 'Employee not found.' };

  const photoUrl = `attendance-photos/${employeeId}/${date}/${punchType}.jpg`;
  const now = new Date().toISOString();

  const existing = _fieldPhotos.find(
    fp => fp.employee_id === employeeId && fp.date === date && fp.punch_type === punchType
  );

  if (existing) {
    existing.photo_url = photoUrl;
    existing.uploaded_at = now;
    existing.verification_status = 'Pending';
    existing.confidence_score = confidenceScore;
    existing.latitude = location?.lat;
    existing.longitude = location?.lng;
    existing.location_accuracy = location?.accuracy;
    existing.punch_time = now;
  } else {
    _fieldPhotos.push({
      id: `fp-${Date.now()}`,
      employee_id: employeeId,
      employeeName: emp.name,
      department: emp.dept,
      date,
      photo_url: photoUrl,
      uploaded_at: now,
      punch_type: punchType,
      verification_status: 'Pending',
      confidence_score: confidenceScore,
      latitude: location?.lat,
      longitude: location?.lng,
      location_accuracy: location?.accuracy,
      punch_time: now,
    });
  }

  // Upsert ledger entry
  const ledgerId = `atl-${employeeId}-${date}`;
  const existingOverride = _overrides.get(ledgerId) || {};
  _overrides.set(ledgerId, {
    ...existingOverride,
    status: 'Present',
    source: 'field_photo',
    photo_url: photoUrl,
    confidence: confidenceScore,
    ...(punchType === 'in'
      ? { punch_in: now }
      : { punch_out: now }),
  });

  // TODO: Supabase implementation:
  //   const { data, error } = await supabase.storage.from('attendance-photos').upload(path, file);
  //   await supabase.from('field_attendance_photos').upsert({ ...entry, latitude, longitude, location_accuracy });
  //   await supabase.from('attendance_ledger').upsert({ ...ledgerRow }, { onConflict: 'employee_id,date' });

  return { success: true, photoUrl, error: null };
}

/**
 * Checks if a field employee is currently punched in for today without a punch out.
 */
export async function isFieldEmployeePunchedIn(employeeId: string): Promise<boolean> {
  await delay(100);
  const date = new Date().toISOString().split('T')[0];
  const ledgerId = `atl-${employeeId}-${date}`;
  const override = _overrides.get(ledgerId);
  return !!(override && override.punch_in && !override.punch_out);
}

/**
 * Returns all pending field photo verifications for HR review queue.
 * TODO: supabase.from('field_attendance_photos').select('*').eq('verification_status', 'Pending')
 */
export async function getFieldPendingVerifications(): Promise<FieldPhotoEntry[]> {
  await delay(150);
  return _fieldPhotos.filter(fp => fp.verification_status === 'Pending');
}

/**
 * Verifies or rejects a field attendance photo.
 * TODO: supabase.from('field_attendance_photos').update({ verification_status, verified_by, verified_at }).eq('id', photoId)
 *       If Rejected: supabase.from('attendance_ledger').update({ status: 'Absent' }).eq(...)
 */
export async function verifyFieldPhoto(
  photoId: string,
  status: 'Verified' | 'Rejected',
  verifiedBy: string
): Promise<{ success: boolean; error: string | null }> {
  await delay(250);
  const photo = _fieldPhotos.find(fp => fp.id === photoId);
  if (!photo) return { success: false, error: 'Photo record not found.' };

  photo.verification_status = status;
  photo.verified_by = verifiedBy;
  photo.verified_at = new Date().toISOString();

  // If rejected, mark ledger as Absent
  if (status === 'Rejected') {
    const ledgerId = `atl-${photo.employee_id}-${photo.date}`;
    const existing = _overrides.get(ledgerId) || {};
    _overrides.set(ledgerId, {
      ...existing,
      status: 'Absent',
      override_reason: 'Field photo rejected by HR',
      editor_id: verifiedBy,
      edited_at: new Date().toISOString(),
    });
  }

  return { success: true, error: null };
}

// ─── Payroll Sync ──────────────────────────────────────────────────────────

/**
 * Read-only attendance snapshot for the payroll module.
 * This is the single integration point the payroll module should call.
 * TODO: supabase.from('attendance_ledger').select('employee_id, work_hours, status').gte('date', ...).lte('date', ...)
 */
export async function getPayrollAttendanceSnapshot(
  month: string
): Promise<PayrollAttendanceRow[]> {
  const report = await getMonthlyReport(month);
  return report.map(r => ({
    employee_id: r.employee_id,
    employeeName: r.employeeName,
    payableDays: r.payableDays,
    workingDays: r.workingDays,
    totalHrs: r.totalHrs,
  }));
}

// ─── Device status (read from bridge server in real mode) ──────────────────

/**
 * Fetches device status from the Bio Park D-01 bridge.
 * Falls back to mock offline status if server unreachable.
 */
export async function getDeviceStatus(): Promise<DeviceStatus> {
  try {
    const res = await fetch(`${API_URL}/api/attendance/device-status`);
    if (!res.ok) throw new Error('Bridge unreachable');
    return await res.json();
  } catch {
    // TODO: Replace mock fallback with real device bridge
    return {
      ipAddress: '192.168.1.42',
      enrolledFaces: 0,
      lastSync: new Date().toISOString(),
      firmware: 'N/A (device offline)',
      uptime: '—',
      online: false,
    };
  }
}

/**
 * Fetches the last 20 punch events from the bridge live feed.
 */
export async function getLivePunchFeed(): Promise<LivePunchEvent[]> {
  try {
    const res = await fetch(`${API_URL}/api/attendance/live-feed`);
    if (!res.ok) throw new Error('Bridge unreachable');
    return await res.json();
  } catch {
    // TODO: Replace with real bridge feed
    const roster = await fetchAttendanceRoster();
    const now = Date.now();
    const officeEmps = roster.filter(e => !e.isField).slice(0, 15);
    return officeEmps.map((emp, i) => ({
      id: `pev-${i}`,
      timestamp: new Date(now - (officeEmps.length - i) * 12 * 60000).toISOString(),
      employeeId: emp.id,
      employeeName: emp.name,
      type: i % 3 === 2 ? 'out' : 'in',
      confidence: parseFloat((85 + seededRand(i * 7) * 13).toFixed(1)),
      success: true,
    }));
  }
}

/** Expose roster fetching directly for UI usage */
// no export const attendanceRoster = ... anymore

/**
 * Triggers a full re-sync pull from the Bio Park D-01 device.
 */
export async function forceDeviceResync(): Promise<{ success: boolean; error: string | null }> {
  try {
    const res = await fetch(`${API_URL}/api/attendance/force-resync`, { method: 'POST' });
    if (!res.ok) throw new Error('Resync failed');
    return { success: true, error: null };
  } catch {
    return { success: false, error: 'Device bridge unreachable. Is the server running?' };
  }
}

/** Audit trail getter (HR/Admin) */
export async function getAttendanceEdits(): Promise<AttendanceEdit[]> {
  await delay(100);
  return [..._attendanceEdits].sort(
    (a, b) => new Date(b.edited_at).getTime() - new Date(a.edited_at).getTime()
  );
}

/** Helper to get all field photos (for history view) */
export async function getFieldAttendanceHistory(): Promise<FieldPhotoEntry[]> {
  await delay(120);
  return [..._fieldPhotos].sort(
    (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
  );
}

// ─── Yearly Attendance Report ──────────────────────────────────────────────

export type DayCode = 'P' | 'L' | 'A' | 'H' | 'WO' | 'HD' | '-';

export interface DayRecord {
  date: string;      // YYYY-MM-DD
  code: DayCode;     // Simplified code for display
  status: AttendanceStatus;
  isLeavePaidOut: boolean;  // true = L because leave balance was available; false = should be A
}

export interface EmployeeYearlyReport {
  employee_id: string;
  employeeName: string;
  department: string;
  year: string;
  months: {
    month: string;       // YYYY-MM
    monthLabel: string;  // "Jan", "Feb" etc.
    days: DayRecord[];
  }[];
  totals: {
    present: number;
    paidLeave: number;
    unpaidLeave: number;  // Leave days converted to A (balance exhausted)
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

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Returns a full-year per-day attendance report for one employee.
 * Maps Present/Late → P, Holidays → H, W.O → WO, Half-day → HD,
 * Leave → L if leave balance has capacity, else A (balance exhausted).
 * Absent → A always.
 *
 * leaveBalance structure: { casual: { total, used }, sick: { total, used }, earned: { total, used } }
 * totalBalance = casual.total + sick.total + earned.total - (casual.used + sick.used + earned.used)
 */
export async function getYearlyAttendanceReport(
  year: string,
  employeeId: string,
  leaveBalances?: any[]
): Promise<EmployeeYearlyReport> {
  await delay(300);

  const roster = await fetchAttendanceRoster();
  const emp = roster.find(e => e.id === employeeId) || roster[0];
  const empIndex = roster.findIndex(e => e.id === employeeId);
  const holidayDates = _holidayDates();
  const today = new Date();

  // Calculate remaining leave balance
  let totalBalance = 12; // default 12 days if no balance provided
  if (leaveBalances && leaveBalances.length > 0) {
    totalBalance = leaveBalances.reduce((sum, bal) => sum + (bal.total - bal.used), 0);
  }

  let remainingBalance = totalBalance;

  const months: EmployeeYearlyReport['months'] = [];
  let totals = { present: 0, paidLeave: 0, unpaidLeave: 0, absent: 0, holidays: 0, weekOff: 0, halfDay: 0, totalLeaveBalance: totalBalance, usedLeaveBalance: 0 };

  for (let m = 0; m < 12; m++) {
    const monthStr = `${year}-${String(m + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(Number(year), m + 1, 0).getDate();
    const days: DayRecord[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dateObj = new Date(date + 'T00:00:00');

      // Future dates
      if (dateObj > today) {
        days.push({ date, code: '-', status: 'Present', isLeavePaidOut: false });
        continue;
      }

      const entryIdx = empIndex * 100 + d + m * 31;
      const entry = generateEntryForEmployee(emp, date, entryIdx, holidayDates);
      const override = _overrides.get(entry.id);
      const final = override ? { ...entry, ...override } : entry;

      let code: DayCode;
      let isLeavePaidOut = false;

      switch (final.status) {
        case 'Present':
        case 'Late':
          code = 'P';
          totals.present++;
          break;
        case 'Half-day':
          code = 'HD';
          totals.halfDay++;
          break;
        case 'Holiday':
          code = 'H';
          totals.holidays++;
          break;
        case 'W.O':
          code = 'WO';
          totals.weekOff++;
          break;
        case 'Leave':
          // Check if leave balance still available
          if (remainingBalance > 0) {
            code = 'L';
            isLeavePaidOut = true;
            remainingBalance--;
            totals.paidLeave++;
          } else {
            // Balance exhausted — treat as Absent
            code = 'A';
            isLeavePaidOut = false;
            totals.unpaidLeave++;
          }
          break;
        case 'Absent':
          code = 'A';
          totals.absent++;
          break;
        default:
          code = '-';
      }

      days.push({ date, code, status: final.status, isLeavePaidOut });
    }

    months.push({ month: monthStr, monthLabel: MONTH_LABELS[m], days });
  }

  totals.usedLeaveBalance = totalBalance - remainingBalance;

  return {
    employee_id: emp.id,
    employeeName: emp.name,
    department: emp.dept,
    year,
    months,
    totals,
  };
}

/**
 * Returns a summary of yearly attendance for all employees (HR overview).
 */
export async function getEmployeeYearlySummaries(year: string): Promise<EmployeeYearlySummary[]> {
  await delay(350);
  const roster = await fetchAttendanceRoster();
  const holidayDates = _holidayDates();
  const today = new Date();

  return roster.map((emp, empIndex) => {
    let present = 0, paidLeave = 0, unpaidLeave = 0, absent = 0,
      holidays = 0, weekOff = 0, halfDay = 0, remaining = 12;

    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(Number(year), m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const date = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (new Date(date + 'T00:00:00') > today) continue;
        const entryIdx = empIndex * 100 + d + m * 31;
        const entry = generateEntryForEmployee(emp, date, entryIdx, holidayDates);
        const override = _overrides.get(entry.id);
        const final = override ? { ...entry, ...override } : entry;

        switch (final.status) {
          case 'Present': case 'Late': present++; break;
          case 'Half-day': halfDay++; break;
          case 'Holiday': holidays++; break;
          case 'W.O': weekOff++; break;
          case 'Leave':
            if (remaining > 0) { paidLeave++; remaining--; }
            else { unpaidLeave++; }
            break;
          case 'Absent': absent++; break;
        }
      }
    }

    return { employee_id: emp.id, employeeName: emp.name, department: emp.dept, present, paidLeave, unpaidLeave, absent, holidays, weekOff, halfDay };
  });
}


