import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DollarSign, CheckSquare, Square, ChevronDown, ChevronUp,
  RefreshCw, ShieldCheck, AlertCircle,
  FileText, Users, Lock, Unlock, Clock, Eye, Printer,
  TrendingUp, BarChart3, CheckCircle2, Send, Trash2,
  FileSpreadsheet, ArrowRight, X, Mail, AlertTriangle,
  Calendar, ToggleLeft, ToggleRight, Zap
} from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';

import { getEmployees } from '../api/employees';
import {
  getPayrollRecords,
  updatePayrollRecord,
  approvePayroll,
  createRevision,
  applyFormulaToAll,
  payrollAuditLog,
  sendBulkSlips,
  releaseAndSyncSlips,
  fetchAllClBalances,
  computeLopDays,
  numberToWords,
  computeNet,
  getPayslipSchedule,
  updatePayslipSchedule,
  triggerManualSend,
  syncPayrollToServer,
  type PayrollRecord,
  type SlipRow,
  type BulkSendResult,
  type PayslipSchedule,
  getDaysInMonth,
  formatMonthToMMMYear,
  loadPayrollSettings,
  savePayrollSetting
} from '../api/payroll';
import { apiFetch } from '../api/httpClient';

// xlsx is loaded via CDN-style dynamic import to avoid bundler issues
// We import the type only; actual lib loaded at runtime
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
declare const XLSX: any;
import logoUrl from '../assets/logo.png';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const MONTH = formatMonthToMMMYear(
  `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
);


// Column name aliases — tolerant parsing of Excel headers
const COL_ALIASES: Record<string, string[]> = {
  name: ['name', 'full name', 'employee name', 'emp name', 'fullname'],
  email: ['email', 'email id', 'mail', 'email address', 'e-mail'],
  monthlySalary: ['salary', 'monthly salary', 'monthly_salary', 'monthly salary (rs.)', 'salary amount'],
  ctc: ['ctc', 'monthly ctc', 'total ctc', 'ctc amount'],
  totalDays: ['total days', 'total_days', 'no. of days', 'no of days', 'days in month'],
  payDays: ['pay days', 'pay_days', 'paid days', 'paid no of days', 'paid no. of days', 'paid number of days', 'days present'],
  designation: ['designation', 'role', 'job title', 'post'],
  department: ['department', 'dept', 'division'],
  pfUan: ['pf uan', 'pf uan no.', 'uan', 'uan no', 'pf uan no'],
  clBalance: ['cl balance', 'cl_balance', 'casual leave balance', 'cl'],
  medical: ['medical', 'medical allowance', 'medical allowance (rs.)'],
  ta: ['ta', 'travel allowance', 'travel allowance (rs.)', 'transport allowance'],
  lta: ['lta', 'leave travel allowance', 'leave travel allowance (rs.)'],
  reimbursement: ['reimbursement', 'reimbursements'],
  incentives: ['incentive', 'incentives'],
  overtime: ['overtime', 'ot', 'ot hours', 'ot pay'],
  tds: ['tds', 'tax deducted at source', 'income tax'],
  otherDeductions: ['other deductions', 'other_deductions', 'deductions', 'total deductions']
};

function resolveHeader(raw: string): string | null {
  const lower = raw.trim().toLowerCase();
  for (const [key, aliases] of Object.entries(COL_ALIASES)) {
    if (aliases.includes(lower)) return key;
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseNumber(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(/[₹,\s]/g, ''));
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

// ─── Formula Badge ────────────────────────────────────────────────────────────

const FormulaBadge = ({ formula }: { formula: string }) => (
  <span className="font-mono text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">
    {formula}
  </span>
);

// ─── Salary Slip Preview Modal ─────────────────────────────────────────────────

const SalarySlip: React.FC<{ record: PayrollRecord; onClose?: () => void }> = ({ record, onClose }) => {
  const finalPay = record.finalPay ?? 0;
  const netPayWords = numberToWords(finalPay);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = record.components || {};
  const basic = c.basic ?? 0;
  const hra = c.hra ?? 0;
  const medical = c.medical ?? 1250;
  const ta = c.ta ?? 2500;
  const lta = c.lta ?? 3500;
  const specialAllowance = c.specialAllowance ?? 0;

  const pfEmployee = c.pfEmployee ?? 0;
  const pfEmployer = c.pfEmployer ?? 0;
  const esi = c.esi ?? 0;
  const pt = c.pt ?? 0;
  const tds = c.tds ?? 0;
  const otherDeductions = c.otherDeductions ?? 0;

  const totalDeductions = pfEmployee + pfEmployer + esi + pt + tds + otherDeductions + (record.lopDeduction ?? 0);
  const totalCtc = basic + hra + medical + ta + lta + specialAllowance; // gross/prorata

  let addHeads = record.additionHeads ?? [];
  let dedHeads = record.deductionHeads ?? [];
  let addValues = record.additionValues ?? [];
  let dedValues = record.deductionValues ?? [];

  // Only re-compute if the record has no saved heads/values at all.
  // If they exist (even partly empty), use them — they were calculated
  // at the time HR set the CTC and are the source of truth for the PDF/email.
  const hasSavedHeads = Array.isArray(addHeads) && addHeads.some(h => h?.trim());
  if (!hasSavedHeads) {
    const comp = computeNet({
      monthlySalary: record.monthlySalary ?? record.ctc ?? 0,
      monthlyCtc: record.ctc,
      totalDays: record.totalDays,
      payDays: record.payDays,
      medical: c.medical,
      ta: c.ta,
      lta: c.lta,
      reimbursement: c.reimbursement,
      incentives: c.incentives,
      overtime: c.overtime,
      tds: c.tds,
      otherDeductions: c.otherDeductions,
      employeeId: record.employeeId,
      attendanceBreakdown: record.attendanceBreakdown,
      hasPf: record.hasPf,
      hasEsi: record.hasEsi,
      hasPt: record.hasPt,
    });
    addHeads = comp.additionHeads ?? [];
    dedHeads = comp.deductionHeads ?? [];
    addValues = comp.additionValues ?? [];
    dedValues = comp.deductionValues ?? [];
  }

  const earnings: { label: string; val: number | null }[] = [];
  const deductions: { label: string; val: number | null }[] = [];

  for (let i = 0; i < 10; i++) {
    const addName = (addHeads ?? [])[i]?.trim();
    if (addName) {
      earnings.push({ label: addName, val: addValues?.[i] ?? null });
    } else {
      earnings.push({ label: '', val: null });
    }

    const dedName = (dedHeads ?? [])[i]?.trim();
    if (dedName) {
      deductions.push({ label: dedName, val: dedValues?.[i] ?? null });
    } else {
      deductions.push({ label: '', val: null });
    }
  }

  const postNetEarnings = [];
  if (record.components?.reimbursement) postNetEarnings.push({ label: 'Travel Allowance', val: record.components.reimbursement });
  if (record.components?.overtime) postNetEarnings.push({ label: 'Overtime', val: record.components.overtime });
  if (record.components?.incentives) postNetEarnings.push({ label: 'Incentives', val: record.components.incentives });

  earnings.push(...postNetEarnings);

  let maxSlipRows = 0;
  for (let i = 0; i < Math.max(earnings.length, deductions.length); i++) {
    if (earnings[i]?.label || deductions[i]?.label) {
      maxSlipRows = i + 1;
    }
  }
  if (maxSlipRows === 0) maxSlipRows = Math.max(10, earnings.length);

  const finalTotalDeductions = Array.isArray(record.deductionValues)
    ? record.deductionValues.reduce((a, b) => a + b, 0)
    : totalDeductions;
  const finalTotalCtc = Array.isArray(record.additionValues)
    ? record.additionValues.reduce((a, b) => a + b, 0)
    : totalCtc;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:p-0" id="salary-slip-overlay">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto print:max-h-full print:shadow-none print:rounded-none" id="salary-slip-card">
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 print:hidden">
          <span className="text-sm font-semibold text-gray-500">Salary Slip Preview</span>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-4 py-2 bg-varistor-lime text-white text-sm font-semibold rounded-lg hover:bg-[#65a30d] transition-colors"
            >
              <Printer size={15} /> Print / Download PDF
            </button>
            {onClose && (
              <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                Close
              </button>
            )}
          </div>
        </div>
        <div className="p-8 font-sans text-gray-900 leading-normal print:[&_*]:text-black">
          {/* Header Banner */}
          <div className="text-center mb-4 relative pb-4 border-b border-gray-200">
            <div className="flex flex-col items-center justify-center gap-2 mb-1">
              <img src={logoUrl} alt="Varistor Logo" className="h-12 object-contain" />
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Varistor Technologies Pvt. Ltd.</h1>
            </div>
            <p className="text-[11px] text-gray-500">No. F-1107, Block-1, First Floor Ardente Office One, Hoodi Circle, ITPL Main Rd, Bengaluru, Karnataka 560048</p>
            <p className="text-[11px] text-gray-500">Email - hr@varistor.in, Telephone - 080 4117 8911</p>
          </div>

          {/* Yellow Month Bar */}
          <div className="bg-yellow-200 text-center py-1.5 font-bold text-sm text-gray-900 border border-yellow-300 rounded mb-4">
            Pay Slip for the Month of {record.month}
          </div>

          {/* Employee Details Grid */}
          <div className="grid grid-cols-4 border border-gray-300 rounded text-xs mb-4 divide-x divide-y divide-gray-300">
            <div className="p-2 font-bold bg-gray-50">Emp ID.</div>
            <div className="p-2">{record.employeeId || '—'}</div>
            <div className="p-2 font-bold bg-gray-50">Designation</div>
            <div className="p-2">{record.designation || 'WELDER'}</div>
            <div className="p-2 font-bold bg-gray-50 border-t-0">Employee Name</div>
            <div className="p-2 border-t-0">{record.employeeName}</div>
            <div className="p-2 font-bold bg-gray-50 border-t-0">Department</div>
            <div className="p-2 border-t-0">{record.department || '—'}</div>
            <div className="p-2 font-bold bg-gray-50 border-t-0">No. of Days</div>
            <div className="p-2 border-t-0">{record.totalDays ?? getDaysInMonth(record.month || MONTH)}</div>
            <div className="p-2 font-bold bg-gray-50 border-t-0">Paid No. of Days</div>
            <div className="p-2 border-t-0">{record.payDays ?? getDaysInMonth(record.month || MONTH)}</div>
            <div className="p-2 font-bold bg-gray-50 border-t-0">PF UAN No.</div>
            <div className="p-2 border-t-0">{record.pfUan || '—'}</div>
            <div className="p-2 font-bold bg-gray-50 border-t-0">CL Balance</div>
            <div className="p-2 border-t-0">{record.clBalance ?? 0}</div>
          </div>

          {/* Earnings & Deductions Table */}
          <table className="w-full text-xs border border-gray-300 border-collapse mb-4 divide-y divide-gray-300">
            <thead>
              <tr className="bg-blue-100 divide-x divide-gray-300 font-bold">
                <th className="px-3 py-2 border-r border-gray-200 w-1/4">Earnings</th>
                <th className="px-3 py-2 border-r border-gray-200 w-1/4">Amount (Rs.)</th>
                <th className="px-3 py-2 border-r border-gray-200 w-1/4">Deductions</th>
                <th className="px-3 py-2 w-1/4">Amount (Rs.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {Array.from({ length: maxSlipRows }).map((_, idx) => {
                const earn = earnings[idx] || { label: '', val: null };
                const deduct = deductions[idx] || { label: '', val: null };
                return (
                  <tr key={idx} className="divide-x divide-gray-300">
                    <td className="p-2">{earn.label || <span className="opacity-0">—</span>}</td>
                    <td className="p-2 text-right font-mono">
                      {earn.label && earn.val !== null && earn.val !== undefined ? fmt(earn.val) : ''}
                    </td>
                    <td className="p-2">{deduct.label || <span className="opacity-0">—</span>}</td>
                    <td className="p-2 text-right font-mono">
                      {deduct.label && deduct.val !== null && deduct.val !== undefined ? fmt(deduct.val) : ''}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-100 font-bold divide-x divide-gray-300 border-t border-gray-300">
                <td className="p-2">Total Earnings</td>
                <td className="p-2 text-right font-mono">{fmt(finalTotalCtc)}</td>
                <td className="p-2">Total Deduction</td>
                <td className="p-2 text-right font-mono">{fmt(finalTotalDeductions)}</td>
              </tr>
            </tbody>
          </table>

          {/* Net Pay Block */}
          <div className="grid grid-cols-2 border border-gray-300 rounded overflow-hidden text-sm font-bold divide-x divide-gray-300 mb-4">
            <div className="bg-green-50 p-3 flex justify-between items-center">
              <span className="text-gray-700">Final Pay [In-Hand]</span>
              <span className="text-xl text-varistor-limeText font-black">{fmt(finalPay)}</span>
            </div>
            <div className="bg-gray-50 p-3 flex flex-col items-center justify-center text-center text-xs text-gray-700 leading-tight">
              {finalTotalDeductions > 0 && (
                <span className="text-[10px] text-gray-400 mb-1">Total Earnings: {fmt(finalTotalCtc)} | Total Deductions: {fmt(finalTotalDeductions)}</span>
              )}
              <span>{netPayWords}</span>
            </div>
          </div>

          <p className="text-[10px] text-gray-400 text-center font-semibold mt-4">
            This is a computer generated payslip no signature is required.
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── Excel Upload → Preview → Send Panel ──────────────────────────────────────

type SendStep = 'idle' | 'preview' | 'sending' | 'done';


interface ExcelUploadPanelProps {
  onClose: () => void;
}

const ExcelUploadPanel: React.FC<ExcelUploadPanelProps> = ({ onClose }) => {
  const [step, setStep] = useState<SendStep>('idle');
  const [rows, setRows] = useState<SlipRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [fileName, setFileName] = useState('');
  const [sendResult, setSendResult] = useState<BulkSendResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);


  // Dynamically load xlsx from CDN if not already available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadXlsx = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (window as any).XLSX !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolve((window as any).XLSX);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      script.onload = () => resolve((window as any).XLSX);
      script.onerror = () => reject(new Error('Failed to load xlsx library'));
      document.head.appendChild(script);
    });
  };

  const parseFile = async (file: File) => {
    setParseError('');
    setFileName(file.name);
    try {
      const XLSXLib = await loadXlsx();
      const buf = await file.arrayBuffer();
      const wb = XLSXLib.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any[][] = XLSXLib.utils.sheet_to_json(ws, { header: 1, defval: '' });

      if (raw.length < 2) {
        setParseError('The sheet appears to be empty or has only a header row.');
        return;
      }

      // Map header row → canonical key
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const headers = (raw[0] as any[]).map(h => resolveHeader(String(h)));
      const hasName = headers.includes('name');
      const hasEmail = headers.includes('email');
      const hasSalary = headers.includes('monthlySalary') || headers.includes('ctc');
      if (!hasName || !hasEmail || !hasSalary) {
        setParseError(`Missing required columns. Please check your Excel header row contains Name, Email, and either Salary or CTC.`);
        return;
      }

      const payrollRecords = await getPayrollRecords();
      const clBalancesData = await fetchAllClBalances();
      const parsed: SlipRow[] = [];
      for (let i = 1; i < raw.length; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = raw[i] as any[];
        if (row.every(cell => String(cell).trim() === '')) continue; // skip blank rows
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj: any = {};
        headers.forEach((key, idx) => { if (key) obj[key] = row[idx]; });

        const name = String(obj.name || '').trim();
        const email = String(obj.email || '').trim();
        const employeeId = obj.employeeId ? String(obj.employeeId).trim() : `VAR-${String(i).padStart(3, '0')}`;
        const department = obj.department ? String(obj.department).trim() : 'Operation';
        const designation = obj.designation ? String(obj.designation).trim() : 'WELDER';
        const month = obj.month ? String(obj.month).trim() : MONTH;

        const monthlySalary = parseNumber(obj.monthlySalary ?? obj.ctc ?? 0);
        const ctc = parseNumber(obj.ctc ?? obj.monthlySalary ?? 0);
        const actualDays = getDaysInMonth(month);
        const totalDays = actualDays;
        const rawPayDays = parseNumber(obj.payDays ?? (parseNumber(obj.totalDays ?? actualDays) || actualDays));
        const payDays = Math.min(rawPayDays, totalDays);
        const clBalance = parseNumber(obj.clBalance ?? 0);
        const pfUan = obj.pfUan ? String(obj.pfUan).trim() : '—';

        const medical = parseNumber(obj.medical ?? 1250);
        const ta = parseNumber(obj.ta ?? 2500);
        const lta = parseNumber(obj.lta ?? 3500);

        const reimbursement = parseNumber(obj.reimbursement ?? 0);
        const incentives = parseNumber(obj.incentives ?? 0);
        const overtime = parseNumber(obj.overtime ?? 0);
        const tds = parseNumber(obj.tds ?? 0);
        const otherDeductions = parseNumber(obj.otherDeductions ?? 0);

        const clBal = clBalancesData[employeeId] ?? { total: 12, used: 0 };
        const lopDays = computeLopDays(clBal);

        const comp = computeNet({
          monthlySalary,
          totalDays,
          payDays,
          lopDays,
          medical,
          ta,
          lta,
          reimbursement,
          incentives,
          overtime,
          tds,
          otherDeductions,
          employeeId,
        });

        const payRec = payrollRecords.find(r => r.employeeId === employeeId);

        parsed.push({
          name,
          email,
          employeeId,
          department,
          designation,
          month,
          monthlySalary,
          totalDays,
          payDays,
          clBalance,
          pfUan,
          medical: comp.medical,
          ta: comp.ta,
          lta: comp.lta,
          reimbursement: comp.reimbursement,
          incentives: comp.incentives,
          overtime: comp.overtime,
          tds: comp.tds,
          otherDeductions: comp.otherDeductions,
          basic: comp.basic,
          hra: comp.hra,
          specialAllowance: comp.specialAllowance,
          pfEmployee: comp.pfEmployee,
          pfEmployer: comp.pfEmployer,
          esi: comp.esi,
          pt: comp.pt,
          ctc,
          deductions: comp.totalDeductions,
          netPay: comp.netPay,
          finalPay: comp.finalPay,
          additionHeads: comp.additionHeads,
          deductionHeads: comp.deductionHeads,
          additionValues: comp.additionValues,
          deductionValues: comp.deductionValues,
          deduction: payRec?.deduction ?? 0,
        });
      }

      if (parsed.length === 0) {
        setParseError('No data rows found after parsing. Check the file format.');
        return;
      }

      setRows(parsed);
      setStep('preview');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setParseError(`Failed to parse file: ${err.message}`);
    }
  };

  const handleFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext || '')) {
      setParseError('Please upload an .xlsx, .xls, or .csv file.');
      return;
    }
    parseFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const removeRow = (idx: number) => {
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSend = async () => {
    setStep('sending');
    setProgress(0);

    // Animate progress while waiting for backend
    const interval = setInterval(() => {
      setProgress(p => Math.min(p + 2, 90));
    }, 200);

    try {
      const result = await sendBulkSlips(rows);
      clearInterval(interval);
      setProgress(100);
      setSendResult(result);
      setStep('done');

      setStep('done');

      // Sync exact calculated figures to the central database and mark as released
      const sentRows = rows.filter(r => !result.failed.find(f => f.email === r.email));
      if (sentRows.length > 0) {
        await releaseAndSyncSlips(sentRows);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      clearInterval(interval);
      setParseError(`Send failed: ${err.message}`);
      setStep('preview');
    }
  };

  const validRows = rows.filter(r => r.name && r.email);
  const invalidRows = rows.filter(r => !r.name || !r.email);

  return (
    <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor mb-8 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-varistor-border bg-varistor-limeLight">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={18} className="text-varistor-lime" />
          <span className="font-bold text-varistor-dark text-sm">Excel → Salary Slip → Email Dispatch</span>
          {step !== 'idle' && (
            <>
              <ArrowRight size={14} className="text-varistor-muted" />
              <span className="text-xs text-varistor-muted font-medium capitalize">
                {step === 'preview' ? `Preview (${rows.length} rows)` : step === 'sending' ? 'Sending…' : 'Done'}
              </span>
            </>
          )}
        </div>
        <button onClick={onClose} className="text-varistor-muted hover:text-varistor-dark p-1 rounded">
          <X size={16} />
        </button>
      </div>

      <div className="p-6">

        {/* ── Step 1: Upload ── */}
        {step === 'idle' && (
          <div>
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${isDragging
                ? 'border-varistor-lime bg-varistor-limeLight'
                : 'border-varistor-border hover:border-varistor-lime hover:bg-varistor-limeLight'
                }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
              />
              <FileSpreadsheet size={40} className={`mx-auto mb-3 ${isDragging ? 'text-varistor-lime' : 'text-varistor-muted'}`} />
              <p className="font-semibold text-varistor-dark">Drop your Excel file here</p>
              <p className="text-xs text-varistor-muted mt-1">or click to browse · .xlsx / .xls / .csv</p>
            </div>


            {/* Column guide */}
            <div className="mt-5 p-4 bg-varistor-pageBg rounded-lg border border-varistor-border">
              <p className="text-xs font-bold text-varistor-muted uppercase tracking-wider mb-2">Required Excel columns</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { col: 'Name', note: 'Full employee name', required: true },
                  { col: 'Email', note: 'Recipient email', required: true },
                  { col: 'CTC', note: 'Monthly CTC (₹)', required: true },
                  { col: 'Deductions', note: 'Total deductions (₹)', required: false },
                  { col: 'Employee ID', note: 'e.g. VAR-024', required: false },
                  { col: 'Department', note: 'Finance, Tech…', required: false },
                  { col: 'Month', note: 'e.g. Jun 2026', required: false },
                ].map(c => (
                  <div key={c.col} className="text-xs">
                    <span className={`font-bold ${c.required ? 'text-varistor-dark' : 'text-varistor-muted'}`}>
                      {c.required ? '* ' : ''}{c.col}
                    </span>
                    <p className="text-varistor-muted">{c.note}</p>
                  </div>
                ))}
              </div>
            </div>

            {parseError && (
              <div className="mt-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                {parseError}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === 'preview' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-varistor-dark text-sm">
                  📄 {fileName} — {rows.length} rows parsed
                </p>
                {invalidRows.length > 0 && (
                  <p className="text-xs text-red-600 mt-0.5">
                    ⚠ {invalidRows.length} row{invalidRows.length > 1 ? 's' : ''} missing name/email — will be skipped
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setStep('idle'); setRows([]); setFileName(''); setParseError(''); }}
                  className="text-xs px-3 py-1.5 border border-varistor-border rounded-lg hover:bg-gray-50 text-varistor-muted"
                >
                  ← Re-upload
                </button>
                <button
                  onClick={handleSend}
                  disabled={validRows.length === 0}
                  className="flex items-center gap-1.5 px-4 py-2 bg-varistor-lime text-white text-sm font-semibold rounded-lg hover:bg-[#65a30d] transition-colors disabled:opacity-50"
                >
                  <Send size={14} /> Generate &amp; Send {validRows.length} Slips
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-varistor-border">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-varistor-pageBg text-xs text-varistor-muted border-b border-varistor-border">
                  <tr>
                    {['#', 'Name', 'Email', 'Dept/Desg', 'Days (Tot/Pd)', 'Salary', 'Deductions', 'Net Pay', 'Month', ''].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-varistor-border">
                  {rows.map((row, idx) => {
                    const invalid = !row.name || !row.email;
                    return (
                      <tr key={idx} className={`${invalid ? 'bg-red-50' : 'hover:bg-varistor-pageBg'} transition-colors`}>
                        <td className="px-4 py-2.5 text-varistor-muted text-xs">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-semibold text-varistor-dark">
                          {row.name || <span className="text-red-500 text-xs">Missing</span>}
                        </td>
                        <td className="px-4 py-2.5 text-varistor-muted text-xs">
                          {row.email || <span className="text-red-500">Missing</span>}
                        </td>
                        <td className="px-4 py-2.5 text-varistor-muted text-xs">
                          <div>{row.department || '—'}</div>
                          <div className="text-[10px] text-gray-400">{row.designation || '—'}</div>
                        </td>
                        <td className="px-4 py-2.5 text-varistor-muted text-xs font-mono">
                          {row.totalDays || getDaysInMonth(row.month || MONTH)} / {row.payDays || getDaysInMonth(row.month || MONTH)}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-xs font-mono">{fmt(row.monthlySalary)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-xs font-mono text-red-600">{fmt(row.deductions)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-xs font-bold text-varistor-limeText">{fmt(row.finalPay ?? row.netPay)}</td>
                        <td className="px-4 py-2.5 text-varistor-muted text-xs">{row.month || MONTH}</td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={() => removeRow(idx)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                            title="Remove row"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {parseError && (
              <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                {parseError}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Sending progress ── */}
        {step === 'sending' && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 bg-varistor-limeLight rounded-full flex items-center justify-center mx-auto mb-4">
              <Send size={28} className="text-varistor-lime animate-pulse" />
            </div>
            <p className="font-bold text-varistor-dark mb-1">Generating &amp; sending salary slips…</p>
            <p className="text-sm text-varistor-muted mb-6">Dispatching {rows.length} emails via Resend · please wait</p>
            <div className="max-w-xs mx-auto">
              <div className="w-full bg-varistor-border rounded-full h-2 overflow-hidden">
                <div
                  className="bg-varistor-lime h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-varistor-muted mt-2">{progress}%</p>
            </div>
          </div>
        )}

        {/* ── Step 4: Done ── */}
        {step === 'done' && sendResult && (
          <div className="py-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-varistor-limeLight rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={28} className="text-varistor-lime" />
              </div>
              <div>
                <p className="font-bold text-varistor-dark text-base">Dispatch complete!</p>
                <p className="text-sm text-varistor-muted mt-0.5">
                  <span className="text-varistor-limeText font-semibold">{sendResult.sent} slips sent</span>
                  {sendResult.failed.length > 0 && (
                    <span className="text-red-600 font-semibold"> · {sendResult.failed.length} failed</span>
                  )}
                </p>
              </div>
            </div>

            {sendResult.sentList && sendResult.sentList.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">Successfully Delivered</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {sendResult.sentList.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-green-700">
                      <CheckCircle2 size={12} />
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-green-600">&lt;{s.email}&gt;</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sendResult.failed.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2">Failed deliveries</p>
                <div className="space-y-1">
                  {sendResult.failed.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-red-600">
                      <AlertTriangle size={12} />
                      <span className="font-semibold">{f.name}</span>
                      <span className="text-red-400">&lt;{f.email}&gt;</span>
                      <span className="text-red-400">— {f.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => { setStep('idle'); setRows([]); setFileName(''); setSendResult(null); setProgress(0); }}
                className="px-4 py-2 text-sm font-medium border border-varistor-border rounded-lg hover:bg-varistor-limeLight text-varistor-dark"
              >
                Upload another file
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold bg-varistor-lime text-white rounded-lg hover:bg-[#65a30d]"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Payslip Schedule Panel ──────────────────────────────────────────────────────────

const PayslipSchedulePanel: React.FC = () => {
  const [schedule, setSchedule] = useState<PayslipSchedule | null>(null);
  const [editDay, setEditDay] = useState(10);
  const [editHour, setEditHour] = useState(10);
  const [editMinute, setEditMinute] = useState(0);
  const [editEnabled, setEditEnabled] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<BulkSendResult | null>(null);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    getPayslipSchedule().then(s => {
      setSchedule(s);
      setEditDay(s.day);
      setEditHour(s.hour);
      setEditMinute(s.minute);
      setEditEnabled(s.enabled);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const updated = await updatePayslipSchedule({ day: editDay, hour: editHour, minute: editMinute, enabled: editEnabled });
      setSchedule(updated);
      setIsEditing(false);
      setSaveMsg('Schedule saved ✔');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err) {
      setSaveMsg('Failed to save: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  };

  const handleTrigger = async () => {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const result = await triggerManualSend();
      setTriggerResult(result);
      // Refresh lastRun
      const s = await getPayslipSchedule();
      setSchedule(s);
    } catch (err) {
      setTriggerResult({ sent: 0, failed: [{ email: '', name: '', error: err instanceof Error ? err.message : String(err) }] });
    } finally {
      setTriggering(false);
    }
  };

  const padded = (n: number) => String(n).padStart(2, '0');
  const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor mb-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-varistor-border bg-gradient-to-r from-varistor-limeLight to-white">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-varistor-lime" />
          <span className="font-bold text-varistor-dark text-sm">Payslip Auto-Send Schedule</span>
          {schedule && (
            <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${schedule.enabled
              ? 'bg-varistor-limeTint text-varistor-limeText'
              : 'bg-gray-100 text-gray-400'
              }`}>
              {schedule.enabled ? 'ENABLED' : 'DISABLED'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-varistor-border rounded-lg hover:bg-varistor-limeLight text-varistor-dark transition-colors"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              Edit Schedule
            </button>
          )}
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-varistor-lime text-white rounded-lg hover:bg-[#65a30d] transition-colors disabled:opacity-60"
          >
            {triggering ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
            {triggering ? 'Sending…' : 'Send Now'}
          </button>
        </div>
      </div>

      <div className="p-6">
        {!schedule ? (
          <div className="flex items-center gap-2 text-varistor-muted text-sm">
            <RefreshCw size={14} className="animate-spin" /> Loading schedule…
          </div>
        ) : !isEditing ? (
          /* ── View Mode ── */
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[160px] bg-varistor-pageBg rounded-xl p-4 border border-varistor-border">
                <p className="text-[11px] text-varistor-muted uppercase tracking-wider font-bold mb-1">Send Day</p>
                <p className="text-2xl font-black text-varistor-dark">{ordinal(schedule.day)}</p>
                <p className="text-xs text-varistor-muted">of every month</p>
              </div>
              <div className="flex-1 min-w-[160px] bg-varistor-pageBg rounded-xl p-4 border border-varistor-border">
                <p className="text-[11px] text-varistor-muted uppercase tracking-wider font-bold mb-1">Send Time</p>
                <p className="text-2xl font-black text-varistor-dark">{padded(schedule.hour)}:{padded(schedule.minute)}</p>
                <p className="text-xs text-varistor-muted">IST (Asia/Kolkata)</p>
              </div>
              <div className="flex-1 min-w-[160px] bg-varistor-pageBg rounded-xl p-4 border border-varistor-border">
                <p className="text-[11px] text-varistor-muted uppercase tracking-wider font-bold mb-1">Last Run</p>
                <p className="text-sm font-semibold text-varistor-dark">
                  {schedule.lastRun ? new Date(schedule.lastRun).toLocaleString('en-IN') : '— Never'}
                </p>
                <p className="text-xs text-varistor-muted">auto-dispatch</p>
              </div>
            </div>

            {triggerResult && (
              <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${triggerResult.failed.length === 0
                ? 'bg-varistor-limeLight border-varistor-lime text-varistor-limeText'
                : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                {triggerResult.skipped ? (
                  <><AlertTriangle size={16} className="flex-shrink-0 mt-0.5" /><span>No approved/released payroll records found on server. Sync records first by approving payroll.</span></>
                ) : triggerResult.failed.length === 0 ? (
                  <><CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" /><span>✓ {triggerResult.sent} payslips dispatched successfully.</span></>
                ) : (
                  <><AlertTriangle size={16} className="flex-shrink-0 mt-0.5" /><span>{triggerResult.sent} sent · {triggerResult.failed.length} failed: {triggerResult.failed.map(f => `${f.name || 'Unknown'} (${f.email}): ${f.error}`).join(' | ')}</span></>
                )}
              </div>
            )}

            {triggerResult && triggerResult.sentList && triggerResult.sentList.length > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-2">
                <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">Successfully Delivered</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {triggerResult.sentList.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-green-700">
                      <CheckCircle2 size={12} />
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-green-600">&lt;{s.email}&gt;</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ── Edit Mode ── */
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Day */}
              <div>
                <label className="block text-xs font-bold text-varistor-dark mb-2">Send Day (1–28)</label>
                <input
                  type="number"
                  min={1} max={28}
                  value={editDay}
                  onChange={e => setEditDay(Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full border border-varistor-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-varistor-lime"
                />
                <p className="text-[10px] text-varistor-muted mt-1">Day of month (1–28; max 28 to avoid month-end issues)</p>
              </div>
              {/* Hour */}
              <div>
                <label className="block text-xs font-bold text-varistor-dark mb-2">Hour (0–23, IST)</label>
                <input
                  type="number"
                  min={0} max={23}
                  value={editHour}
                  onChange={e => setEditHour(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-full border border-varistor-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-varistor-lime"
                />
                <p className="text-[10px] text-varistor-muted mt-1">10 = 10 AM IST</p>
              </div>
              {/* Minute */}
              <div>
                <label className="block text-xs font-bold text-varistor-dark mb-2">Minute (0–59)</label>
                <input
                  type="number"
                  min={0} max={59}
                  value={editMinute}
                  onChange={e => setEditMinute(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-full border border-varistor-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-varistor-lime"
                />
              </div>
            </div>

            {/* Enable / Disable toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditEnabled(v => !v)}
                className="flex items-center gap-2 text-sm font-semibold text-varistor-dark"
              >
                {editEnabled
                  ? <ToggleRight size={28} className="text-varistor-lime" />
                  : <ToggleLeft size={28} className="text-gray-300" />}
                {editEnabled ? 'Auto-send Enabled' : 'Auto-send Disabled'}
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
              📅 Payslips will auto-send on the <strong>{ordinal(editDay)}</strong> of every month at <strong>{padded(editHour)}:{padded(editMinute)} IST</strong>.
              The server must be running for the cron job to fire.
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 bg-varistor-lime text-white text-sm font-semibold rounded-lg hover:bg-[#65a30d] disabled:opacity-60 transition-colors"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {saving ? 'Saving…' : 'Save Schedule'}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  if (schedule) { setEditDay(schedule.day); setEditHour(schedule.hour); setEditMinute(schedule.minute); setEditEnabled(schedule.enabled); }
                }}
                className="px-5 py-2 text-sm border border-varistor-border rounded-lg hover:bg-gray-50 text-varistor-muted transition-colors"
              >
                Cancel
              </button>
              {saveMsg && <span className={`text-xs font-semibold ${saveMsg.includes('Failed') ? 'text-red-600' : 'text-varistor-limeText'}`}>{saveMsg}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Customizable Payroll Configurations ────────────────────────────────────────

const SalaryHeadMaster: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [additions, setAdditions] = useState<string[]>(Array(10).fill(''));
  const [deductions, setDeductions] = useState<string[]>(Array(10).fill(''));
  const [pfPercentage, setPfPercentage] = useState<number>(12);
  const [esiPercentage, setEsiPercentage] = useState<number>(0);
  const [ptRanges, setPtRanges] = useState<{ min: number; max: number; amount: number }[]>([]);

  const loadData = async () => {
    try {
      const res = await apiFetch('/api/payroll-settings');
      const data = res.ok ? await res.json() : {};
      const heads = data.heads;
      setAdditions(heads?.additions ?? ["Basic", "HRA", "MEDICAL ALLOWANCE", "TA", "LTA", "SPECIAL ALLOWANCE", "", "", "", ""]);
      setDeductions(heads?.deductions ?? ["PF Employee", "PF Employer", "ESI", "PT", "Advance salary adjut", "", "", "", "", ""]);
      setPfPercentage(heads?.pfPercentage ?? 12);
      setEsiPercentage(heads?.esiPercentage ?? 0);
      setPtRanges(heads?.ptRanges ?? [
        { min: 0, max: 2999, amount: 0 },
        { min: 3000, max: 5999, amount: 20 },
        { min: 6000, max: 8999, amount: 80 },
        { min: 9000, max: 11999, amount: 150 },
        { min: 12000, max: 500000, amount: 200 }
      ]);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  const handleSave = async () => {
    const data = { additions, deductions, pfPercentage, esiPercentage, ptRanges };
    await savePayrollSetting('heads', data);
    await loadPayrollSettings();
    setIsEditing(false);
  };

  const handleCancel = () => {
    loadData();
    setIsEditing(false);
  };

  return (
    <div className="bg-white rounded-varistor border border-varistor-border p-6 shadow-varistor mb-6 animate-[fadeInPage_200ms_ease-out]">
      <div className="border-b border-varistor-border pb-4 mb-6">
        <h2 className="text-lg font-bold text-varistor-dark">Advanced Salary Head Master</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Addition Heads */}
        <div>
          <h3 className="text-xs font-bold text-center text-varistor-dark mb-4 uppercase tracking-wider">Addition Head</h3>
          <div className="space-y-2">
            {additions.map((head, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-[11px] text-varistor-muted w-20">Add. Head {idx + 1}</span>
                <input
                  type="text"
                  value={head}
                  disabled={!isEditing}
                  onChange={e => {
                    const next = [...additions];
                    next[idx] = e.target.value;
                    setAdditions(next);
                  }}
                  className="flex-1 text-xs border border-varistor-border rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-varistor-lime disabled:bg-varistor-pageBg disabled:text-varistor-muted"
                  placeholder={`Add. Head ${idx + 1}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Deduction Heads */}
        <div>
          <h3 className="text-xs font-bold text-center text-varistor-dark mb-4 uppercase tracking-wider">Deduction Head</h3>
          <div className="space-y-2">
            {deductions.map((head, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="text-[11px] text-varistor-muted w-20">Ded. Head {idx + 1}</span>
                <input
                  type="text"
                  value={head}
                  disabled={!isEditing}
                  onChange={e => {
                    const next = [...deductions];
                    next[idx] = e.target.value;
                    setDeductions(next);
                  }}
                  className="flex-1 text-xs border border-varistor-border rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-varistor-lime disabled:bg-varistor-pageBg disabled:text-varistor-muted"
                  placeholder={`Ded. Head ${idx + 1}`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Other Deduction */}
        <div>
          <h3 className="text-xs font-bold text-center text-varistor-dark mb-4 uppercase tracking-wider">Other Deduction</h3>
          <div className="space-y-4 bg-varistor-pageBg p-4 rounded-xl border border-varistor-border">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-varistor-dark w-16">PF (%)</span>
              <input
                type="number"
                value={pfPercentage}
                disabled={!isEditing}
                onChange={e => setPfPercentage(Number(e.target.value))}
                className="w-20 text-xs border border-varistor-border rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-varistor-lime bg-white disabled:bg-transparent"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-varistor-dark w-16">ESI (%)</span>
              <input
                type="number"
                value={esiPercentage}
                disabled={!isEditing}
                onChange={e => setEsiPercentage(Number(e.target.value))}
                className="w-20 text-xs border border-varistor-border rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-varistor-lime bg-white disabled:bg-transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Professional Tax Slabs */}
      <div className="border-t border-varistor-border pt-6 mb-8">
        <h3 className="text-xs font-bold text-center text-varistor-dark mb-4 uppercase tracking-wider">Professional Tax Range</h3>
        <div className="max-w-xl mx-auto space-y-2">
          {ptRanges.map((range, idx) => (
            <div key={idx} className="flex items-center justify-center gap-3">
              <input
                type="number"
                value={range.min}
                disabled={!isEditing}
                onChange={e => {
                  const next = [...ptRanges];
                  next[idx].min = Number(e.target.value);
                  setPtRanges(next);
                }}
                className="w-24 text-center text-xs border border-varistor-border rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-varistor-lime disabled:bg-varistor-pageBg"
              />
              <span className="text-xs font-bold text-varistor-muted">TO</span>
              <input
                type="number"
                value={range.max}
                disabled={!isEditing}
                onChange={e => {
                  const next = [...ptRanges];
                  next[idx].max = Number(e.target.value);
                  setPtRanges(next);
                }}
                className="w-28 text-center text-xs border border-varistor-border rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-varistor-lime disabled:bg-varistor-pageBg"
              />
              <span className="text-xs font-bold text-varistor-muted">=</span>
              <input
                type="number"
                value={range.amount}
                disabled={!isEditing}
                onChange={e => {
                  const next = [...ptRanges];
                  next[idx].amount = Number(e.target.value);
                  setPtRanges(next);
                }}
                className="w-24 text-center text-xs border border-varistor-border rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-varistor-lime disabled:bg-varistor-pageBg"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex items-center justify-center gap-3 border-t border-varistor-border pt-6">
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1.5 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            Edit
          </button>
        ) : (
          <>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-6 py-2 bg-varistor-lime hover:bg-[#65a30d] text-white text-xs font-bold rounded-lg transition-all shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1.5 px-6 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Cancel
            </button>
          </>
        )}
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Exit
        </button>
      </div>
    </div>
  );
};

const SalaryFormulaMaster: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const [formulas, setFormulas] = useState<{ code: string; name: string; equation: string }[]>([]);
  const [availableHeads, setAvailableHeads] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState({ code: '', name: '', equation: '' });
  const [search, setSearch] = useState('');

  const loadData = async () => {
    const defaults = [
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
    try {
      const res = await apiFetch('/api/payroll-settings');
      const data = res.ok ? await res.json() : {};
      const loaded = Array.isArray(data.formulas) && data.formulas.length >= 9 ? data.formulas : defaults;
      setFormulas(loaded);

      const heads = data.heads;
      let headsList: string[] = [];
      if (heads) {
        if (heads.additions) headsList = [...headsList, ...heads.additions];
        if (heads.deductions) headsList = [...headsList, ...heads.deductions];
      } else {
        headsList = ["Basic", "HRA", "MEDICAL ALLOWANCE", "TA", "LTA", "SPECIAL ALLOWANCE", "PF Employee", "PF Employer", "ESI", "PT", "Advance salary adjut"];
      }
      setAvailableHeads(headsList.filter(h => h.trim() !== ''));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  const saveFormulas = async (newFormulas: typeof formulas) => {
    setFormulas(newFormulas);
    await savePayrollSetting('formulas', newFormulas);
    await loadPayrollSettings();
  };

  const handleOpenAdd = () => {
    const nextCode = `F${formulas.length + 1}`;
    setFormData({ code: nextCode, name: availableHeads[0] || '', equation: '' });
    setEditIndex(null);
    setShowForm(true);
  };

  const handleOpenEdit = (idx: number) => {
    setFormData(formulas[idx]);
    setEditIndex(idx);
    setShowForm(true);
  };

  const handleDelete = (idx: number) => {
    if (window.confirm('Are you sure you want to delete this formula?')) {
      const next = formulas.filter((_, i) => i !== idx);
      saveFormulas(next);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.equation) {
      alert('Please fill in all fields');
      return;
    }
    if (editIndex !== null) {
      const next = [...formulas];
      next[editIndex] = formData;
      saveFormulas(next);
    } else {
      saveFormulas([...formulas, formData]);
    }
    setShowForm(false);
  };

  const filtered = formulas.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.code.toLowerCase().includes(search.toLowerCase()) ||
    f.equation.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-varistor border border-varistor-border p-6 shadow-varistor mb-6 animate-[fadeInPage_200ms_ease-out]">
      <div className="border-b border-varistor-border pb-4 mb-6">
        <h2 className="text-lg font-bold text-varistor-dark">Salary Formula Master</h2>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleFormSubmit} className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="font-bold text-varistor-dark text-base">{editIndex !== null ? 'Edit Formula' : 'Add New Formula'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-varistor-muted mb-1">Formula Code</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={e => setFormData({ ...formData, code: e.target.value })}
                  className="w-full text-xs border border-varistor-border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-varistor-lime"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-varistor-muted mb-1">Formula Name (Associated Head)</label>
                <select
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-xs border border-varistor-border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-varistor-lime bg-white"
                >
                  {availableHeads.map(h => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-varistor-muted mb-1">Equation</label>
                <input
                  type="text"
                  value={formData.equation}
                  onChange={e => setFormData({ ...formData, equation: e.target.value })}
                  placeholder="e.g. (($BS*0.50)/$DIM)*($SP+$SW+$SL+$SH)"
                  className="w-full text-xs border border-varistor-border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-varistor-lime font-mono"
                  required
                />
                <div className="mt-2 text-[10px] text-varistor-muted bg-varistor-pageBg p-2.5 rounded border border-varistor-border leading-relaxed">
                  <span className="font-bold">Available variables:</span>
                  <div className="grid grid-cols-2 gap-x-2 mt-1 font-mono text-[9px]">
                    <div>$BS: Base Amt</div>
                    <div>$DIM: Days/Month</div>
                    <div>$SP: Present Days</div>
                    <div>$SW: Weekly Offs</div>
                    <div>$SL: Leaves</div>
                    <div>$SH: Holidays</div>
                  </div>
                  <div className="mt-2 text-[9px]">
                    Reference other formulas: e.g. <code className="bg-gray-100 px-1 rounded">$Basic * 0.50</code>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-varistor-border rounded-lg text-xs hover:bg-gray-50 text-varistor-dark font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-varistor-lime hover:bg-[#65a30d] text-white rounded-lg text-xs font-bold"
              >
                {editIndex !== null ? 'Update' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Top Filter and Search */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs text-varistor-muted">
          Show <span className="font-bold text-varistor-dark">all</span> entries
        </div>
        <div>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-xs border border-varistor-border rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-varistor-lime"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-varistor-border mb-6">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-varistor-pageBg text-varistor-muted border-b border-varistor-border font-bold text-left">
            <tr>
              <th className="p-3">Formula Code</th>
              <th className="p-3">Formula Name</th>
              <th className="p-3">Equation</th>
              <th className="p-3 text-center w-24">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-varistor-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-varistor-muted">No formulas found.</td>
              </tr>
            ) : (
              filtered.map((item, idx) => (
                <tr key={idx} className="hover:bg-varistor-pageBg transition-colors">
                  <td className="p-3 font-mono font-semibold text-varistor-dark">{item.code}</td>
                  <td className="p-3 font-semibold text-varistor-dark">{item.name}</td>
                  <td className="p-3 font-mono text-varistor-dark bg-gray-50/50">{item.equation}</td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(idx)}
                        className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                        title="Edit formula"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(idx)}
                        className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                        title="Delete formula"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Buttons */}
      <div className="flex gap-2.5">
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-1.5 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Exit
        </button>
      </div>
    </div>
  );
};

export const EmployeeSalaryDetails: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [editValue, setEditValue] = useState<number>(0);
  const [salaryDetails, setSalaryDetails] = useState<Record<string, number>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const emps = await getEmployees();
      setEmployees(emps);
      const saved = localStorage.getItem('eopms_employee_salary_details');
      if (saved) {
        setSalaryDetails(JSON.parse(saved));
      } else {
        const initialDetails: Record<string, number> = {
          "VAR-001": 150000,
          "VAR-002": 50000,
          "VAR-003": 35000,
          "VAR-004": 45000
        };
        setSalaryDetails(initialDetails);
        localStorage.setItem('eopms_employee_salary_details', JSON.stringify(initialDetails));
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmployee) {
      const next = { ...salaryDetails, [editingEmployee.employeeId]: editValue };
      setSalaryDetails(next);
      localStorage.setItem('eopms_employee_salary_details', JSON.stringify(next));
      setEditingEmployee(null);
    }
  };

  const departments = ['ALL', ...Array.from(new Set(employees.map(e => e.department).filter(Boolean)))];
  const companies = ['ALL', 'Varistor Technologies'];

  const filtered = employees.filter(emp => {
    if (deptFilter !== 'ALL' && emp.department !== deptFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        emp.fullName.toLowerCase().includes(q) ||
        emp.employeeId.toLowerCase().includes(q) ||
        (emp.department || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="bg-white rounded-varistor border border-varistor-border p-6 shadow-varistor mb-6 animate-[fadeInPage_200ms_ease-out]">
      <div className="border-b border-varistor-border pb-4 mb-6">
        <h2 className="text-lg font-bold text-varistor-dark">Employee Salary Details Configuration (By Formula)</h2>
      </div>

      {editingEmployee && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleEditSave} className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="font-bold text-varistor-dark text-base">Edit Reference Amount</h3>
            <p className="text-xs text-varistor-muted">Updating reference salary ($BS) for <span className="font-semibold text-varistor-dark">{editingEmployee.fullName} ({editingEmployee.employeeId})</span></p>
            <div>
              <label className="block text-xs font-semibold text-varistor-muted mb-1">BS/Reference Amount (₹)</label>
              <input
                type="number"
                value={editValue}
                onChange={e => setEditValue(Number(e.target.value))}
                className="w-full text-xs border border-varistor-border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-varistor-lime"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                className="px-4 py-2 border border-varistor-border rounded-lg text-xs hover:bg-gray-50 text-varistor-dark font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-varistor-lime hover:bg-[#65a30d] text-white rounded-lg text-xs font-bold"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters block */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 items-end">
        <div>
          <label className="block text-xs font-semibold text-varistor-muted mb-1">Select Company</label>
          <select
            value={companyFilter}
            onChange={e => setCompanyFilter(e.target.value)}
            className="w-full text-xs border border-varistor-border rounded px-3 py-2 bg-white focus:outline-none"
          >
            {companies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-varistor-muted mb-1">Select Department</label>
          <select
            value={deptFilter}
            onChange={e => setDeptFilter(e.target.value)}
            className="w-full text-xs border border-varistor-border rounded px-3 py-2 bg-white focus:outline-none"
          >
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="flex-1 text-xs py-2 px-4 border border-green-500 hover:bg-green-50 text-green-600 hover:text-green-700 font-bold rounded-lg transition-colors"
          >
            Apply Filter
          </button>
          <button
            onClick={() => { setCompanyFilter('ALL'); setDeptFilter('ALL'); setSearch(''); }}
            className="flex-1 text-xs py-2 px-4 border border-blue-500 hover:bg-blue-50 text-blue-600 hover:text-blue-700 font-bold rounded-lg transition-colors"
          >
            Clear Filter
          </button>
        </div>
        <div>
          <label className="block text-xs font-semibold text-varistor-muted mb-1">Search Employee</label>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full text-xs border border-varistor-border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-varistor-lime"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-lg border border-varistor-border shadow-varistor overflow-hidden mb-6">
        {loading ? (
          <div className="p-8 text-center text-varistor-muted text-xs">Loading employees...</div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead className="bg-varistor-pageBg text-varistor-muted border-b border-varistor-border font-bold text-left">
              <tr>
                <th className="p-3">EmpCode</th>
                <th className="p-3">Name</th>
                <th className="p-3">Dept. Name</th>
                <th className="p-3 text-right">BS/Reference Amt</th>
                <th className="p-3 text-center w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-varistor-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-varistor-muted">No employees found.</td>
                </tr>
              ) : (
                filtered.map((emp, idx) => {
                  const amt = salaryDetails[emp.employeeId] ?? 30000;
                  return (
                    <tr key={idx} className="hover:bg-varistor-pageBg transition-colors">
                      <td className="p-3 text-varistor-dark font-semibold">{emp.employeeId}</td>
                      <td className="p-3 text-varistor-dark font-semibold">{emp.fullName}</td>
                      <td className="p-3 text-varistor-muted">{emp.department || '—'}</td>
                      <td className="p-3 text-right text-varistor-dark font-mono font-bold">{fmt(amt)}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => { setEditingEmployee(emp); setEditValue(amt); }}
                            className="p-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
                            title="Edit salary reference"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      <button
        onClick={onExit}
        className="flex items-center gap-1.5 px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Exit
      </button>
    </div>
  );
};

// ─── Admin Salary Engine ──────────────────────────────────────────────────────

const FORMULAS = [
  { component: 'Basic', formula: '= round(CTC * 50% / total_days * pay_days)', auto: true },
  { component: 'HRA', formula: '= round(basic * 50%)', auto: true },
  { component: 'Medical Allowance', formula: '= round(1250 / total_days * pay_days)', auto: true },
  { component: 'TA', formula: '= round(2500 / total_days * pay_days)', auto: true },
  { component: 'LTA', formula: '= round(3500 / total_days * pay_days)', auto: true },
  { component: 'Special Allowance', formula: '= max(0, Monthly CTC − (Basic + HRA + Medical + TA + LTA))', auto: true },
  { component: 'PF Employee', formula: '= 1800 if basic >= 15000 else round(basic * 12%)', auto: true },
  { component: 'ESI', formula: '= 0 if monthly_ctc > 21000 else ceil(gross * 3.25%)', auto: true },
  { component: 'PT', formula: '= 200 if gross >= 15001 else 0', auto: true },
  { component: 'Net Pay', formula: '= Monthly CTC − Total Deductions', auto: true },
];


const SalaryEngine: React.FC = () => {
  const { currentRole } = useVariPoints();
  const isAdmin = currentRole === 'Admin' || currentRole === 'HR';

  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);
  const [applyingAll, setApplyingAll] = useState(false);
  const [previewRecord, setPreviewRecord] = useState<PayrollRecord | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [sortField, setSortField] = useState<keyof PayrollRecord>('employeeName');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterDept, setFilterDept] = useState('All');
  /** CL balances map: employeeId -> { total, used } */
  // const [clBalances, setClBalances] = useState<Record<string, ClBalance>>({});
  const [activeTab, setActiveTab] = useState<'engine' | 'heads' | 'formulas' | 'employees'>('engine');
  const [showFormulaRef, setShowFormulaRef] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [data, balances] = await Promise.all([
      getPayrollRecords(),
      fetchAllClBalances(),
    ]);

    let needsSync = false;
    const updatedData = data.map(rec => {
      if (rec.status === 'approved') return rec;
      const clBal = balances[rec.employeeId] ?? { total: 12, used: 0 };
      const lopDays = computeLopDays(clBal);

      const comp = computeNet({
        monthlySalary: rec.monthlySalary ?? rec.ctc ?? 0,
        monthlyCtc: rec.ctc,
        totalDays: rec.totalDays,
        payDays: rec.payDays,
        lopDays: lopDays,
        hasPf: rec.hasPf !== false,
        hasEsi: rec.hasEsi !== false,
        hasPt: rec.hasPt !== false,
        employeeId: rec.employeeId,
        attendanceBreakdown: rec.attendanceBreakdown,
        basic: rec.components?.basic,
        hra: rec.components?.hra,
        reimbursement: rec.components?.reimbursement,
        overtime: rec.components?.overtime,
        incentives: rec.components?.incentives,
      });

      if (rec.netPay !== comp.netPay || JSON.stringify(rec.additionValues) !== JSON.stringify(comp.additionValues)) {
        needsSync = true;
        return {
          ...rec,
          components: {
            ...rec.components,
            basic: comp.additionValues[0],
            hra: comp.additionValues[1],
            medical: comp.additionValues[2],
            ta: comp.additionValues[3],
            lta: comp.additionValues[4],
            specialAllowance: comp.additionValues[5]
          },
          deductionValues: comp.deductionValues,
          additionValues: comp.additionValues,
          gross: comp.gross,
          deduction: comp.totalDeductions,
          netPay: comp.netPay,
          finalPay: comp.finalPay,
        };
      }
      return rec;
    });

    setRecords(updatedData);
    setLoading(false);

    if (needsSync) {
      await syncPayrollToServer(updatedData);
    } else {
      await syncPayrollToServer(data);
    }
  }, []);


  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // Which month is currently being viewed in the Salary Engine table.
  // Defaults to the current month; HR/Admin can step backward/forward to
  // review payroll for other months.
  const [selectedMonth, setSelectedMonth] = useState(MONTH);
  const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const shiftSelectedMonth = (delta: number) => {
    const [mon, yr] = selectedMonth.split(' ');
    const idx = MONTH_ABBR.indexOf(mon);
    const d = new Date(parseInt(yr, 10), idx + delta, 1);
    setSelectedMonth(formatMonthToMMMYear(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`));
  };
  const isCurrentMonth = selectedMonth === MONTH;

  // Keep only the latest revision for each employee in the selected month to avoid duplicate keys and rows
  const monthRecords = Object.values(
    records
      .filter(r => r.month === selectedMonth)
      .reduce((acc, r) => {
        const existing = acc[r.employeeId];
        if (!existing || r.revision > existing.revision) {
          acc[r.employeeId] = r;
        }
        return acc;
      }, {} as Record<string, PayrollRecord>)
  );

  const departments = ['All', ...Array.from(new Set(monthRecords.map(r => r.department)))];

  const visible = monthRecords
    .filter(r => filterDept === 'All' || r.department === filterDept)
    .sort((a, b) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const av = a[sortField] as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bv = b[sortField] as any;
      return sortAsc ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
    });

  const toggleSort = (field: keyof PayrollRecord) => {
    if (sortField === field) setSortAsc(s => !s);
    else { setSortField(field); setSortAsc(true); }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const draftIds = visible.filter(r => r.status === 'draft').map(r => r.id);
    if (selectedIds.size === draftIds.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(draftIds));
  };

  const handleCTCChange = async (id: string, value: string) => {
    const ctc = parseInt(value.replace(/,/g, ''), 10);
    if (isNaN(ctc) || ctc <= 0) return;
    const updated = await updatePayrollRecord(id, { ctc });
    if (updated) {
      const next = records.map(r => r.id === id ? updated : r);
      setRecords(next);
      await syncPayrollToServer(next);
    }
  };

  const handleComponentChange = async (id: string, field: 'overtime' | 'reimbursement' | 'incentives', value: string) => {
    const val = parseInt(value.replace(/,/g, ''), 10) || 0;
    const rec = records.find(r => r.id === id);
    if (!rec) return;
    const updated = await updatePayrollRecord(id, { autoFormula: true, components: { ...rec.components, [field]: val } });
    if (updated) {
      const next = records.map(r => r.id === id ? updated : r);
      setRecords(next);
      await syncPayrollToServer(next);
    }
  };

  const handleDeductionChange = async (id: string, value: string) => {
    const deduction = parseInt(value.replace(/,/g, ''), 10);
    if (isNaN(deduction) || deduction < 0) return;
    const updated = await updatePayrollRecord(id, { deduction });
    if (updated) {
      const next = records.map(r => r.id === id ? updated : r);
      setRecords(next);
      await syncPayrollToServer(next);
    }
  };
  const handleApprove = async () => {
    const draftSelected = [...selectedIds].filter(id => records.find(r => r.id === id)?.status === 'draft');
    if (!draftSelected.length) return;
    setApproving(true);
    await approvePayroll(draftSelected, 'hr@varistor.in');
    await load();
    setSelectedIds(new Set());
    setApproving(false);
  };

  const handleApplyAll = async () => {
    setApplyingAll(true);
    // Apply formulas to each record individually so LOP days are included

    await applyFormulaToAll();
    await load();
    setApplyingAll(false);
  };

  const handleRevision = async (id: string) => {
    await createRevision(id, 'hr@varistor.in');
    await load();
  };

  const draftCount = monthRecords.filter(r => r.status === 'draft').length;
  const approvedCount = monthRecords.filter(r => r.status === 'approved').length;
  const totalNetPay = monthRecords.reduce((s, r) => s + (r.finalPay ?? r.netPay), 0);

  const SortIcon = ({ field }: { field: keyof PayrollRecord }) =>
    sortField === field
      ? (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
      : <ChevronDown size={12} className="opacity-30" />;

  return (
    <div className="max-w-full pb-20 animate-[fadeInPage_250ms_ease-out]">
      {previewRecord && <SalarySlip record={previewRecord} onClose={() => setPreviewRecord(null)} />}

      {showAudit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Payroll Audit Log</h3>
              <button onClick={() => setShowAudit(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="p-6 space-y-3">
              {payrollAuditLog.length === 0
                ? <p className="text-sm text-gray-500 text-center py-6">No audit entries yet.</p>
                : payrollAuditLog.slice().reverse().map((entry, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                    <ShieldCheck size={16} className="text-varistor-lime mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-800">{entry.action} · {entry.employeeId}</p>
                      <p className="text-gray-500 text-xs">{entry.by} · Net: {fmt(entry.finalPay ?? entry.netPay)}</p>
                      <p className="text-gray-400 text-[11px]">{new Date(entry.timestamp).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-varistor-dark flex items-center gap-2">
            <DollarSign size={20} className="text-varistor-lime" />
            Payroll — Salary Engine
          </h1>
          <p className="text-sm text-varistor-muted mt-0.5 flex items-center gap-1.5">
            Excel-driven formula engine ·
            <button onClick={() => shiftSelectedMonth(-1)} className="px-1.5 py-0.5 rounded hover:bg-varistor-surface font-bold" title="Previous month">‹</button>
            <span className="font-semibold text-varistor-dark">{selectedMonth}</span>
            <button onClick={() => shiftSelectedMonth(1)} disabled={isCurrentMonth} className="px-1.5 py-0.5 rounded hover:bg-varistor-surface font-bold disabled:opacity-30 disabled:cursor-not-allowed" title="Next month">›</button>
            · {monthRecords.length} employees
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'engine' && (
            <>
              <button
                onClick={() => setShowUploadPanel(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-colors border ${showUploadPanel
                  ? 'bg-varistor-lime text-white border-varistor-lime'
                  : 'border-varistor-border text-varistor-dark hover:bg-varistor-limeLight'
                  }`}
              >
                <Mail size={14} /> {showUploadPanel ? 'Hide Upload Panel' : 'Upload Excel & Send Slips'}
              </button>
              <button
                onClick={handleApplyAll}
                disabled={applyingAll}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-varistor-border rounded-lg hover:bg-varistor-limeLight transition-colors text-varistor-dark disabled:opacity-50"
              >
                {applyingAll ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Apply formulas to all
              </button>
              <button
                onClick={() => setShowAudit(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-varistor-border rounded-lg hover:bg-varistor-limeLight transition-colors text-varistor-dark"
              >
                <ShieldCheck size={14} /> Audit Log
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex border-b border-varistor-border gap-4 mb-6">
        {[
          { id: 'engine', label: 'Salary Engine', icon: DollarSign },
          { id: 'heads', label: 'Salary Head Master', icon: BarChart3 },
          { id: 'formulas', label: 'Salary Formula Master', icon: FileText }
        ].map(tab => (
          <button
            key={tab.id}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 pb-2 text-xs font-bold border-b-2 transition-all ${activeTab === tab.id
              ? 'border-varistor-lime text-varistor-limeText'
              : 'border-transparent text-varistor-muted hover:text-varistor-dark'
              }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'heads' && <SalaryHeadMaster onExit={() => setActiveTab('engine')} />}
      {activeTab === 'formulas' && <SalaryFormulaMaster onExit={() => setActiveTab('engine')} />}


      {activeTab === 'engine' && (
        <>
          {/* Payslip Scheduler Panel */}
          <PayslipSchedulePanel />

          {/* Excel Upload Panel */}
          {showUploadPanel && (
            <ExcelUploadPanel onClose={() => setShowUploadPanel(false)} />
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Employees', val: monthRecords.length, icon: Users, color: 'text-blue-500' },
              { label: 'Draft Slips', val: draftCount, icon: FileText, color: 'text-yellow-500' },
              { label: 'Approved Slips', val: approvedCount, icon: ShieldCheck, color: 'text-varistor-lime' },
              { label: 'Total Net Payroll', val: fmt(totalNetPay), icon: TrendingUp, color: 'text-varistor-lime' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-varistor border border-varistor-border p-4 flex items-center gap-3 shadow-varistor">
                <div className={`w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center ${stat.color}`}>
                  <stat.icon size={18} />
                </div>
                <div>
                  <p className="text-xs text-varistor-muted">{stat.label}</p>
                  <p className="font-bold text-varistor-dark text-sm">{stat.val}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Formula Reference */}
          <div className="bg-white rounded-varistor border border-varistor-border p-4 mb-6 shadow-varistor">
            <button
              onClick={() => setShowFormulaRef(v => !v)}
              className="w-full flex items-center justify-between text-xs font-bold text-varistor-muted uppercase tracking-wider focus:outline-none"
            >
              <span className="flex items-center gap-1.5">
                <BarChart3 size={13} /> Payroll Formulas (Excel-driven)
              </span>
              <span className="text-[10px] text-varistor-lime font-bold">
                {showFormulaRef ? 'Hide Formulas ▲' : 'View Formulas ▼'}
              </span>
            </button>

            {showFormulaRef && (
              <div className="overflow-x-auto mt-4 pt-4 border-t border-varistor-border animate-[fadeInPage_150ms_ease-out]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="pb-2 text-xs text-varistor-muted font-semibold w-32">Component</th>
                      <th className="pb-2 text-xs text-varistor-muted font-semibold">Formula</th>
                      <th className="pb-2 text-xs text-varistor-muted font-semibold w-16 text-center">Auto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-varistor-border">
                    {FORMULAS.map(row => (
                      <tr key={row.component} className="hover:bg-varistor-pageBg">
                        <td className="py-2 font-semibold text-varistor-dark">{row.component}</td>
                        <td className="py-2"><FormulaBadge formula={row.formula} /></td>
                        <td className="py-2 text-center"><CheckCircle2 size={14} className="text-varistor-lime inline" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Filter + Approve toolbar */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="text-sm border border-varistor-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-varistor-lime"
            >
              {departments.map(d => <option key={d}>{d}</option>)}
            </select>
            <span className="text-xs text-varistor-muted">{visible.length} employees shown</span>
            {selectedIds.size > 0 && <span className="text-xs font-semibold text-varistor-lime">{selectedIds.size} selected</span>}
            <div className="ml-auto">
              <button
                onClick={handleApprove}
                disabled={approving || selectedIds.size === 0}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${selectedIds.size > 0
                  ? 'bg-varistor-lime text-white hover:bg-[#65a30d] cursor-pointer'
                  : 'bg-varistor-limeLight text-varistor-muted border border-varistor-border cursor-not-allowed'
                  } disabled:opacity-60`}
              >
                {approving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {selectedIds.size > 0 ? `Approve ${selectedIds.size} Selected` : 'Approve Selected'}
              </button>
            </div>
          </div>

          {/* Main Table */}
          <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <RefreshCw size={20} className="animate-spin text-varistor-lime" />
                <span className="ml-2 text-sm text-varistor-muted">Loading payroll data…</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead className="bg-varistor-pageBg border-b border-varistor-border text-xs text-varistor-muted">
                    <tr>
                      <th className="px-4 py-3 w-10">
                        <button onClick={toggleAll}>
                          {selectedIds.size > 0 ? <CheckSquare size={15} className="text-varistor-lime" /> : <Square size={15} />}
                        </button>
                      </th>
                      {[
                        { key: 'employeeName', label: 'Employee' },
                        { key: 'designation', label: 'Designation' },
                        { key: 'ctc', label: 'Monthly CTC' },
                        { key: null, label: 'Gross Payable' },
                        { key: null, label: 'Basic' },
                        { key: null, label: 'HRA' },
                        { key: null, label: 'Medical' },
                        { key: null, label: 'TA' },
                        { key: null, label: 'LTA' },
                        { key: null, label: 'Special Allowance' },
                        { key: null, label: 'Overtime' },
                        { key: null, label: 'Reimbursement' },
                        { key: null, label: 'Incentives' },
                        { key: null, label: 'PF Employee' },
                        { key: null, label: 'PF Employer' },
                        { key: null, label: 'ESI' },
                        { key: null, label: 'PT' },
                        { key: 'deduction', label: 'Other Deductions' },
                        { key: 'lopDeduction', label: 'Loss of Pay' },
                        { key: null, label: 'Total Deductions' },
                        { key: null, label: 'Final Pay' },
                        { key: 'status', label: 'Status' },
                        { key: null, label: 'Actions' },
                      ].map((col, i) => (
                        <th
                          key={i}
                          onClick={() => col.key && toggleSort(col.key as keyof PayrollRecord)}
                          className={`px-4 py-3 text-left font-semibold uppercase tracking-wider ${col.key ? 'cursor-pointer select-none hover:text-varistor-dark' : ''}`}
                        >
                          <span className="flex items-center gap-1">
                            {col.label}
                            {col.key && <SortIcon field={col.key as keyof PayrollRecord} />}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-varistor-border">
                    {visible.map(rec => {
                      const isSelected = selectedIds.has(rec.id);
                      const isApproved = rec.status === 'approved';
                      return (
                        <tr key={rec.id} className={`transition-colors ${isSelected ? 'bg-varistor-limeLight' : 'hover:bg-varistor-pageBg'}`}>
                          <td className="px-4 py-3">
                            {!isApproved ? (
                              <button onClick={() => toggleSelect(rec.id)}>
                                {isSelected ? <CheckSquare size={15} className="text-varistor-lime" /> : <Square size={15} className="text-gray-300" />}
                              </button>
                            ) : (
                              <Lock size={13} className="text-gray-300 mx-auto" />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-varistor-dark">{rec.employeeName}</div>
                            <div className="text-[11px] text-varistor-muted">{rec.employeeId}</div>
                          </td>
                          <td className="px-4 py-3 text-varistor-muted">{rec.designation}</td>
                          {/* Monthly CTC */}
                          <td className="px-4 py-3">
                            {isAdmin && !isApproved ? (
                              <input
                                type="number"
                                defaultValue={rec.ctc}
                                onBlur={e => handleCTCChange(rec.id, e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                }}
                                className="w-28 border border-varistor-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-varistor-lime"
                              />
                            ) : (
                              <span className="font-mono text-xs">{fmt(rec.ctc)}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-xs font-mono font-semibold text-varistor-dark">
                            {fmt(rec.netPay)}
                          </td>
                          {(['basic', 'hra', 'medical', 'ta', 'lta'] as const).map(f => (
                            <td key={f} className="px-4 py-3">
                              <span className="font-mono text-xs text-varistor-muted" title={`Auto-calculated: ${f.toUpperCase()}`}>{fmt(rec.components[f])}</span>
                            </td>
                          ))}
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-varistor-muted" title="Balancing amount">
                              {fmt(rec.components.specialAllowance ?? 0)}
                            </span>
                          </td>
                          {(['overtime', 'reimbursement', 'incentives'] as const).map(f => (
                            <td key={f} className="px-4 py-3">
                              {isAdmin && !isApproved ? (
                                <input
                                  type="number"
                                  defaultValue={rec.components[f] ?? 0}
                                  onBlur={e => handleComponentChange(rec.id, f, e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') e.currentTarget.blur();
                                  }}
                                  className="w-20 border border-varistor-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-varistor-lime"
                                />
                              ) : (
                                <span className="font-mono text-xs">{fmt(rec.components[f] ?? 0)}</span>
                              )}
                            </td>
                          ))}
                          <td className="px-4 py-3 tabular-nums text-xs font-mono text-varistor-dark">
                            {fmt(rec.components.pfEmployee ?? 0)}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-xs font-mono text-varistor-dark">
                            {fmt(rec.components.pfEmployer ?? 0)}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-xs font-mono text-varistor-dark">
                            {fmt(rec.components.esi ?? 0)}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-xs font-mono text-varistor-dark">
                            {fmt(rec.components.pt ?? 0)}
                          </td>
                          <td className="px-4 py-3">
                            {isAdmin && !isApproved ? (
                              <input
                                key={rec.id}
                                type="number"
                                defaultValue={rec.deduction ?? 0}
                                onBlur={e => handleDeductionChange(rec.id, e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                }}
                                className="w-20 border border-varistor-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-varistor-lime"
                              />
                            ) : (
                              <span className="font-mono text-xs">{fmt(rec.deduction ?? 0)}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-xs font-mono text-red-600 font-semibold">
                            <div className="flex flex-col">
                              <span>{fmt(rec.lopDeduction ?? 0)}</span>
                              <span className="text-[10px] text-gray-400">({rec.lopDays ?? 0} {rec.lopDays === 1 ? 'day' : 'days'})</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 tabular-nums text-xs font-mono font-bold text-red-600">
                            {fmt((rec.components.pfEmployee ?? 0) + (rec.components.pfEmployer ?? 0) + (rec.components.esi ?? 0) + (rec.components.pt ?? 0) + (rec.deduction ?? 0) + (rec.lopDeduction ?? 0))}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-xs font-mono font-bold text-varistor-limeText">
                            {fmt(rec.finalPay ?? 0)}
                          </td>
                          <td className="px-4 py-3">
                            {isApproved ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-varistor-limeTint text-varistor-limeText text-[11px] font-semibold rounded-full">
                                <Lock size={10} /> Approved
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-50 text-yellow-700 text-[11px] font-semibold rounded-full border border-yellow-200">
                                <Unlock size={10} /> Draft
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button onClick={() => setPreviewRecord(rec)} className="p-1.5 rounded-lg hover:bg-varistor-limeLight text-varistor-muted hover:text-varistor-lime" title="Preview">
                                <Eye size={14} />
                              </button>
                              {isApproved && isAdmin && (
                                <button onClick={() => handleRevision(rec.id)} className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-400 hover:text-orange-600" title="New revision">
                                  <RefreshCw size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Employee Salary Slip Card (Inline View) ──────────────────────────────────

const SalarySlipCard: React.FC<{ record: PayrollRecord }> = ({ record }) => {
  const finalPay = record.finalPay ?? 0;
  const netPayWords = numberToWords(finalPay);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = record.components || {};
  const basic = c.basic ?? 0;
  const hra = c.hra ?? 0;
  const medical = c.medical ?? 1250;
  const ta = c.ta ?? 2500;
  const lta = c.lta ?? 3500;
  const specialAllowance = c.specialAllowance ?? 0;

  const pfEmployee = c.pfEmployee ?? 0;
  const pfEmployer = c.pfEmployer ?? 0;
  const esi = c.esi ?? 0;
  const pt = c.pt ?? 0;
  const otherDeductions = record.deduction ?? 0;
  const totalDeductions = pfEmployee + pfEmployer + esi + pt + otherDeductions + (record.lopDeduction ?? 0);

  const rawEarnings: { label: string; val: number }[] = [
    { label: 'Basic', val: basic },
    { label: 'HRA', val: hra },
    { label: 'Medical Allowance', val: medical },
    { label: 'TA', val: ta },
    { label: 'LTA', val: lta },
    { label: 'Special Allowance', val: specialAllowance },
    { label: 'Overtime', val: c.overtime ?? 0 },
    { label: 'Reimbursement', val: c.reimbursement ?? 0 },
    { label: 'Incentives', val: c.incentives ?? 0 },
  ];

  const rawDeductions: { label: string; val: number }[] = [
    { label: 'PF Employee', val: pfEmployee },
    { label: 'PF Employer', val: pfEmployer },
    { label: 'ESI', val: esi },
    { label: 'PT', val: pt },
    { label: 'Other Deductions', val: otherDeductions },
  ];

  const maxSlipRows = Math.max(rawEarnings.length, rawDeductions.length, 5);

  const earnings: { label: string; val: number | null }[] = [...rawEarnings];
  const deductions: { label: string; val: number | null }[] = [...rawDeductions];

  while (earnings.length < maxSlipRows) earnings.push({ label: '', val: null });
  while (deductions.length < maxSlipRows) deductions.push({ label: '', val: null });

  const finalTotalCtc = rawEarnings.reduce((a, b) => a + b.val, 0);
  const finalTotalDeductions = rawDeductions.reduce((a, b) => a + b.val, 0);

  return (
    <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-6 md:p-8 font-sans text-gray-900 leading-normal mb-6 print:hidden">
      {/* Header Banner */}
      <div className="text-center mb-4 relative pb-4 border-b border-gray-200">
        <div className="flex flex-col items-center justify-center gap-2 mb-1">
          <img src={logoUrl} alt="Varistor Logo" className="h-12 object-contain" />
          <h2 className="text-xl font-bold tracking-tight text-gray-900">Varistor Technologies Pvt. Ltd.</h2>
        </div>
        <p className="text-[10px] text-gray-500">No. F-1107, Block-1, First Floor Ardente Office One, Hoodi Circle, ITPL Main Rd, Bengaluru, Karnataka 560048</p>
        <p className="text-[10px] text-gray-500">Email - hr@varistor.in, Telephone - 080 4117 8911</p>
      </div>

      {/* Yellow Month Bar */}
      <div className="bg-[#fef08a] text-center py-1.5 font-bold text-xs text-gray-900 border border-yellow-300 rounded mb-4">
        Pay Slip for the Month of {record.month}
      </div>

      {/* Employee Details Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 border border-gray-300 rounded text-xs mb-4 divide-x divide-y divide-gray-300">
        <div className="p-2 font-bold bg-gray-50">Emp ID.</div>
        <div className="p-2">{record.employeeId || '—'}</div>
        <div className="p-2 font-bold bg-gray-50">Designation</div>
        <div className="p-2">{record.designation || 'WELDER'}</div>
        <div className="p-2 font-bold bg-gray-50 border-t-0">Employee Name</div>
        <div className="p-2 border-t-0">{record.employeeName}</div>
        <div className="p-2 font-bold bg-gray-50 border-t-0">Department</div>
        <div className="p-2 border-t-0">{record.department || '—'}</div>
        <div className="p-2 font-bold bg-gray-50 border-t-0">No. of Days</div>
        <div className="p-2 border-t-0">{record.totalDays ?? getDaysInMonth(record.month || MONTH)}</div>
        <div className="p-2 font-bold bg-gray-50 border-t-0">Paid No. of Days</div>
        <div className="p-2 border-t-0">{record.payDays ?? getDaysInMonth(record.month || MONTH)}</div>
        <div className="p-2 font-bold bg-gray-50 border-t-0">PF UAN No.</div>
        <div className="p-2 border-t-0">{record.pfUan || '—'}</div>
        <div className="p-2 font-bold bg-gray-50 border-t-0">CL Balance</div>
        <div className="p-2 border-t-0">{record.clBalance ?? 0}</div>
      </div>

      {/* Earnings & Deductions Table */}
      <table className="w-full text-xs border border-gray-300 border-collapse mb-4 divide-y divide-gray-300">
        <thead>
          <tr className="bg-blue-100 divide-x divide-gray-300 font-bold">
            <th className="p-2 text-left">Earnings</th>
            <th className="p-2 text-right w-24">Amount (Rs.)</th>
            <th className="p-2 text-left">Deductions</th>
            <th className="p-2 text-right w-24">Amount (Rs.)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {Array.from({ length: maxSlipRows }).map((_, idx) => {
            const earn = earnings[idx] || { label: '', val: null };
            const deduct = deductions[idx] || { label: '', val: null };
            return (
              <tr key={idx} className="divide-x divide-gray-300">
                <td className="p-2">{earn.label || <span className="opacity-0">—</span>}</td>
                <td className="p-2 text-right font-mono">
                  {earn.label && earn.val !== null && earn.val !== undefined ? fmt(earn.val) : ''}
                </td>
                <td className="p-2">{deduct.label || <span className="opacity-0">—</span>}</td>
                <td className="p-2 text-right font-mono">
                  {deduct.label && deduct.val !== null && deduct.val !== undefined ? fmt(deduct.val) : ''}
                </td>
              </tr>
            );
          })}
          <tr className="bg-gray-100 font-bold divide-x divide-gray-300 border-t border-gray-300">
            <td className="p-2">Total CTC</td>
            <td className="p-2 text-right font-mono">{fmt(finalTotalCtc)}</td>
            <td className="p-2">Total Deduction</td>
            <td className="p-2 text-right font-mono">{fmt(finalTotalDeductions)}</td>
          </tr>
        </tbody>
      </table>

      {/* Net Pay Block */}
      <div className="grid grid-cols-1 md:grid-cols-2 border border-gray-300 rounded overflow-hidden text-xs font-bold divide-y md:divide-y-0 md:divide-x divide-gray-300 mb-4">
        <div className="bg-green-50 p-3 flex justify-between items-center">
          <span className="text-gray-700">{record.deduction && record.deduction > 0 ? 'Final Pay [In-Hand]' : 'NetPay [In-Hand]'}</span>
          <span className="text-lg text-varistor-limeText font-black">{fmt(finalPay)}</span>
        </div>
        <div className="bg-gray-50 p-3 flex flex-col items-center justify-center text-center text-xs text-gray-700 leading-tight">
          {totalDeductions > 0 && (
            <span className="text-[10px] text-gray-400 mb-1">Total Earnings: {fmt(finalTotalCtc)} | Total Deductions: {fmt(finalTotalDeductions)}</span>
          )}
          <span>{netPayWords}</span>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-center font-semibold mt-2">
        This is a computer generated payslip no signature is required.
      </p>
    </div>
  );
};

// ─── Employee Salary Slip View ────────────────────────────────────────────────

const EmployeePayrollView: React.FC = () => {
  const { currentUser } = useVariPoints();
  const empId = currentUser?.id ?? 'VAR-003';
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PayrollRecord | null>(null);
  const [activeSlipTab, setActiveSlipTab] = useState<'summary' | 'detailed'>('detailed');

  useEffect(() => {
    getPayrollRecords(empId).then(data => { setRecords(data); setLoading(false); });
  }, [empId]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw size={20} className="animate-spin text-varistor-lime" />
      <span className="ml-2 text-sm text-varistor-muted">Loading your salary slips…</span>
    </div>
  );

  // Only show slips that HR has released
  const releasedRecords = records.filter(r => r.slipReleased);
  const hasUnreleased = records.length > 0 && releasedRecords.length === 0;
  const rec = releasedRecords[0];

  return (
    <div className="max-w-3xl mx-auto pb-20 animate-[fadeInPage_250ms_ease-out]">
      {selected && <SalarySlip record={selected} onClose={() => setSelected(null)} />}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-varistor-dark flex items-center gap-2">
            <FileText size={20} className="text-varistor-lime" /> My Salary Slips
          </h1>
          <p className="text-sm text-varistor-muted mt-0.5">Read-only · Showing your slips only · {MONTH}</p>
        </div>
        {rec && (
          <div className="flex border border-varistor-border rounded-lg overflow-hidden bg-white text-xs">
            <button
              onClick={() => setActiveSlipTab('detailed')}
              className={`px-3 py-2 font-semibold transition-colors ${activeSlipTab === 'detailed'
                ? 'bg-varistor-lime text-white'
                : 'text-varistor-muted hover:bg-varistor-pageBg'
                }`}
            >
              Detailed Slip
            </button>
            <button
              onClick={() => setActiveSlipTab('summary')}
              className={`px-3 py-2 font-semibold transition-colors ${activeSlipTab === 'summary'
                ? 'bg-varistor-lime text-white'
                : 'text-varistor-muted hover:bg-varistor-pageBg'
                }`}
            >
              Summary
            </button>
          </div>
        )}
      </div>

      {/* Current month not released yet */}
      {hasUnreleased && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-varistor p-6 mb-5 flex items-start gap-4">
          <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Clock size={20} className="text-yellow-600" />
          </div>
          <div>
            <p className="font-semibold text-yellow-800 text-sm">Salary slip not yet released</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              Your salary slip for <span className="font-semibold">{MONTH}</span> has been processed but not yet dispatched by HR.
              You will receive an email once it is released.
            </p>
          </div>
        </div>
      )}

      {!rec && !hasUnreleased ? (
        <div className="bg-white rounded-varistor border border-varistor-border p-10 text-center shadow-varistor">
          <AlertCircle size={32} className="text-varistor-muted mx-auto mb-3" />
          <p className="text-sm text-varistor-muted">No payroll records found for your account.</p>
        </div>
      ) : rec ? (
        <>
          {activeSlipTab === 'summary' ? (
            <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-6 mb-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-bold text-varistor-dark text-base">{rec.employeeName}</p>
                  <p className="text-xs text-varistor-muted">{rec.employeeId} · {rec.department}</p>
                </div>
                {rec.status === 'approved'
                  ? <span className="flex items-center gap-1 text-xs font-semibold bg-varistor-limeTint text-varistor-limeText px-3 py-1.5 rounded-full"><ShieldCheck size={12} /> Approved</span>
                  : <span className="flex items-center gap-1 text-xs font-semibold bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-full border border-yellow-200"><Clock size={12} /> Pending</span>
                }
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Monthly CTC', val: fmt(rec.ctc) },
                  { label: 'Net Pay', val: fmt(rec.finalPay ?? rec.netPay), highlight: true },
                  { label: 'Basic', val: fmt(rec.components.basic) },
                  { label: 'HRA', val: fmt(rec.components.hra) },
                  { label: 'PF Deduction', val: fmt(rec.components.pfEmployee), deduct: true },
                  { label: 'TDS Deduction', val: fmt(rec.components.tds), deduct: true },
                ].map(item => (
                  <div key={item.label} className={`rounded-lg p-3 border ${item.highlight ? 'bg-varistor-limeLight border-varistor-lime' : 'bg-varistor-pageBg border-varistor-border'}`}>
                    <p className="text-[11px] text-varistor-muted">{item.label}</p>
                    <p className={`font-bold mt-0.5 tabular-nums ${item.deduct ? 'text-red-600' : item.highlight ? 'text-varistor-limeText text-lg' : 'text-varistor-dark text-sm'}`}>{item.val}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="relative">
              {/* Floating Print Button for Detailed Inline Slip */}
              <div className="absolute right-4 top-4 z-10 flex gap-2">
                <button
                  onClick={() => setSelected(rec)}
                  className="flex items-center gap-1 bg-white border border-varistor-border px-3 py-1.5 text-xs font-semibold rounded shadow-sm hover:bg-varistor-pageBg text-varistor-dark transition-colors"
                >
                  <Eye size={12} /> Fullscreen Print View
                </button>
              </div>
              <SalarySlipCard record={rec} />
            </div>
          )}

          <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor overflow-hidden">
            <div className="px-5 py-4 border-b border-varistor-border flex items-center justify-between">
              <p className="font-semibold text-varistor-dark text-sm">Available Slips</p>
              <span className="text-xs text-varistor-muted">{releasedRecords.length} slip{releasedRecords.length !== 1 ? 's' : ''}</span>
            </div>
            {releasedRecords.map(r => (
              <div key={r.id} className="flex items-center justify-between px-5 py-4 border-b border-varistor-border last:border-0 hover:bg-varistor-pageBg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-varistor-limeLight rounded-lg flex items-center justify-center">
                    <FileText size={16} className="text-varistor-lime" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-varistor-dark">Salary Slip · {r.month}</p>
                    <p className="text-[11px] text-varistor-muted">Net: {fmt(r.finalPay ?? r.netPay)} · Rev {r.revision}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelected(r)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-varistor-lime text-white text-xs font-semibold rounded-lg hover:bg-[#65a30d] transition-colors"
                >
                  <Eye size={12} /> View / Download
                </button>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-varistor-muted text-center mt-4">✉ Slip scheduled auto-dispatch config details in Admin console.</p>
        </>
      ) : null}
    </div>
  );
};

// ─── Root ──────────────────────────────────────────────────────────────────────

const Payroll: React.FC = () => {
  const { currentRole } = useVariPoints();
  return (currentRole === 'Admin' || currentRole === 'HR') ? <SalaryEngine /> : <EmployeePayrollView />;
};

export default Payroll;
