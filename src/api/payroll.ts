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
  pfEmployee: number;
  pfEmployer: number;
  esi: number;
  pt: number;
  tds: number;
  specialAllowance: number;
  medical: number;
  ta: number;
  lta: number;
  reimbursement: number;
  incentives: number;
  overtime: number;
  otherDeductions: number;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  designation: string;
  month: string; // e.g. "Jun 2026"
  ctc: number;
  components: SalaryComponents;
  netPay: number;
  status: 'draft' | 'approved';
  revision: number;
  approvedBy?: string;
  approvedAt?: string;
  autoFormula: boolean;
  totalDays: number;
  payDays: number;
  clBalance: number;
  pfUan: string;
  monthlySalary: number;
}

export interface PayrollAuditEntry {
  timestamp: string;
  action: string;
  by: string;
  employeeId: string;
  netPay: number;
}

// ─── Shared formula util ─────────────────────────────────────────────────────

export function numberToWords(num: number): string {
  if (num === 0) return 'Rupees Zero Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const doubleDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tensPlace = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n < 10) return singleDigits[n];
    if (n < 20) return doubleDigits[n - 10];
    const unit = n % 10;
    const ten = Math.floor(n / 10);
    return tensPlace[ten] + (unit ? '-' + singleDigits[unit] : '');
  }

  function convertThreeDigits(n: number): string {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let str = '';
    if (hundred) {
      str += singleDigits[hundred] + ' Hundred';
    }
    if (rest) {
      if (str) str += ' and ';
      str += convertTwoDigits(rest);
    }
    return str;
  }

  const parts = num.toFixed(2).split('.');
  const rupeesVal = parseInt(parts[0], 10);
  const paiseVal = parseInt(parts[1], 10);

  let rupeesStr = '';
  if (rupeesVal === 0) {
    rupeesStr = 'Zero';
  } else {
    let tempVal = rupeesVal;
    
    // Crores
    const crores = Math.floor(tempVal / 10000000);
    tempVal %= 10000000;
    if (crores) {
      rupeesStr += convertThreeDigits(crores) + ' Crore ';
    }

    // Lakhs
    const lakhs = Math.floor(tempVal / 100000);
    tempVal %= 100000;
    if (lakhs) {
      rupeesStr += convertTwoDigits(lakhs) + ' Lakh ';
    }

    // Thousands
    const thousands = Math.floor(tempVal / 1000);
    tempVal %= 1000;
    if (thousands) {
      rupeesStr += convertTwoDigits(thousands) + ' Thousand ';
    }

    if (tempVal) {
      rupeesStr += convertThreeDigits(tempVal);
    }
  }

  let paiseStr = '';
  if (paiseVal > 0) {
    paiseStr = ' and ' + convertTwoDigits(paiseVal) + ' Paise';
  }

  return `Rupees ${rupeesStr.trim()}${paiseStr} Only`;
}

/** Single source of truth for all payroll calculations. */
export function computeNet(params: {
  monthlySalary: number;
  totalDays?: number;
  payDays?: number;
  medical?: number;
  ta?: number;
  lta?: number;
  reimbursement?: number;
  incentives?: number;
  overtime?: number;
  tds?: number;
  otherDeductions?: number;
  monthlyCtc?: number;
}) {
  const totalDays = params.totalDays ?? 30;
  const payDays = params.payDays ?? 30;
  const medical = params.medical ?? 1250;
  const ta = params.ta ?? 2500;
  const lta = params.lta ?? 3500;
  const reimbursement = params.reimbursement ?? 0;
  const incentives = params.incentives ?? 0;
  const overtime = params.overtime ?? 0;
  const tds = params.tds ?? 0;
  const otherDeductions = params.otherDeductions ?? 0;
  const monthlySalary = params.monthlySalary;

  const prorata = Math.round((monthlySalary / totalDays) * payDays);
  const basic = Math.round(prorata * 0.5);
  const hra = Math.round(basic * 0.5);
  const specialAllowance = prorata - (basic + hra + medical + ta + lta);
  const pfEmployee = basic >= 15000 ? 1800 : Math.round(basic * 0.12);
  const pfEmployer = pfEmployee; // matches PF Employee

  const gross = prorata;
  const monthlyCtc = params.monthlyCtc ?? monthlySalary;
  const esi = monthlyCtc > 21000 ? 0 : Math.ceil(gross * 0.0325);
  const pt = gross >= 15001 ? 200 : 0;

  const totalDeductions = pfEmployee + pfEmployer + esi + pt + tds + otherDeductions;
  const netPay = gross - totalDeductions + reimbursement + incentives + overtime;

  return {
    monthlySalary,
    totalDays,
    payDays,
    prorata,
    basic,
    hra,
    medical,
    ta,
    lta,
    specialAllowance,
    pfEmployee,
    pfEmployer,
    esi,
    pt,
    tds,
    otherDeductions,
    totalDeductions,
    reimbursement,
    incentives,
    overtime,
    netPay,
    gross
  };
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
    const monthlySalary = Math.round(CTC_RANGE[i % CTC_RANGE.length] / 12); // Monthly Salary
    const comp = computeNet({
      monthlySalary,
      totalDays: 30,
      payDays: 30
    });
    return {
      id: `pay-${String(i + 1).padStart(3, '0')}`,
      employeeId: i === 0 ? 'VAR-024' : `VAR-${String(i + 1).padStart(3, '0')}`,
      employeeName: name,
      department: DEPARTMENTS[i % DEPARTMENTS.length],
      designation: i % 2 === 0 ? 'DEVELOPER' : 'WELDER',
      month: 'Jun 2026',
      ctc: monthlySalary,
      monthlySalary,
      totalDays: 30,
      payDays: 30,
      clBalance: 0,
      pfUan: '101234567890',
      components: {
        basic: comp.basic,
        hra: comp.hra,
        pfEmployee: comp.pfEmployee,
        pfEmployer: comp.pfEmployer,
        esi: comp.esi,
        pt: comp.pt,
        tds: comp.tds,
        specialAllowance: comp.specialAllowance,
        medical: comp.medical,
        ta: comp.ta,
        lta: comp.lta,
        reimbursement: comp.reimbursement,
        incentives: comp.incentives,
        overtime: comp.overtime,
        otherDeductions: comp.otherDeductions,
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
  patch: Partial<Omit<PayrollRecord, 'id' | 'employeeId' | 'employeeName' | 'status'>>
): Promise<PayrollRecord | null> {
  await delay(80);
  const idx = _records.findIndex(r => r.id === id);
  if (idx === -1) return null;
  const rec = _records[idx];
  if (rec.status === 'approved') return null; // Locked

  const updated: PayrollRecord = { ...rec, ...patch };
  if (patch.autoFormula || (patch.monthlySalary !== undefined && updated.autoFormula) || (patch.ctc !== undefined && updated.autoFormula) || (patch.payDays !== undefined && updated.autoFormula) || (patch.totalDays !== undefined && updated.autoFormula)) {
    if (patch.ctc !== undefined) {
      updated.monthlySalary = patch.ctc;
    } else if (patch.monthlySalary !== undefined) {
      updated.ctc = patch.monthlySalary;
    }
    const comp = computeNet({
      monthlySalary: updated.monthlySalary,
      totalDays: updated.totalDays,
      payDays: updated.payDays,
      medical: updated.components.medical,
      ta: updated.components.ta,
      lta: updated.components.lta,
      reimbursement: updated.components.reimbursement,
      incentives: updated.components.incentives,
      overtime: updated.components.overtime,
      tds: updated.components.tds,
      otherDeductions: updated.components.otherDeductions,
    });
    updated.components = {
      basic: comp.basic,
      hra: comp.hra,
      pfEmployee: comp.pfEmployee,
      pfEmployer: comp.pfEmployer,
      esi: comp.esi,
      pt: comp.pt,
      tds: comp.tds,
      specialAllowance: comp.specialAllowance,
      medical: comp.medical,
      ta: comp.ta,
      lta: comp.lta,
      reimbursement: comp.reimbursement,
      incentives: comp.incentives,
      overtime: comp.overtime,
      otherDeductions: comp.otherDeductions,
    };
    updated.netPay = comp.netPay;
  } else if (patch.components) {
    const c = updated.components;
    const gross = c.basic + c.hra + c.medical + c.ta + c.lta + c.specialAllowance;
    const totalDeductions = c.pfEmployee + c.pfEmployer + c.esi + c.pt + c.tds + c.otherDeductions;
    updated.netPay = gross - totalDeductions + c.reimbursement + c.incentives + c.overtime;
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
    const monthlySalary = ctcMultiplier ? Math.round(r.monthlySalary * ctcMultiplier) : r.monthlySalary;
    const comp = computeNet({
      monthlySalary,
      totalDays: r.totalDays,
      payDays: r.payDays,
      medical: r.components.medical,
      ta: r.components.ta,
      lta: r.components.lta,
      reimbursement: r.components.reimbursement,
      incentives: r.components.incentives,
      overtime: r.components.overtime,
      tds: r.components.tds,
      otherDeductions: r.components.otherDeductions,
    });
    return {
      ...r,
      ctc: monthlySalary,
      monthlySalary,
      autoFormula: true,
      components: {
        basic: comp.basic,
        hra: comp.hra,
        pfEmployee: comp.pfEmployee,
        pfEmployer: comp.pfEmployer,
        esi: comp.esi,
        pt: comp.pt,
        tds: comp.tds,
        specialAllowance: comp.specialAllowance,
        medical: comp.medical,
        ta: comp.ta,
        lta: comp.lta,
        reimbursement: comp.reimbursement,
        incentives: comp.incentives,
        overtime: comp.overtime,
        otherDeductions: comp.otherDeductions,
      },
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
  designation?: string;
  month?: string;
  monthlySalary: number;
  totalDays: number;
  payDays: number;
  clBalance?: number;
  pfUan?: string;
  medical?: number;
  ta?: number;
  lta?: number;
  reimbursement?: number;
  incentives?: number;
  overtime?: number;
  tds?: number;
  otherDeductions?: number;
  basic?: number;
  hra?: number;
  specialAllowance?: number;
  pfEmployee?: number;
  pfEmployer?: number;
  esi?: number;
  pt?: number;
  ctc: number;
  deductions: number;
  netPay: number;
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
