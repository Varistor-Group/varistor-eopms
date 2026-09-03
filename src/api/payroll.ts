/**
 * PAYROLL SERVICE — MySQL (via PHP backend)
 * Converted from localStorage-only mock storage. The formula engine itself
 * (computeNet, evaluateFormula, numberToWords) is UNCHANGED — only where
 * data is read from / written to has changed.
 *
 * NOTE: getPayrollRecords still calls getMonthlyReport() from ./attendance,
 * which is not yet converted off Supabase — separate conversion pass needed.
 */
import { apiFetch } from './httpClient';
import { getEmployees } from './employees';
import { getMonthlyReport } from './attendance';

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
  month: string;
  ctc: number;
  components: SalaryComponents;
  netPay: number;
  finalPay: number;
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
  hasPf: boolean;
  hasEsi: boolean;
  hasPt: boolean;
  slipReleased: boolean;
  additionHeads?: string[];
  deductionHeads?: string[];
  additionValues?: number[];
  deductionValues?: number[];
  attendanceBreakdown?: {
    present: number;
    weekOff: number;
    leaves: number;
    holidays: number;
    absent: number;
  };
  deduction?: number;
  lopDays?: number;
  lopDeduction?: number;
}

export interface PayrollAuditEntry {
  timestamp: string;
  action: string;
  by: string;
  employeeId: string;
  netPay: number;
  finalPay: number;
}

// ─── Shared formula util (UNCHANGED) ─────────────────────────────────────────

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

    const crores = Math.floor(tempVal / 10000000);
    tempVal %= 10000000;
    if (crores) {
      rupeesStr += convertThreeDigits(crores) + ' Crore ';
    }

    const lakhs = Math.floor(tempVal / 100000);
    tempVal %= 100000;
    if (lakhs) {
      rupeesStr += convertTwoDigits(lakhs) + ' Lakh ';
    }

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

function evaluateFormula(equation: string, context: Record<string, number>): number {
  try {
    let sanitized = equation
      .replace(/\b(?:Math\.)?round\(/g, 'Math.round(')
      .replace(/\b(?:Math\.)?ceil\(/g, 'Math.ceil(')
      .replace(/\b(?:Math\.)?floor\(/g, 'Math.floor(')
      .replace(/%/g, ' * 0.01');

    const sortedKeys = Object.keys(context).sort((a, b) => b.length - a.length);
    for (const key of sortedKeys) {
      const val = context[key];
      const escapedKey = key.replace(/\$/g, '\\$');
      const regex = new RegExp(escapedKey + '\\b', 'gi');
      sanitized = sanitized.replace(regex, String(val));
    }

    const result = new Function(`return (${sanitized});`)();
    return typeof result === 'number' && !isNaN(result) ? Math.round(result) : 0;
  } catch (e) {
    console.error('Error evaluating formula:', equation, e);
    return 0;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getPTAmount(gross: number, ranges: any[]): number {
  for (const range of ranges) {
    if (gross >= range.min && gross <= range.max) {
      return range.amount;
    }
  }
  return 0;
}

export function getDaysInMonth(monthStr: string): number {
  if (!monthStr) return 30;
  const d = new Date(monthStr);
  if (isNaN(d.getTime())) return 30;
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

// ─── Settings cache (replaces direct localStorage reads in computeNet) ───────
// Populated once via loadPayrollSettings(); computeNet reads from this cache
// synchronously (same call signature as before), falling back to hardcoded
// defaults if the cache hasn't been loaded yet — matches old behavior where
// localStorage might also be empty on first run.

interface PayrollSettingsCache {
  additions: string[];
  deductions: string[];
  ptRanges: { min: number; max: number; amount: number }[];
  pfPercentage: number;
  esiPercentage: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formulas: any[];
  employeeDetails: Record<string, number>;
}

const DEFAULT_FORMULAS = [
  { code: "F1", name: "Basic", equation: "(($BS * 0.50) / $DIM) * ($SP + $SW + $SL + $SH)" },
  { code: "F2", name: "HRA", equation: "((($BS * 0.50) / $DIM) * ($SP + $SW + $SL + $SH)) * 0.50" },
  { code: "F3", name: "MEDICAL ALLOWANCE", equation: "Math.round(1250 / $DIM * ($SP + $SW + $SL + $SH))" },
  { code: "F4", name: "TA", equation: "Math.round(2500 / $DIM * ($SP + $SW + $SL + $SH))" },
  { code: "F5", name: "LTA", equation: "Math.round(3500 / $DIM * ($SP + $SW + $SL + $SH))" },
  { code: "F6", name: "SPECIAL ALLOWANCE", equation: "$Prorata - ($Basic + $HRA + $MEDICALALLOWANCE + $TA + $LTA)" },
  { code: "F7", name: "PF", equation: "($Basic >= 15000 ? 1800 : Math.round($Basic * 12%)) * $haspf" },
  { code: "F8", name: "ESI", equation: "($Gross > 21000 ? 0 : Math.ceil($Gross * 3.25%)) * $hasesi" },
  { code: "F9", name: "PT", equation: "($Gross >= 15001 ? 200 : 0) * $haspt" }
];

let settingsCache: PayrollSettingsCache = {
  additions: ["Basic", "HRA", "MEDICAL ALLOWANCE", "TA", "LTA", "SPECIAL ALLOWANCE", "", "", "", ""],
  deductions: ["PF Employee", "PF Employer", "ESI", "PT", "Advance salary adjut", "", "", "", "", ""],
  ptRanges: [
    { min: 0, max: 2999, amount: 0 },
    { min: 3000, max: 5999, amount: 20 },
    { min: 6000, max: 8999, amount: 80 },
    { min: 9000, max: 11999, amount: 150 },
    { min: 12000, max: 500000, amount: 200 }
  ],
  pfPercentage: 12,
  esiPercentage: 0,
  formulas: DEFAULT_FORMULAS,
  employeeDetails: {},
};

let settingsLoaded = false;

/** Call once (e.g. on app/payroll module mount) to populate the settings cache from MySQL. */
export async function loadPayrollSettings(): Promise<void> {
  try {
    const res = await apiFetch('/api/payroll-settings');
    if (!res.ok) return;
    const data = await res.json();

    if (data.heads) {
      if (data.heads.additions) settingsCache.additions = data.heads.additions;
      if (data.heads.deductions) settingsCache.deductions = data.heads.deductions;
      if (data.heads.ptRanges) settingsCache.ptRanges = data.heads.ptRanges;
      if (data.heads.pfPercentage !== undefined) settingsCache.pfPercentage = data.heads.pfPercentage;
      if (data.heads.esiPercentage !== undefined) settingsCache.esiPercentage = data.heads.esiPercentage;
    }
    if (data.formulas && Array.isArray(data.formulas) && data.formulas.length >= 9) {
      settingsCache.formulas = data.formulas;
    }
    if (data.employeeDetails) {
      settingsCache.employeeDetails = data.employeeDetails;
    }
    settingsLoaded = true;
  } catch (e) {
    console.error('[loadPayrollSettings]', e);
  }
}

/** Persist one settings key (heads/formulas/employeeDetails) to MySQL and update the local cache. */
async function savePayrollSetting(key: 'heads' | 'formulas' | 'employeeDetails', value: unknown): Promise<void> {
  try {
    await apiFetch(`/api/payroll-settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    });
  } catch (e) {
    console.error('[savePayrollSetting]', key, e);
  }
}

async function setEmployeeSalaryDetail(employeeId: string, monthlySalary: number): Promise<void> {
  settingsCache.employeeDetails[employeeId] = monthlySalary;
  await savePayrollSetting('employeeDetails', settingsCache.employeeDetails);
}

/** Single source of truth for all payroll calculations. UNCHANGED logic — only reads settingsCache instead of localStorage. */
export function computeNet(params: {
  monthlySalary: number;
  month?: string;
  monthlyCtc?: number;
  totalDays?: number;
  payDays?: number;
  medical?: number;
  ta?: number;
  lta?: number;
  basic?: number;
  hra?: number;
  specialAllowance?: number;
  reimbursement?: number;
  incentives?: number;
  overtime?: number;
  tds?: number;
  otherDeductions?: number;
  lopDays?: number;
  hasPf?: boolean;
  hasEsi?: boolean;
  hasPt?: boolean;
  employeeId?: string;
  attendanceBreakdown?: {
    present: number;
    weekOff: number;
    leaves: number;
    holidays: number;
    absent: number;
  };
}) {
  const totalDays = params.totalDays ?? getDaysInMonth(params.month || 'June 2026');
  const payDays = params.payDays ?? 30;
  const monthlySalary = params.monthlySalary;
  const ctc = params.monthlyCtc ?? monthlySalary;

  const addHeads = [...settingsCache.additions];
  const dedHeads = [...settingsCache.deductions];
  const ptRanges = settingsCache.ptRanges;
  const pfPct = settingsCache.pfPercentage;
  const esiPct = settingsCache.esiPercentage;
  const formulas = settingsCache.formulas;
  const employeeDetails = settingsCache.employeeDetails;

  const refAmt = monthlySalary || (params.employeeId ? employeeDetails[params.employeeId] : 0) || 0;

  const present = params.attendanceBreakdown?.present ?? payDays;
  const weekOff = params.attendanceBreakdown?.weekOff ?? 0;
  const leaves = params.attendanceBreakdown?.leaves ?? 0;
  const holidays = params.attendanceBreakdown?.holidays ?? 0;

  const context: Record<string, number> = {
    '$BS': refAmt,
    '$DIM': totalDays,
    '$SP': present,
    '$SW': weekOff,
    '$SL': leaves,
    '$SH': holidays,
    '$haspf': params.hasPf !== false ? 1 : 0,
    '$hasesi': params.hasEsi !== false ? 1 : 0,
    '$haspt': params.hasPt !== false ? 1 : 0,
  };

  const additionValues = Array(10).fill(0);
  const deductionValues = Array(10).fill(0);

  const prorata = monthlySalary;

  for (let i = 0; i < 10; i++) {
    const headName = addHeads[i]?.trim();
    if (!headName) continue;

    const formula = formulas.find(f => f.name?.trim().toLowerCase() === headName.toLowerCase());

    if (headName.toLowerCase() === 'basic' && params.basic !== undefined) {
      additionValues[i] = params.basic;
    } else if (headName.toLowerCase() === 'hra' && params.hra !== undefined) {
      additionValues[i] = params.hra;
    } else if (headName.toLowerCase().includes('special') && params.specialAllowance !== undefined) {
      additionValues[i] = params.specialAllowance;
    } else if (['medical', 'medical allowance'].includes(headName.toLowerCase()) && params.medical !== undefined) {
      additionValues[i] = params.medical;
    } else if (['ta', 'travel allowance'].includes(headName.toLowerCase()) && params.ta !== undefined) {
      additionValues[i] = params.ta;
    } else if (['lta', 'leave travel allowance'].includes(headName.toLowerCase()) && params.lta !== undefined) {
      additionValues[i] = params.lta;
    } else if (headName.toLowerCase().includes('special')) {
      const sumOtherAdditions = additionValues.reduce((acc, v, idx) => idx < i ? acc + v : acc, 0);
      additionValues[i] = monthlySalary - sumOtherAdditions;
    } else if (formula?.equation) {
      additionValues[i] = evaluateFormula(formula.equation, context);
    } else {
      if (headName.toLowerCase() === 'basic') {
        additionValues[i] = Math.round(prorata * 0.5);
      } else if (headName.toLowerCase() === 'hra') {
        const basicVal = context['$basic'] ?? Math.round(prorata * 0.5);
        additionValues[i] = Math.round(basicVal * 0.5);
      } else if (['medical', 'medical allowance'].includes(headName.toLowerCase())) {
        additionValues[i] = params.medical ?? 1250;
      } else if (['ta', 'travel allowance'].includes(headName.toLowerCase())) {
        additionValues[i] = params.ta ?? 2500;
      } else if (['lta', 'leave travel allowance'].includes(headName.toLowerCase())) {
        additionValues[i] = params.lta ?? 3500;
      } else {
        additionValues[i] = 0;
      }
    }

    const cleanName = headName.replace(/[^a-zA-Z0-9]/g, '');
    context['$' + cleanName] = additionValues[i];
    context['$' + cleanName.toLowerCase()] = additionValues[i];
    context['$' + cleanName.toUpperCase()] = additionValues[i];
    context['$' + headName.replace(/\s+/g, '_')] = additionValues[i];
    context['$add_head_' + (i + 1)] = additionValues[i];
  }

  const gross = additionValues.reduce((a, b) => a + b, 0);
  context['$Gross'] = gross;
  context['$gross'] = gross;
  context['$Prorata'] = gross;
  context['$prorata'] = gross;

  const basic = context['$basic'] ?? Math.round(prorata * 0.5);

  for (let i = 0; i < 10; i++) {
    const headName = dedHeads[i]?.trim();
    if (!headName) continue;

    const formula = formulas.find(f => f.name?.trim().toLowerCase() === headName.toLowerCase());
    const isPf = /(^|[^a-z])pf([^a-z]|$)/i.test(headName) || /provident/i.test(headName);
    const isEsi = /(^|[^a-z])esi([^a-z]|$)/i.test(headName);
    const isPt = /(^|[^a-z])pt([^a-z]|$)/i.test(headName) || /professional\s*tax/i.test(headName);

    if (formula?.equation) {
      if (isPf && params.hasPf === false) {
        deductionValues[i] = 0;
      } else if (isEsi && params.hasEsi === false) {
        deductionValues[i] = 0;
      } else if (isPt && params.hasPt === false) {
        deductionValues[i] = 0;
      } else {
        deductionValues[i] = evaluateFormula(formula.equation, context);
      }
    } else {
      if (isPf) {
        const rawPf = basic >= 15000 ? 1800 : Math.round(basic * (pfPct / 100));
        deductionValues[i] = (params.hasPf !== false) ? rawPf : 0;
      } else if (isEsi) {
        const rawEsi = ctc > 21000 ? 0 : Math.ceil(gross * (esiPct / 100 || 0.0325));
        deductionValues[i] = (params.hasEsi !== false) ? rawEsi : 0;
      } else if (isPt) {
        const rawPt = getPTAmount(gross, ptRanges);
        deductionValues[i] = (params.hasPt !== false) ? rawPt : 0;
      } else if (headName.toLowerCase() === 'tds') {
        deductionValues[i] = params.tds ?? 0;
      } else if (['other deductions', 'advance salary adjut'].includes(headName.toLowerCase())) {
        deductionValues[i] = params.otherDeductions ?? 0;
      } else {
        deductionValues[i] = 0;
      }
    }

    const cleanName = headName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    context['$' + cleanName] = deductionValues[i];
    context['$' + cleanName.toLowerCase()] = deductionValues[i];
    context['$' + cleanName.toUpperCase()] = deductionValues[i];
    context['$' + headName.replace(/\s+/g, '_')] = deductionValues[i];
    context['$ded_head_' + (i + 1)] = deductionValues[i];
  }

  const lopDays = Math.max(0, params.lopDays ?? params.attendanceBreakdown?.absent ?? 0);
  const dailyRate = monthlySalary / totalDays;
  const lopDeduction = Math.round(lopDays * dailyRate);

  if (lopDeduction > 0) {
    const emptyIdx = dedHeads.findIndex(h => !h || h.trim() === '');
    if (emptyIdx !== -1) {
      dedHeads[emptyIdx] = 'Loss of Pay';
      deductionValues[emptyIdx] = lopDeduction;
    }
  }

  const pfEmployee = context['$pfemployee'] ?? context['$pf'] ?? 0;
  const pfEmployer = context['$pfemployer'] ?? 0;
  const esi = context['$esi'] ?? 0;
  const pt = context['$pt'] ?? 0;
  const otherDeductionsVal = params.otherDeductions ?? context['$otherdeductions'] ?? context['$advancesalaryadjut'] ?? 0;

  const totalDeductionsExcludingLop = pfEmployee + pfEmployer + esi + pt + otherDeductionsVal;
  const totalDeductions = totalDeductionsExcludingLop + lopDeduction;
  const netPay = monthlySalary - lopDeduction;

  const finalPay = netPay - totalDeductionsExcludingLop + (params.reimbursement ?? 0) + (params.overtime ?? 0) + (params.incentives ?? 0);

  const medical = context['$medical'] ?? context['$medicalallowance'] ?? 1250;
  const ta = context['$ta'] ?? context['$travelallowance'] ?? 2500;
  const lta = context['$lta'] ?? 3500;
  const specialAllowance = context['$specialallowance'] ?? context['$SPECIALALLOWANCE'] ??
    (prorata - (basic + (context['$hra'] ?? 0) + medical + ta + lta));

  return {
    monthlySalary,
    totalDays,
    payDays,
    prorata,
    basic,
    hra: context['$hra'] ?? Math.round(basic * 0.5),
    medical,
    ta,
    lta,
    specialAllowance,
    pfEmployee: context['$pfemployee'] ?? context['$pf'] ?? deductionValues[0] ?? 0,
    pfEmployer: context['$pfemployer'] ?? context['$pf'] ?? deductionValues[1] ?? 0,
    esi: context['$esi'] ?? deductionValues[2] ?? 0,
    pt: context['$pt'] ?? deductionValues[3] ?? 0,
    tds: params.tds ?? 0,
    otherDeductions: params.otherDeductions ?? 0,
    totalDeductions,
    reimbursement: params.reimbursement ?? 0,
    incentives: params.incentives ?? 0,
    overtime: params.overtime ?? 0,
    lopDays,
    lopDeduction,
    netPay,
    finalPay,
    gross,
    additionHeads: addHeads,
    deductionHeads: dedHeads,
    additionValues,
    deductionValues
  };
}

// ─── Mock audit log (unchanged — client-side only, matches original) ─────────
export const payrollAuditLog: PayrollAuditEntry[] = [];

// ─── Payroll Records — now MySQL-backed ──────────────────────────────────────

/**
 * Fetches all payroll records, syncing with the current employee list
 * (creating draft records for employees who don't have one this month,
 * and re-syncing hasPf/hasPt/attendance for unapproved records).
 * Same business logic as before — only the persistence calls changed.
 */
export async function getPayrollRecords(employeeId?: string): Promise<PayrollRecord[]> {
  if (!settingsLoaded) await loadPayrollSettings();

  let records: PayrollRecord[] = [];
  try {
    const res = await apiFetch('/api/payroll-records');
    if (res.ok) records = await res.json();
  } catch (e) {
    console.error('[getPayrollRecords] fetch failed', e);
  }

  try {
    let employees: Awaited<ReturnType<typeof getEmployees>> = [];
    try {
      employees = await getEmployees();
    } catch (e) {
      console.error('[getPayrollRecords] getEmployees() failed — cannot sync payroll from employee master:', e);
    }
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const targetMonth = formatMonthToMMMYear(currentMonthStr);
    const toSync: PayrollRecord[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let attendanceReports: any[] = [];
    try {
      attendanceReports = await getMonthlyReport(currentMonthStr);
    } catch (e) {
      console.warn('Could not fetch attendance reports for payroll', e);
    }

    // Sync existing unapproved records with latest employee opt-out settings
    records = records.map(r => {
      if (r.status === 'approved') return r;
      const emp = employees.find(e => e.employeeId === r.employeeId);
      if (emp) {
        const expectedHasPf = !emp.optOutPF;
        const expectedHasPt = !emp.optOutPT;
        const expectedUan = emp.uanNumber || '—';
        const attendance = attendanceReports.find(a => a.employee_id === emp.employeeId || a.id === emp.employeeId);
        const latestAttendanceBreakdown = attendance ? {
          present: attendance.present || 0,
          weekOff: attendance.weekOff || 0,
          leaves: attendance.leaves || 0,
          holidays: attendance.holidays || 0,
          absent: attendance.absent || 0,
        } : r.attendanceBreakdown;

        if (r.hasPf !== expectedHasPf || r.hasPt !== expectedHasPt || r.pfUan !== expectedUan || JSON.stringify(r.attendanceBreakdown) !== JSON.stringify(latestAttendanceBreakdown)) {
          const comp = computeNet({
            monthlySalary: r.monthlySalary,
            monthlyCtc: r.ctc,
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
            hasPf: expectedHasPf,
            hasEsi: r.hasEsi,
            hasPt: expectedHasPt,
            employeeId: r.employeeId,
            attendanceBreakdown: latestAttendanceBreakdown,
          });
          const updated = {
            ...r,
            hasPf: expectedHasPf,
            hasPt: expectedHasPt,
            pfUan: expectedUan,
            attendanceBreakdown: latestAttendanceBreakdown,
            additionHeads: comp.additionHeads,
            deductionHeads: comp.deductionHeads,
            additionValues: comp.additionValues,
            deductionValues: comp.deductionValues,
            components: {
              ...r.components,
              pfEmployee: comp.pfEmployee,
              pfEmployer: comp.pfEmployer,
              pt: comp.pt,
              basic: comp.basic,
              hra: comp.hra,
              esi: comp.esi,
              specialAllowance: comp.specialAllowance,
            },
            netPay: comp.netPay,
            finalPay: comp.finalPay,
          };
          toSync.push(updated);
          return updated;
        }
      }
      return r;
    });

    for (const emp of employees) {
      const exists = records.some(r => r.employeeId === emp.employeeId && r.month === targetMonth);
      if (!exists) {
        const attendance = attendanceReports.find(a => a.employee_id === emp.employeeId || a.id === emp.employeeId);
        const newAttendanceBreakdown = attendance ? {
          present: attendance.present || 0,
          weekOff: attendance.weekOff || 0,
          leaves: attendance.leaves || 0,
          holidays: attendance.holidays || 0,
          absent: attendance.absent || 0,
        } : undefined;

        const defaultCtc = 30000;
        const comp = computeNet({
          monthlySalary: defaultCtc,
          totalDays: getDaysInMonth(targetMonth),
          payDays: 30,
          medical: 1250,
          ta: 2500,
          lta: 3500,
          reimbursement: 0,
          incentives: 0,
          overtime: 0,
          tds: 0,
          otherDeductions: 0,
          hasPf: !emp.optOutPF,
          hasEsi: true,
          hasPt: !emp.optOutPT,
          employeeId: emp.employeeId,
          attendanceBreakdown: newAttendanceBreakdown,
        });

        const newRec: PayrollRecord = {
          id: '', // assigned by backend on insert
          employeeId: emp.employeeId,
          employeeName: emp.fullName,
          department: emp.department,
          designation: emp.role === 'Employee' ? 'EMPLOYEE' : emp.role.toUpperCase(),
          month: targetMonth,
          ctc: defaultCtc,
          monthlySalary: defaultCtc,
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
          finalPay: comp.finalPay,
          status: 'draft',
          revision: 1,
          autoFormula: true,
          totalDays: getDaysInMonth(targetMonth),
          payDays: 30,
          clBalance: 12,
          pfUan: emp.uanNumber || '—',
          hasPf: !emp.optOutPF,
          hasEsi: true,
          hasPt: !emp.optOutPT,
          slipReleased: false,
          additionHeads: comp.additionHeads,
          deductionHeads: comp.deductionHeads,
          additionValues: comp.additionValues,
          deductionValues: comp.deductionValues,
          attendanceBreakdown: newAttendanceBreakdown,
          lopDays: comp.lopDays,
          lopDeduction: comp.lopDeduction,
        };
        records.push(newRec);
        toSync.push(newRec);
      }
    }

    if (toSync.length > 0) {
      await apiFetch('/api/payroll-records', {
        method: 'POST',
        body: JSON.stringify({ records: toSync }),
      });
      // Re-fetch to pick up backend-generated ids for new records
      const res = await apiFetch('/api/payroll-records');
      if (res.ok) records = await res.json();
    }
  } catch (err) {
    console.error('[getPayrollRecords] Error syncing payroll records with employees list — Salary Engine may show stale or missing data:', err);
  }

  if (employeeId) {
    return records.filter(r => r.employeeId === employeeId);
  }
  return records;
}

export async function updatePayrollRecord(
  id: string,
  patch: Partial<Omit<PayrollRecord, 'id' | 'employeeId' | 'employeeName' | 'status'>>
): Promise<PayrollRecord | null> {
  const body: Record<string, unknown> = { ...patch };

  const needsRecompute =
    patch.autoFormula ||
    patch.monthlySalary !== undefined ||
    patch.ctc !== undefined ||
    patch.payDays !== undefined ||
    patch.totalDays !== undefined ||
    patch.hasPf !== undefined ||
    patch.hasEsi !== undefined ||
    patch.hasPt !== undefined;

  if (needsRecompute) {
    // Fetch current record to have full context for recompute
    const res = await apiFetch('/api/payroll-records');
    if (!res.ok) return null;
    const all: PayrollRecord[] = await res.json();
    const rec = all.find(r => r.id === id);
    if (!rec || rec.status === 'approved') return null;

    const updated: PayrollRecord = { ...rec, ...patch };
    body.autoFormula = true;
    if (patch.ctc !== undefined) {
      updated.monthlySalary = patch.ctc;
    } else if (patch.monthlySalary !== undefined) {
      updated.ctc = patch.monthlySalary;
    }

    await setEmployeeSalaryDetail(updated.employeeId, updated.monthlySalary);

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
      otherDeductions: updated.deduction ?? updated.components.otherDeductions,
      hasPf: updated.hasPf,
      hasEsi: updated.hasEsi,
      hasPt: updated.hasPt,
      employeeId: updated.employeeId,
      attendanceBreakdown: updated.attendanceBreakdown,
    });

    body.monthlySalary = updated.monthlySalary;
    body.ctc = updated.ctc;
    body.components = {
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
    body.netPay = comp.netPay;
    body.finalPay = comp.finalPay;
    body.additionHeads = comp.additionHeads;
    body.deductionHeads = comp.deductionHeads;
    body.additionValues = comp.additionValues;
    body.deductionValues = comp.deductionValues;
    body.lopDays = comp.lopDays;
    body.lopDeduction = comp.lopDeduction;
  } else if (patch.components || patch.deduction !== undefined) {
    const res = await apiFetch('/api/payroll-records');
    if (!res.ok) return null;
    const all: PayrollRecord[] = await res.json();
    const rec = all.find(r => r.id === id);
    if (!rec) return null;

    const c = { ...rec.components, ...patch.components };
    const monthlySalary = rec.monthlySalary ?? rec.ctc;
    const totalDays = rec.totalDays || 30;
    const lopDays = rec.lopDays ?? rec.attendanceBreakdown?.absent ?? 0;
    const lopDeduction = Math.round((monthlySalary / totalDays) * lopDays);

    const totalDeductionsExcludingLop = c.pfEmployee + c.pfEmployer + c.esi + c.pt + c.tds + (patch.deduction ?? c.otherDeductions ?? 0);

    body.components = c;
    body.netPay = monthlySalary - lopDeduction;
    body.finalPay = body.netPay as number - totalDeductionsExcludingLop + (c.reimbursement ?? 0) + (c.overtime ?? 0) + (c.incentives ?? 0);
    body.lopDays = lopDays;
    body.lopDeduction = lopDeduction;
  }

  const res = await apiFetch(`/api/payroll-records/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function approvePayroll(ids: string[], approverEmail: string): Promise<void> {
  const now = new Date().toISOString();
  for (const id of ids) {
    const res = await apiFetch(`/api/payroll-records/${id}/approve`, { method: 'POST' });
    if (res.ok) {
      payrollAuditLog.push({
        timestamp: now,
        action: 'APPROVED',
        by: approverEmail,
        employeeId: '', // not returned by approve endpoint; fetch records again if needed
        netPay: 0,
        finalPay: 0,
      });
    }
  }
}

export async function createRevision(id: string, approverEmail: string): Promise<PayrollRecord | null> {
  const res = await apiFetch(`/api/payroll-records/${id}/revision`, { method: 'POST' });
  if (!res.ok) return null;
  const revised: PayrollRecord = await res.json();
  payrollAuditLog.push({
    timestamp: new Date().toISOString(),
    action: 'REVISION_CREATED',
    by: approverEmail,
    employeeId: revised.employeeId,
    netPay: revised.netPay,
    finalPay: revised.finalPay,
  });
  return revised;
}

export async function applyFormulaToAll(ctcMultiplier?: number): Promise<void> {
  const res = await apiFetch('/api/payroll-records');
  if (!res.ok) return;
  let records: PayrollRecord[] = await res.json();
  const employees = await getEmployees();

  const updates: PayrollRecord[] = [];

  records = records.map(r => {
    if (r.status === 'approved') return r;
    const emp = employees.find(e => e.employeeId === r.employeeId);

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
      hasPf: emp ? !emp.optOutPF : r.hasPf,
      hasEsi: r.hasEsi,
      hasPt: emp ? !emp.optOutPT : r.hasPt,
      employeeId: r.employeeId,
      attendanceBreakdown: r.attendanceBreakdown,
    });
    const updated = {
      ...r,
      hasPf: emp ? !emp.optOutPF : r.hasPf,
      hasPt: emp ? !emp.optOutPT : r.hasPt,
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
      finalPay: comp.finalPay,
      additionHeads: comp.additionHeads,
      deductionHeads: comp.deductionHeads,
      additionValues: comp.additionValues,
      deductionValues: comp.deductionValues,
    };
    updates.push(updated);
    return updated;
  });

  if (updates.length > 0) {
    await apiFetch('/api/payroll-records', {
      method: 'POST',
      body: JSON.stringify({ records: updates }),
    });
  }
}

export async function releaseSlips(employeeIds: string[]): Promise<void> {
  const res = await apiFetch('/api/payroll-records');
  if (!res.ok) return;
  const records: PayrollRecord[] = await res.json();
  const toRelease = records
    .filter(r => employeeIds.includes(r.employeeId))
    .map(r => ({ ...r, slipReleased: true }));

  if (toRelease.length > 0) {
    await apiFetch('/api/payroll-records', {
      method: 'POST',
      body: JSON.stringify({ records: toRelease }),
    });
  }
}

export async function releaseAndSyncSlips(sentRows: SlipRow[]): Promise<void> {
  const records: PayrollRecord[] = sentRows
    .filter(row => row.employeeId && row.month)
    .map(row => ({
      id: '',
      employeeId: row.employeeId!,
      employeeName: row.name,
      department: row.department || 'Operation',
      designation: row.designation || 'EMPLOYEE',
      month: row.month!,
      ctc: row.ctc,
      monthlySalary: row.monthlySalary,
      components: {
        basic: row.basic || 0,
        hra: row.hra || 0,
        pfEmployee: row.pfEmployee || 0,
        pfEmployer: row.pfEmployer || 0,
        esi: row.esi || 0,
        pt: row.pt || 0,
        tds: row.tds || 0,
        specialAllowance: row.specialAllowance || 0,
        medical: row.medical || 1250,
        ta: row.ta || 2500,
        lta: row.lta || 3500,
        reimbursement: row.reimbursement || 0,
        incentives: row.incentives || 0,
        overtime: row.overtime || 0,
        otherDeductions: row.otherDeductions || 0,
      },
      netPay: row.netPay,
      finalPay: row.finalPay || row.netPay,
      status: 'approved',
      revision: 1,
      autoFormula: true,
      totalDays: row.totalDays,
      payDays: row.payDays,
      clBalance: row.clBalance || 0,
      pfUan: row.pfUan || '—',
      hasPf: true,
      hasEsi: true,
      hasPt: true,
      slipReleased: true,
      additionHeads: row.additionHeads || [],
      deductionHeads: row.deductionHeads || [],
      additionValues: row.additionValues || [],
      deductionValues: row.deductionValues || [],
    }));

  if (records.length > 0) {
    await apiFetch('/api/payroll-records', {
      method: 'POST',
      body: JSON.stringify({ records }),
    });
  }
}

/** Format YYYY-MM to MMM YYYY, e.g. 2026-07 -> Jul 2026 */
export function formatMonthToMMMYear(monthStr: string): string {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** Generates or updates draft payroll records based on attendance monthly report */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncPayrollFromAttendance(monthStr: string, reportRows: any[]): Promise<void> {
  const displayMonth = formatMonthToMMMYear(monthStr);

  let employees: { employeeId?: string; id?: string; role?: string }[] = [];
  try {
    const res = await apiFetch('/api/employees');
    if (res.ok) employees = await res.json();
  } catch (e) {
    console.error('Failed to fetch employees for sync', e);
  }

  let clBalances: Record<string, ClBalance> = {};
  try {
    const res = await apiFetch('/api/cl-balances');
    if (res.ok) clBalances = await res.json();
  } catch (e) {
    console.error('Failed to fetch CL balances for sync', e);
  }

  const existingRes = await apiFetch('/api/payroll-records');
  const existingRecords: PayrollRecord[] = existingRes.ok ? await existingRes.json() : [];

  const toSync: PayrollRecord[] = [];

  reportRows.forEach(row => {
    const emp = employees.find(e => e.employeeId === row.employee_id || e.id === row.employee_id);
    const clBal = clBalances[row.employee_id] ?? { total: 12, used: 0 };
    const lopDays = row.absent || 0;

    const existing = existingRecords.find(r => r.employeeId === row.employee_id && r.month === displayMonth);

    const monthlySalary = existing ? existing.monthlySalary : 30000;
    const totalDays = getDaysInMonth(displayMonth);
    const payDays = Math.min(row.payableDays, totalDays);

    const medical = existing ? existing.components.medical : 1250;
    const ta = existing ? existing.components.ta : 2500;
    const lta = existing ? existing.components.lta : 3500;
    const reimbursement = existing ? existing.components.reimbursement : 0;
    const incentives = existing ? existing.components.incentives : 0;
    const overtime = existing ? existing.components.overtime : 0;
    const tds = existing ? existing.components.tds : 0;
    const otherDeductions = existing ? existing.components.otherDeductions : 0;

    const hasPf = existing ? existing.hasPf : true;
    const hasEsi = existing ? existing.hasEsi : true;
    const hasPt = existing ? existing.hasPt : true;

    const attendanceBreakdown = {
      present: row.present || 0,
      weekOff: row.weekOff || 0,
      leaves: row.leaves || 0,
      holidays: row.holidays || 0,
      absent: row.absent || 0,
    };

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
      employeeId: row.employee_id,
      attendanceBreakdown,
    });

    // Only sync draft records — approved ones are locked (matches old behavior)
    if (existing && existing.status !== 'draft') return;

    const payrollRec: PayrollRecord = {
      id: existing?.id ?? '',
      employeeId: row.employee_id,
      employeeName: row.employeeName,
      department: row.department,
      designation: emp?.role || 'Employee',
      month: displayMonth,
      ctc: monthlySalary,
      monthlySalary,
      netPay: comp.netPay,
      finalPay: comp.finalPay,
      status: existing?.status ?? 'draft',
      revision: existing?.revision ?? 1,
      autoFormula: true,
      totalDays,
      payDays,
      clBalance: clBal.total,
      pfUan: existing?.pfUan ?? '—',
      hasPf,
      hasEsi,
      hasPt,
      slipReleased: existing?.slipReleased ?? false,
      additionHeads: comp.additionHeads,
      deductionHeads: comp.deductionHeads,
      additionValues: comp.additionValues,
      deductionValues: comp.deductionValues,
      attendanceBreakdown,
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
      lopDays: comp.lopDays,
      lopDeduction: comp.lopDeduction,
    };

    toSync.push(payrollRec);
  });

  if (toSync.length > 0) {
    await apiFetch('/api/payroll-records', {
      method: 'POST',
      body: JSON.stringify({ records: toSync }),
    });
  }
}

// ─── CL Balance helpers ────────────────────────────────────────────────────────

export interface ClBalance {
  total: number;
  used: number;
}

export async function fetchClBalance(employeeId: string): Promise<ClBalance> {
  try {
    const res = await apiFetch(`/api/cl-balances/${employeeId}`);
    if (!res.ok) return { total: 12, used: 0 };
    return res.json();
  } catch {
    return { total: 12, used: 0 };
  }
}

export async function fetchAllClBalances(): Promise<Record<string, ClBalance>> {
  try {
    // FIX: was hardcoded to http://localhost:3001 — broken in production
    const res = await apiFetch('/api/cl-balances');
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

export async function updateClBalance(employeeId: string, total: number): Promise<ClBalance> {
  const res = await apiFetch(`/api/cl-balances/${employeeId}`, {
    method: 'PUT',
    body: JSON.stringify({ total }),
  });
  if (!res.ok) throw new Error('Failed to update CL balance');
  const data = await res.json();
  return data.balance;
}

export function computeLopDays(clBalance: ClBalance): number {
  return Math.max(0, clBalance.used - clBalance.total);
}

// ─── Bulk Slip Email types & API (unchanged — already used API_URL correctly) ─

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
  finalPay?: number;
  additionHeads?: string[];
  deductionHeads?: string[];
  additionValues?: number[];
  deductionValues?: number[];
  deduction?: number;
}

export interface BulkSendResult {
  sent: number;
  sentList?: { email: string; name: string }[];
  failed: { email: string; name: string; error: string }[];
  skipped?: boolean;
}

export async function sendBulkSlips(rows: SlipRow[]): Promise<BulkSendResult> {
  const res = await apiFetch('/api/payroll/send-slips', {
    method: 'POST',
    body: JSON.stringify({ slips: rows }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown server error' }));
    throw new Error(err.error || `Server returned ${res.status}`);
  }
  return res.json();
}

export interface PayslipSchedule {
  day: number;
  hour: number;
  minute: number;
  enabled: boolean;
  lastRun: string | null;
}

export async function getPayslipSchedule(): Promise<PayslipSchedule> {
  try {
    const res = await apiFetch('/api/payroll/schedule');
    if (!res.ok) throw new Error('Server error');
    return res.json();
  } catch {
    return { day: 10, hour: 10, minute: 0, enabled: true, lastRun: null };
  }
}

export async function updatePayslipSchedule(schedule: Omit<PayslipSchedule, 'lastRun'>): Promise<PayslipSchedule> {
  const res = await apiFetch('/api/payroll/schedule', {
    method: 'PUT',
    body: JSON.stringify(schedule),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown server error' }));
    throw new Error(err.error || `Server returned ${res.status}`);
  }
  const data = await res.json();
  return data.schedule;
}

export async function triggerManualSend(): Promise<BulkSendResult> {
  const res = await apiFetch('/api/payroll/trigger-send', { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown server error' }));
    throw new Error(err.error || `Server returned ${res.status}`);
  }
  return res.json();
}

/** Legacy sync function — kept for any remaining callers, now points at the real MySQL endpoint. */
export async function syncPayrollToServer(records: PayrollRecord[]): Promise<void> {
  try {
    await apiFetch('/api/payroll-records', {
      method: 'POST',
      body: JSON.stringify({ records }),
    });
  } catch (err) {
    console.warn('[Payroll] Failed to sync records to server:', err);
  }
}