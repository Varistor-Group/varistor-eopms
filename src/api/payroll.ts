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
  month: string; // e.g. "Jun 2026"
  ctc: number;
  components: SalaryComponents;
  netPay: number; // Monthly CTC - LOP
  finalPay: number; // Final in-hand salary (Net Pay - Deductions + Additions)
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

    // Safe eval using Function constructor
     
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

/** Single source of truth for all payroll calculations. */
export function getDaysInMonth(monthStr: string): number {
  if (!monthStr) return 30;
  const d = new Date(monthStr);
  if (isNaN(d.getTime())) return 30;
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

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
  /** Number of Loss-of-Pay days to deduct (excess over CL entitlement) */
  lopDays?: number;
  /** Whether PF deduction applies (default true) */
  hasPf?: boolean;
  /** Whether ESI deduction applies (default true) */
  hasEsi?: boolean;
  /** Whether PT deduction applies (default true) */
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

  // 1. Load custom settings from localStorage if they exist
  let addHeads = [
    "Basic", "HRA", "MEDICAL ALLOWANCE", "TA", "LTA", "SPECIAL ALLOWANCE", "", "", "", ""
  ];
  let dedHeads = [
    "PF Employee", "PF Employer", "ESI", "PT", "Advance salary adjut", "", "", "", "", ""
  ];
  let ptRanges = [
    { min: 0, max: 2999, amount: 0 },
    { min: 3000, max: 5999, amount: 20 },
    { min: 6000, max: 8999, amount: 80 },
    { min: 9000, max: 11999, amount: 150 },
    { min: 12000, max: 500000, amount: 200 }
  ];
  let pfPct = 12;
  let esiPct = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let formulas: any[] = [];
  let employeeDetails: Record<string, number> = {};

  try {
    const headsRaw = localStorage.getItem('eopms_salary_heads');
    if (headsRaw) {
      const parsed = JSON.parse(headsRaw);
      if (parsed.additions) addHeads = parsed.additions;
      if (parsed.deductions) dedHeads = parsed.deductions;
      if (parsed.ptRanges) ptRanges = parsed.ptRanges;
      if (parsed.pfPercentage !== undefined) pfPct = parsed.pfPercentage;
      if (parsed.esiPercentage !== undefined) esiPct = parsed.esiPercentage;
    }
    const formulasRaw = localStorage.getItem('eopms_salary_formulas');
    const defaultFormulas = [
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
    if (formulasRaw) {
      formulas = JSON.parse(formulasRaw);
      let migrated = false;
      formulas = formulas.map((f: any) => {
        const isPf = /(^|[^a-z])pf([^a-z]|$)/i.test(f.name || '') || /provident/i.test(f.name || '');
        const isEsi = /(^|[^a-z])esi([^a-z]|$)/i.test(f.name || '');
        const isPt = /(^|[^a-z])pt([^a-z]|$)/i.test(f.name || '') || /professional\s*tax/i.test(f.name || '');

        if (isPf && !f.equation.toLowerCase().includes('$haspf')) {
          f.equation = `(${f.equation}) * $haspf`;
          migrated = true;
        }
        if (isEsi && !f.equation.toLowerCase().includes('$hasesi')) {
          f.equation = `(${f.equation}) * $hasesi`;
          migrated = true;
        }
        if (isPt && !f.equation.toLowerCase().includes('$haspt')) {
          f.equation = `(${f.equation}) * $haspt`;
          migrated = true;
        }
        return f;
      });
      if (migrated) {
        localStorage.setItem('eopms_salary_formulas', JSON.stringify(formulas));
      }
    } else {
      formulas = [];
    }
    if (formulas.length < 9) {
      formulas = defaultFormulas;
      localStorage.setItem('eopms_salary_formulas', JSON.stringify(defaultFormulas));
    } else {
      // Migrate F3/F4/F5 to pro-rated formulas if they still use old flat values
      let migrated = false;
      const flatMed = /^1250$/;
      const flatTa  = /^2500$/;
      const flatLta = /^3500$/;
      formulas = formulas.map((f: {code: string; name: string; equation: string}) => {
        if ((f.code === 'F3' || f.name?.toUpperCase().includes('MEDICAL')) && flatMed.test(f.equation?.trim())) {
          migrated = true;
          return { ...f, equation: 'Math.round(1250 / $DIM * ($SP + $SW + $SL + $SH))' };
        }
        if ((f.code === 'F4' || f.name?.toUpperCase() === 'TA') && flatTa.test(f.equation?.trim())) {
          migrated = true;
          return { ...f, equation: 'Math.round(2500 / $DIM * ($SP + $SW + $SL + $SH))' };
        }
        if ((f.code === 'F5' || f.name?.toUpperCase() === 'LTA') && flatLta.test(f.equation?.trim())) {
          migrated = true;
          return { ...f, equation: 'Math.round(3500 / $DIM * ($SP + $SW + $SL + $SH))' };
        }
        // Migrate old pro-rata or clamped special allowance formula to prorata-based formula
        if ((f.code === 'F6' || f.name?.toUpperCase().includes('SPECIAL')) &&
            (f.equation?.includes('Math.max(0') || f.equation?.includes('$BS -'))) {
          migrated = true;
          return { ...f, equation: '$Prorata - ($Basic + $HRA + $MEDICALALLOWANCE + $TA + $LTA)' };
        }
        return f;
      });
      if (migrated) {
        localStorage.setItem('eopms_salary_formulas', JSON.stringify(formulas));
      }
    }
    const detailsRaw = localStorage.getItem('eopms_employee_salary_details');
    if (detailsRaw) {
      employeeDetails = JSON.parse(detailsRaw);
    }
  } catch (e) {
    console.error('Error loading custom payroll settings', e);
  }

  // 2. Determine $BS (Base/Reference Amount)
  // Prioritize the passed monthlySalary (the record's CTC), falling back to master settings only if zero/undefined.
  const refAmt = monthlySalary || (params.employeeId ? employeeDetails[params.employeeId] : 0) || 0;

  // 3. Determine attendance values
  const present = params.attendanceBreakdown?.present ?? payDays;
  const weekOff = params.attendanceBreakdown?.weekOff ?? 0;
  const leaves = params.attendanceBreakdown?.leaves ?? 0;
  const holidays = params.attendanceBreakdown?.holidays ?? 0;

  // 4. Construct evaluation context
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

  // 5. Evaluate Additions
  for (let i = 0; i < 10; i++) {
    const headName = addHeads[i]?.trim();
    if (!headName) continue;

    const formula = formulas.find(f => f.name?.trim().toLowerCase() === headName.toLowerCase());
    
    // Check for manual overrides first
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
      // Fallback
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

    // Populate context
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

  // 6. Evaluate Deductions
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
      // Fallback
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

    // Populate context
    const cleanName = headName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    context['$' + cleanName] = deductionValues[i];
    context['$' + cleanName.toLowerCase()] = deductionValues[i];
    context['$' + cleanName.toUpperCase()] = deductionValues[i];
    context['$' + headName.replace(/\s+/g, '_')] = deductionValues[i];
    context['$ded_head_' + (i + 1)] = deductionValues[i];
  }

  // 7. LOP deduction
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

  // Return standard fields for compatibility
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
    netPay: 150000,
    finalPay: 148000,
    status: 'draft',
    revision: 1,
    autoFormula: true,
    totalDays: getDaysInMonth('June 2026'),
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
    netPay: 50000,
    finalPay: 46200,
    status: 'draft',
    revision: 1,
    autoFormula: true,
    totalDays: getDaysInMonth('June 2026'),
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
    netPay: 35000,
    finalPay: 31200,
    status: 'draft',
    revision: 1,
    autoFormula: true,
    totalDays: getDaysInMonth('June 2026'),
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
    netPay: 45000,
    finalPay: 41200,
    status: 'draft',
    revision: 1,
    autoFormula: true,
    totalDays: getDaysInMonth('June 2026'),
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
      return JSON.parse(raw);
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

  try {
    const employees = await getEmployees();
    _records = loadPayrollRecords();

    const targetMonth = 'Jun 2026';
    let modified = false;

    let attendanceReports: any[] = [];
    try {
      attendanceReports = await getMonthlyReport('2026-06');
    } catch (e) {
      console.warn('Could not fetch attendance reports for payroll', e);
    }

    // Sync existing unapproved records with latest employee opt-out settings
    _records = _records.map(r => {
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
          modified = true;
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
          return {
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
        }
      }
      return r;
    });

    for (const emp of employees) {
      const exists = _records.some(r => r.employeeId === emp.employeeId && r.month === targetMonth);
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
          totalDays: getDaysInMonth('June 2026'),
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
          id: `pay-${emp.employeeId}-${targetMonth.replace(/\s+/g, '-')}`,
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
          revision: 0,
          autoFormula: true,
          totalDays: getDaysInMonth('June 2026'),
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
        _records.push(newRec);
        modified = true;
      }
    }

    if (modified) {
      savePayrollRecords(_records);
    }
  } catch (err) {
    console.error('Error syncing payroll records with employees list:', err);
  }

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
    patch.monthlySalary !== undefined ||
    patch.ctc !== undefined ||
    patch.payDays !== undefined ||
    patch.totalDays !== undefined ||
    patch.hasPf !== undefined ||
    patch.hasEsi !== undefined ||
    patch.hasPt !== undefined;
  if (needsRecompute) {
    updated.autoFormula = true;
    if (patch.ctc !== undefined) {
      updated.monthlySalary = patch.ctc;
    } else if (patch.monthlySalary !== undefined) {
      updated.ctc = patch.monthlySalary;
    }

    // ── Keep $BS in sync with the new monthly salary ──────────────────────────
    // computeNet reads $BS from eopms_employee_salary_details. If that key
    // still holds the OLD CTC, every formula will produce wrong numbers.
    try {
      const detailsRaw = localStorage.getItem('eopms_employee_salary_details');
      const details: Record<string, number> = detailsRaw ? JSON.parse(detailsRaw) : {};
      details[updated.employeeId] = updated.monthlySalary;
      localStorage.setItem('eopms_employee_salary_details', JSON.stringify(details));
    } catch { /* ignore */ }
    // ─────────────────────────────────────────────────────────────────────────

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
    updated.finalPay = comp.finalPay;
    updated.additionHeads = comp.additionHeads;
    updated.deductionHeads = comp.deductionHeads;
    updated.additionValues = comp.additionValues;
    updated.deductionValues = comp.deductionValues;
    updated.lopDays = comp.lopDays;
    updated.lopDeduction = comp.lopDeduction;
  } else if (patch.components || patch.deduction !== undefined) {
    const c = updated.components;
    const monthlySalary = updated.monthlySalary ?? updated.ctc;
    const totalDays = updated.totalDays || 30;
    const lopDays = updated.lopDays ?? updated.attendanceBreakdown?.absent ?? 0;
    const lopDeduction = Math.round((monthlySalary / totalDays) * lopDays);

    const totalDeductionsExcludingLop = c.pfEmployee + c.pfEmployer + c.esi + c.pt + c.tds + (updated.deduction ?? c.otherDeductions ?? 0);
    
    updated.netPay = monthlySalary - lopDeduction;
    updated.finalPay = updated.netPay - totalDeductionsExcludingLop + (c.reimbursement ?? 0) + (c.overtime ?? 0) + (c.incentives ?? 0);
    updated.lopDays = lopDays;
    updated.lopDeduction = lopDeduction;
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
        finalPay: _records[idx].finalPay,
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
    finalPay: rec.finalPay,
  });
  return revised;
}

export async function applyFormulaToAll(ctcMultiplier?: number): Promise<void> {
  await delay(600);
  _records = loadPayrollRecords();
  const employees = await getEmployees();
  
  _records = _records.map(r => {
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
    return {
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
  savePayrollRecords(_records);
  syncPayrollToServer(_records);
}

/**
 * Synchronizes the exact calculated slips (from Excel/Attendance) into the central payroll records.
 * Marks them as released and syncs to the server.
 */
export async function releaseAndSyncSlips(sentRows: SlipRow[]): Promise<void> {
  await delay(50);
  
  sentRows.forEach(row => {
    if (!row.employeeId || !row.month) return;
    const existingIdx = _records.findIndex(r => r.employeeId === row.employeeId && r.month === row.month);
    
    const newRecord: PayrollRecord = {
      id: existingIdx !== -1 ? _records[existingIdx].id : `pay-${row.employeeId}-${row.month.replace(/\\s+/g, '-')}`,
      employeeId: row.employeeId,
      employeeName: row.name,
      department: row.department || 'Operation',
      designation: row.designation || 'EMPLOYEE',
      month: row.month,
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
        otherDeductions: row.otherDeductions || 0
      },
      netPay: row.netPay,
      finalPay: row.finalPay || row.netPay,
      status: 'approved',
      revision: existingIdx !== -1 ? _records[existingIdx].revision + 1 : 1,
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
    };
    
    if (existingIdx !== -1) {
      _records[existingIdx] = newRecord;
    } else {
      _records.push(newRecord);
    }
  });

  savePayrollRecords(_records);
  syncPayrollToServer(_records);
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function syncPayrollFromAttendance(monthStr: string, reportRows: any[]): Promise<void> {
  await delay(200);
  _records = loadPayrollRecords();

  const displayMonth = formatMonthToMMMYear(monthStr);

  // Load employees to fetch role/designation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    const lopDays = row.absent || 0;

    const existingIdx = _records.findIndex(r => r.employeeId === row.employee_id && r.month === displayMonth);

    const monthlySalary = existingIdx !== -1 ? _records[existingIdx].monthlySalary : 30000;
    const totalDays = getDaysInMonth(displayMonth);
    const payDays = Math.min(row.payableDays, totalDays);

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
      finalPay: comp.finalPay,
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

// ─── Payslip Schedule API ─────────────────────────────────────────────────────

export interface PayslipSchedule {
  day: number;
  hour: number;
  minute: number;
  enabled: boolean;
  lastRun: string | null;
}

/** Fetch the current payslip auto-send schedule from the server. */
export async function getPayslipSchedule(): Promise<PayslipSchedule> {
  try {
    const res = await fetch('http://localhost:3001/api/payroll/schedule');
    if (!res.ok) throw new Error('Server error');
    return res.json();
  } catch {
    return { day: 10, hour: 10, minute: 0, enabled: true, lastRun: null };
  }
}

/** Update the payslip auto-send schedule on the server. */
export async function updatePayslipSchedule(schedule: Omit<PayslipSchedule, 'lastRun'>): Promise<PayslipSchedule> {
  const res = await fetch('http://localhost:3001/api/payroll/schedule', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(schedule),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown server error' }));
    throw new Error(err.error || `Server returned ${res.status}`);
  }
  const data = await res.json();
  return data.schedule;
}

/** Manually trigger payslip dispatch immediately (uses server-stored records). */
export async function triggerManualSend(): Promise<BulkSendResult> {
  const res = await fetch('http://localhost:3001/api/payroll/trigger-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown server error' }));
    throw new Error(err.error || `Server returned ${res.status}`);
  }
  return res.json();
}

/** Sync the latest payroll records from client localStorage to the server db.json.
 *  Called whenever HR saves/approves payroll so the cron job has up-to-date data.
 */
export async function syncPayrollToServer(records: PayrollRecord[]): Promise<void> {
  try {
    await fetch('http://localhost:3001/api/payroll/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    });
  } catch (err) {
    console.warn('[Payroll] Failed to sync records to server:', err);
  }
}
