/**
 * PAYROLL SERVICE — Modules 11 & 12
 *
 * Excel-driven formula engine:
 *   Basic   = CTC * 0.6
 *   HRA     = Basic * 0.4
 *   PF      = Basic * 0.12
 *   TDS     = slab(Gross)
 *   Special = CTC - Basic - HRA - PF
 *   Net     = Basic + HRA + Special - PF - TDS
 *
 * TODO: Replace with Supabase table `payroll_records` backed by RLS:
 *  - Employee can only SELECT their own rows
 *  - HR/Admin can SELECT all, INSERT and UPDATE
 *  - Approved rows locked via DB trigger
 */

export interface SalaryComponents {
  basic: number;
  hra: number;
  pf: number;
  tds: number;
  specialAllowance: number;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  month: string; // e.g. "Jun 2026"
  ctc: number;
  components: SalaryComponents;
  netPay: number;
  status: 'draft' | 'approved';
  revision: number;
  approvedBy?: string;
  approvedAt?: string;
  autoFormula: boolean;
}

export interface PayrollAuditEntry {
  timestamp: string;
  action: string;
  by: string;
  employeeId: string;
  netPay: number;
}

// ─── Shared formula util ─────────────────────────────────────────────────────

/** Single source of truth for all payroll calculations. */
export function computeNet(ctc: number): SalaryComponents & { netPay: number } {
  const basic = Math.round(ctc * 0.6);
  const hra = Math.round(basic * 0.4);
  const pf = Math.round(basic * 0.12);
  const gross = basic + hra;
  const tds = computeTDS(gross * 12); // annual gross → annual TDS → monthly
  const specialAllowance = ctc - basic - hra - pf;
  const netPay = basic + hra + specialAllowance - pf - tds;
  return { basic, hra, pf, tds, specialAllowance, netPay };
}

/** Simple TDS slab (monthly TDS based on annual gross) */
function computeTDS(annualGross: number): number {
  // eslint-disable-next-line no-useless-assignment
  let annualTDS = 0;
  if (annualGross <= 250000) {
    annualTDS = 0;
  } else if (annualGross <= 500000) {
    annualTDS = (annualGross - 250000) * 0.05;
  } else if (annualGross <= 1000000) {
    annualTDS = 12500 + (annualGross - 500000) * 0.2;
  } else {
    annualTDS = 112500 + (annualGross - 1000000) * 0.3;
  }
  return Math.round(annualTDS / 12);
}

// ─── Mock audit log ──────────────────────────────────────────────────────────

export const payrollAuditLog: PayrollAuditEntry[] = [];

// ─── Seed 40 employees ───────────────────────────────────────────────────────

const NAMES = [
  'Aarav Patel', 'Priya Sharma', 'Rohan Mehta', 'Sneha Iyer', 'Vikram Singh',
  'Ananya Das', 'Karthik Nair', 'Divya Reddy', 'Arjun Gupta', 'Pooja Joshi',
  'Siddharth Rao', 'Nisha Kapoor', 'Rahul Verma', 'Kavya Pillai', 'Manish Tiwari',
  'Aisha Khan', 'Deepak Pandey', 'Ritu Saxena', 'Gaurav Bose', 'Lalita Yadav',
  'Suresh Chatterjee', 'Meera Nambiar', 'Akash Jain', 'Tanvi Kulkarni', 'Harsh Malhotra',
  'Shruti Mishra', 'Nikhil Shah', 'Swathi Krishnan', 'Amit Desai', 'Pallavi Bhatt',
  'Rajesh Choudhary', 'Geeta Rawat', 'Varun Srivastava', 'Nidhi Tripathi', 'Mohan Kaur',
  'Rekha Ghosh', 'Praveen Kumar', 'Sunita Babu', 'Arun Negi', 'Madhuri Pandkar'
];

const DEPARTMENTS = ['Finance', 'Sales', 'Operations', 'Tech', 'Digital Marketing', 'Ops Heads'];
const CTC_RANGE = [360000, 420000, 480000, 540000, 600000, 660000, 720000, 840000, 960000, 1200000];

function seedRecords(): PayrollRecord[] {
  return NAMES.map((name, i) => {
    const ctc = Math.round(CTC_RANGE[i % CTC_RANGE.length] / 12); // Monthly CTC
    const comp = computeNet(ctc);
    return {
      id: `pay-${String(i + 1).padStart(3, '0')}`,
      employeeId: i === 0 ? 'VAR-024' : `VAR-${String(i + 1).padStart(3, '0')}`,
      employeeName: name,
      department: DEPARTMENTS[i % DEPARTMENTS.length],
      month: 'Jun 2026',
      ctc,
      components: {
        basic: comp.basic,
        hra: comp.hra,
        pf: comp.pf,
        tds: comp.tds,
        specialAllowance: comp.specialAllowance,
      },
      netPay: comp.netPay,
      status: i < 5 ? 'approved' : 'draft',
      revision: 1,
      approvedBy: i < 5 ? 'hr@varistor.in' : undefined,
      approvedAt: i < 5 ? '2026-06-14T10:00:00Z' : undefined,
      autoFormula: true,
    };
  });
}

/** In-memory store (simulates DB). Mutations are reflected immediately. */
let _records: PayrollRecord[] = seedRecords();

// ─── API functions ───────────────────────────────────────────────────────────

export async function getPayrollRecords(employeeId?: string): Promise<PayrollRecord[]> {
  await delay(180);
  // TODO: Payroll Integration Point — replace manual payable days with attendance-driven data:
  //   import { getPayrollAttendanceSnapshot } from './attendance';
  //   const snapshot = await getPayrollAttendanceSnapshot('YYYY-MM');
  //   Use snapshot[n].payableDays in place of the hardcoded working-days assumption below.
  if (employeeId) {
    return _records.filter(r => r.employeeId === employeeId);
  }
  return [..._records];
}

export async function updatePayrollRecord(
  id: string,
  patch: Partial<Pick<PayrollRecord, 'ctc' | 'components' | 'autoFormula'>>
): Promise<PayrollRecord | null> {
  await delay(80);
  const idx = _records.findIndex(r => r.id === id);
  if (idx === -1) return null;
  const rec = _records[idx];
  if (rec.status === 'approved') return null; // Locked

  const updated: PayrollRecord = { ...rec, ...patch };
  if (patch.autoFormula || (patch.ctc !== undefined && updated.autoFormula)) {
    const comp = computeNet(updated.ctc);
    updated.components = {
      basic: comp.basic,
      hra: comp.hra,
      pf: comp.pf,
      tds: comp.tds,
      specialAllowance: comp.specialAllowance,
    };
    updated.netPay = comp.netPay;
  } else if (patch.components) {
    const c = updated.components;
    updated.netPay = c.basic + c.hra + c.specialAllowance - c.pf - c.tds;
  }
  _records[idx] = updated;
  return updated;
}

export async function approvePayroll(ids: string[], approverEmail: string): Promise<void> {
  await delay(400);
  const now = new Date().toISOString();
  ids.forEach(id => {
    const idx = _records.findIndex(r => r.id === id);
    if (idx !== -1) {
      _records[idx] = {
        ..._records[idx],
        status: 'approved',
        approvedBy: approverEmail,
        approvedAt: now,
      };
      payrollAuditLog.push({
        timestamp: now,
        action: 'APPROVED',
        by: approverEmail,
        employeeId: _records[idx].employeeId,
        netPay: _records[idx].netPay,
      });
      console.log(`[Payroll Audit] APPROVED ${_records[idx].employeeId} net=${_records[idx].netPay} by=${approverEmail} at=${now}`);
    }
  });
}

export async function createRevision(id: string, approverEmail: string): Promise<PayrollRecord | null> {
  await delay(300);
  const idx = _records.findIndex(r => r.id === id);
  if (idx === -1) return null;
  const rec = _records[idx];
  const revised: PayrollRecord = {
    ...rec,
    id: `${rec.id}-r${rec.revision + 1}`,
    status: 'draft',
    revision: rec.revision + 1,
    approvedBy: undefined,
    approvedAt: undefined,
  };
  _records.push(revised);
  payrollAuditLog.push({
    timestamp: new Date().toISOString(),
    action: 'REVISION_CREATED',
    by: approverEmail,
    employeeId: rec.employeeId,
    netPay: rec.netPay,
  });
  return revised;
}

export async function applyFormulaToAll(ctcMultiplier?: number): Promise<void> {
  await delay(600);
  _records = _records.map(r => {
    if (r.status === 'approved') return r;
    const ctc = ctcMultiplier ? Math.round(r.ctc * ctcMultiplier) : r.ctc;
    const comp = computeNet(ctc);
    return {
      ...r,
      ctc,
      autoFormula: true,
      components: { basic: comp.basic, hra: comp.hra, pf: comp.pf, tds: comp.tds, specialAllowance: comp.specialAllowance },
      netPay: comp.netPay,
    };
  });
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Bulk Slip Email types & API ─────────────────────────────────────────────

/** One row parsed from the uploaded Excel file. */
export interface SlipRow {
  name: string;
  email: string;
  employeeId?: string;
  department?: string;
  month?: string;
  ctc: number;           // monthly CTC
  deductions: number;    // total deductions (PF + TDS etc.)
  netPay: number;        // ctc - deductions
}

export interface BulkSendResult {
  sent: number;
  failed: { email: string; name: string; error: string }[];
}

/**
 * Sends individual salary slip emails for every row.
 * Calls the Express backend at /api/payroll/send-slips.
 */
export async function sendBulkSlips(rows: SlipRow[]): Promise<BulkSendResult> {
  const res = await fetch('/api/payroll/send-slips', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slips: rows }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown server error' }));
    throw new Error(err.error || `Server returned ${res.status}`);
  }
  return res.json();
}
