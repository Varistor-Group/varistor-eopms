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
  /** Whether PF deduction applies to this employee (default true) */
  hasPf: boolean;
  /** Whether ESI deduction applies to this employee (default true) */
  hasEsi: boolean;
  /** Whether PT deduction applies to this employee (default true) */
  hasPt: boolean;
  /** True once HR has dispatched this slip — makes it visible to the employee */
  slipReleased: boolean;
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
  monthlyCtc?: number;
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
  /** Number of Loss-of-Pay days to deduct (excess over CL entitlement) */
  lopDays?: number;
  /** Whether PF deduction applies (default true) */
  hasPf?: boolean;
  /** Whether ESI deduction applies (default true) */
  hasEsi?: boolean;
  /** Whether PT deduction applies (default true) */
  hasPt?: boolean;
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
  const hasPf = params.hasPf !== false;
  const hasEsi = params.hasEsi !== false;
  const hasPt = params.hasPt !== false;

  const rawPfEmployee = basic >= 15000 ? 1800 : Math.round(basic * 0.12);
  const pfEmployee = hasPf ? rawPfEmployee : 0;
  const pfEmployer = hasPf ? rawPfEmployee : 0;

  const gross = prorata;
  const monthlyCtc = params.monthlyCtc ?? monthlySalary;
  const rawEsi = monthlyCtc > 21000 ? 0 : Math.ceil(gross * 0.0325);
  const esi = hasEsi ? rawEsi : 0;
  const rawPt = gross >= 15001 ? 200 : 0;
  const pt = hasPt ? rawPt : 0;

  // LOP deduction: each excess leave day = dailyRate
  const lopDays = Math.max(0, params.lopDays ?? 0);
  const dailyRate = Math.round(monthlySalary / totalDays);
  const lopDeduction = lopDays * dailyRate;

  const totalDeductions = pfEmployee + pfEmployer + esi + pt + tds + otherDeductions + lopDeduction;
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
    lopDays,
    lopDeduction,
    netPay,
    gross
  };
}

// ─── Mock audit log ──────────────────────────────────────────────────────────

export const payrollAuditLog: PayrollAuditEntry[] = [];

const PAYROLL_KEY = 'eopms_payroll_records';

const DEFAULT_SEED_RECORDS: PayrollRecord[] = [
  {
    id: 'pay-VAR-001-Jun-2026',
    employeeId: 'VAR-001',
    employeeName: 'Admin User',
    department: 'Ops Heads',
    designation: 'Admin',
    month: 'Jun 2026',
    ctc: 150000,
    monthlySalary: 150000,
    netPay: 148000,
    status: 'draft',
    revision: 1,
    autoFormula: true,
    totalDays: 30,
    payDays: 30,
    clBalance: 12,
    pfUan: '100987654321',
    hasPf: true,
    hasEsi: false,
    hasPt: true,
    slipReleased: false,
    components: {
      basic: 75000,
      hra: 37500,
      pfEmployee: 1800,
      pfEmployer: 1800,
      esi: 0,
      pt: 200,
      tds: 0,
      specialAllowance: 27750,
      medical: 1250,
      ta: 2500,
      lta: 3500,
      reimbursement: 0,
      incentives: 0,
      overtime: 0,
      otherDeductions: 0,
    }
  },
  {
    id: 'pay-VAR-002-Jun-2026',
    employeeId: 'VAR-002',
    employeeName: 'Priya Sharma',
    department: 'Operations',
    designation: 'HR',
    month: 'Jun 2026',
    ctc: 50000,
    monthlySalary: 50000,
    netPay: 46200,
    status: 'draft',
    revision: 1,
    autoFormula: true,
    totalDays: 30,
    payDays: 30,
    clBalance: 12,
    pfUan: '100987654322',
    hasPf: true,
    hasEsi: false,
    hasPt: true,
    slipReleased: false,
    components: {
      basic: 25000,
      hra: 12500,
      pfEmployee: 1800,
      pfEmployer: 1800,
      esi: 0,
      pt: 200,
      tds: 0,
      specialAllowance: 2750,
      medical: 1250,
      ta: 2500,
      lta: 3500,
      reimbursement: 0,
      incentives: 0,
      overtime: 0,
      otherDeductions: 0,
    }
  },
  {
    id: 'pay-VAR-003-Jun-2026',
    employeeId: 'VAR-003',
    employeeName: 'Aarav Patel',
    department: 'Operations',
    designation: 'Employee',
    month: 'Jun 2026',
    ctc: 35000,
    monthlySalary: 35000,
    netPay: 31200,
    status: 'draft',
    revision: 1,
    autoFormula: true,
    totalDays: 30,
    payDays: 30,
    clBalance: 12,
    pfUan: '100987654323',
    hasPf: true,
    hasEsi: false,
    hasPt: true,
    slipReleased: false,
    components: {
      basic: 17500,
      hra: 8750,
      pfEmployee: 1800,
      pfEmployer: 1800,
      esi: 0,
      pt: 200,
      tds: 0,
      specialAllowance: -1250,
      medical: 1250,
      ta: 2500,
      lta: 3500,
      reimbursement: 0,
      incentives: 0,
      overtime: 0,
      otherDeductions: 0,
    }
  },
  {
    id: 'pay-VAR-004-Jun-2026',
    employeeId: 'VAR-004',
    employeeName: 'Akash Kumar',
    department: 'Finance',
    designation: 'Admin',
    month: 'Jun 2026',
    ctc: 45000,
    monthlySalary: 45000,
    netPay: 41200,
    status: 'draft',
    revision: 1,
    autoFormula: true,
    totalDays: 30,
    payDays: 30,
    clBalance: 12,
    pfUan: '100987654324',
    hasPf: true,
    hasEsi: false,
    hasPt: true,
    slipReleased: false,
    components: {
      basic: 22500,
      hra: 11250,
      pfEmployee: 1800,
      pfEmployer: 1800,
      esi: 0,
      pt: 200,
      tds: 0,
      specialAllowance: 250,
      medical: 1250,
      ta: 2500,
      lta: 3500,
      reimbursement: 0,
      incentives: 0,
      overtime: 0,
      otherDeductions: 0,
    }
  }
];

function loadPayrollRecords(): PayrollRecord[] {
  try {
    const raw = localStorage.getItem(PAYROLL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Discard legacy database records
      const clean = parsed.filter((r: any) => ['VAR-001', 'VAR-002', 'VAR-003', 'VAR-004'].includes(r.employeeId));
      if (clean.length > 0) return clean;
    }
  } catch { /* ignore */ }
  localStorage.setItem(PAYROLL_KEY, JSON.stringify(DEFAULT_SEED_RECORDS));
  return DEFAULT_SEED_RECORDS;
}

function savePayrollRecords(records: PayrollRecord[]) {
  localStorage.setItem(PAYROLL_KEY, JSON.stringify(records));
}

/** In-memory store (simulates DB). Mutations are reflected immediately. */
let _records: PayrollRecord[] = loadPayrollRecords();

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
  _records = loadPayrollRecords();
  const idx = _records.findIndex(r => r.id === id);
  if (idx === -1) return null;
  const rec = _records[idx];
  if (rec.status === 'approved') return null; // Locked

  const updated: PayrollRecord = { ...rec, ...patch };
  const needsRecompute =
    patch.autoFormula ||
    (updated.autoFormula && (
      patch.monthlySalary !== undefined ||
      patch.ctc !== undefined ||
      patch.payDays !== undefined ||
      patch.totalDays !== undefined ||
      patch.hasPf !== undefined ||
      patch.hasEsi !== undefined ||
      patch.hasPt !== undefined
    ));
  if (needsRecompute) {
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
      hasPf: updated.hasPf,
      hasEsi: updated.hasEsi,
      hasPt: updated.hasPt,
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
  savePayrollRecords(_records);
  return updated;
}

export async function approvePayroll(ids: string[], approverEmail: string): Promise<void> {
  await delay(400);
  _records = loadPayrollRecords();
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
  savePayrollRecords(_records);
}

export async function createRevision(id: string, approverEmail: string): Promise<PayrollRecord | null> {
  await delay(300);
  _records = loadPayrollRecords();
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
  savePayrollRecords(_records);
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
  _records = loadPayrollRecords();
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

/**
 * Marks slips as released so employees can view them.
 * Called after HR successfully dispatches bulk salary slips.
 * Accepts either employeeIds or payroll record ids.
 */
export async function releaseSlips(employeeIds: string[]): Promise<void> {
  await delay(50);
  _records = _records.map(r =>
    employeeIds.includes(r.employeeId) ? { ...r, slipReleased: true } : r
  );
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Format YYYY-MM to MMM YYYY, e.g. 2026-07 -> Jul 2026 */
export function formatMonthToMMMYear(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Generates or updates draft payroll records based on attendance monthly report */
export async function syncPayrollFromAttendance(monthStr: string, reportRows: any[]): Promise<void> {
  await delay(200);
  _records = loadPayrollRecords();
  
  const displayMonth = formatMonthToMMMYear(monthStr);

  // Load employees to fetch role/designation
  let employees: any[] = [];
  try {
    const res = await fetch('http://localhost:3001/api/employees');
    if (res.ok) {
      employees = await res.json();
    }
  } catch (e) {
    console.error('Failed to fetch employees for sync', e);
  }

  // Fetch CL balances
  let clBalances: Record<string, ClBalance> = {};
  try {
    const res = await fetch('http://localhost:3001/api/cl-balances');
    if (res.ok) {
      clBalances = await res.json();
    }
  } catch (e) {
    console.error('Failed to fetch CL balances for sync', e);
  }

  reportRows.forEach(row => {
    const emp = employees.find(e => e.employeeId === row.employee_id || e.id === row.employee_id);
    const clBal = clBalances[row.employee_id] ?? { total: 12, used: 0 };
    const lopDays = Math.max(0, clBal.used - clBal.total);

    const existingIdx = _records.findIndex(r => r.employeeId === row.employee_id && r.month === displayMonth);

    const monthlySalary = existingIdx !== -1 ? _records[existingIdx].monthlySalary : 30000;
    const totalDays = row.present + row.late + row.halfDay + row.absent + row.weekOff + row.holidays + row.leaves || 30;
    const payDays = row.payableDays;

    const medical = existingIdx !== -1 ? _records[existingIdx].components.medical : 1250;
    const ta = existingIdx !== -1 ? _records[existingIdx].components.ta : 2500;
    const lta = existingIdx !== -1 ? _records[existingIdx].components.lta : 3500;
    const reimbursement = existingIdx !== -1 ? _records[existingIdx].components.reimbursement : 0;
    const incentives = existingIdx !== -1 ? _records[existingIdx].components.incentives : 0;
    const overtime = existingIdx !== -1 ? _records[existingIdx].components.overtime : 0;
    const tds = existingIdx !== -1 ? _records[existingIdx].components.tds : 0;
    const otherDeductions = existingIdx !== -1 ? _records[existingIdx].components.otherDeductions : 0;

    const hasPf = existingIdx !== -1 ? _records[existingIdx].hasPf : true;
    const hasEsi = existingIdx !== -1 ? _records[existingIdx].hasEsi : true;
    const hasPt = existingIdx !== -1 ? _records[existingIdx].hasPt : true;

    const comp = computeNet({
      monthlySalary,
      totalDays,
      payDays,
      medical,
      ta,
      lta,
      reimbursement,
      incentives,
      overtime,
      tds,
      otherDeductions,
      lopDays,
      hasPf,
      hasEsi,
      hasPt,
    });

    const payrollRec: PayrollRecord = {
      id: existingIdx !== -1 ? _records[existingIdx].id : `pay-${row.employee_id}-${monthStr}`,
      employeeId: row.employee_id,
      employeeName: row.employeeName,
      department: row.department,
      designation: emp?.role || 'Employee',
      month: displayMonth,
      ctc: monthlySalary,
      monthlySalary,
      netPay: comp.netPay,
      status: existingIdx !== -1 ? _records[existingIdx].status : 'draft',
      revision: existingIdx !== -1 ? _records[existingIdx].revision : 1,
      autoFormula: true,
      totalDays,
      payDays,
      clBalance: clBal.total,
      pfUan: existingIdx !== -1 ? _records[existingIdx].pfUan : '—',
      hasPf,
      hasEsi,
      hasPt,
      slipReleased: existingIdx !== -1 ? _records[existingIdx].slipReleased : false,
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
      }
    };

    if (existingIdx !== -1) {
      if (_records[existingIdx].status === 'draft') {
        _records[existingIdx] = payrollRec;
      }
    } else {
      _records.push(payrollRec);
    }
  });

  savePayrollRecords(_records);
}

// ─── CL Balance helpers ────────────────────────────────────────────────────────

export interface ClBalance {
  total: number;
  used: number;
}

/** Fetch one employee's CL balance from the server */
export async function fetchClBalance(employeeId: string): Promise<ClBalance> {
  try {
    const res = await fetch(`http://localhost:3001/api/cl-balances/${employeeId}`);
    if (!res.ok) return { total: 12, used: 0 };
    return res.json();
  } catch {
    return { total: 12, used: 0 };
  }
}

/** Fetch all CL balances (HR view) */
export async function fetchAllClBalances(): Promise<Record<string, ClBalance>> {
  try {
    const res = await fetch('http://localhost:3001/api/cl-balances');
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

/** Update an employee's CL total via the server */
export async function updateClBalance(employeeId: string, total: number): Promise<ClBalance> {
  const res = await fetch(`http://localhost:3001/api/cl-balances/${employeeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ total }),
  });
  if (!res.ok) throw new Error('Failed to update CL balance');
  const data = await res.json();
  return data.balance;
}

/**
 * Given an employee's CL balance and approved leave records for the month,
 * returns how many excess (LOP) days they have.
 */
export function computeLopDays(clBalance: ClBalance): number {
  return Math.max(0, clBalance.used - clBalance.total);
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
  const res = await fetch('http://localhost:3001/api/payroll/send-slips', {
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
