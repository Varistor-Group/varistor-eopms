import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DollarSign, CheckSquare, Square, ChevronDown, ChevronUp,
  RefreshCw, ShieldCheck, AlertCircle,
  FileText, Users, Lock, Unlock, Clock, Eye, Printer,
  TrendingUp, BarChart3, CheckCircle2, Send, Trash2,
  FileSpreadsheet, ArrowRight, X, Mail, AlertTriangle
} from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';
import {
  getPayrollRecords,
  updatePayrollRecord,
  approvePayroll,
  createRevision,
  applyFormulaToAll,
  payrollAuditLog,
  sendBulkSlips,
  type PayrollRecord,
  type SlipRow,
  type BulkSendResult
} from '../api/payroll';

// xlsx is loaded via CDN-style dynamic import to avoid bundler issues
// We import the type only; actual lib loaded at runtime
// eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
declare const XLSX: any;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const MONTH = 'Jun 2026';
const LOGGED_IN_EMP = 'VAR-024';

// Column name aliases — tolerant parsing of Excel headers
const COL_ALIASES: Record<string, string[]> = {
  name:         ['name', 'full name', 'employee name', 'emp name', 'fullname'],
  email:        ['email', 'email id', 'mail', 'email address', 'e-mail'],
  ctc:          ['ctc', 'monthly ctc', 'gross', 'gross salary', 'total ctc'],
  deductions:   ['deductions', 'total deductions', 'deductibles', 'total deductibles', 'deduction'],
  employeeId:   ['employee id', 'emp id', 'id', 'employee_id', 'empid', 'var id'],
  department:   ['department', 'dept', 'division'],
  month:        ['month', 'pay month', 'salary month'],
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
  <span className="font-mono text-[10px] bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0] px-1.5 py-0.5 rounded">
    {formula}
  </span>
);

// ─── Salary Slip Preview Modal ─────────────────────────────────────────────────

const SalarySlip: React.FC<{ record: PayrollRecord; onClose?: () => void }> = ({ record, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" id="salary-slip-overlay">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" id="salary-slip-card">
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
        <div className="p-8 font-sans">
          <div className="bg-varistor-lime rounded-xl px-6 py-4 mb-6 flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-lg tracking-wide uppercase">VARISTOR TECHNOLOGIES PVT LTD</p>
              <p className="text-lime-900 text-sm font-medium mt-0.5">Salary Slip · {record.month}</p>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-white font-black text-xl">V</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            {[['Employee', record.employeeName], ['ID', record.employeeId], ['Dept', record.department], ['CTC', fmt(record.ctc * 12)]].map(([l, v]) => (
              <div key={l} className="flex gap-2">
                <span className="text-gray-500 w-24 flex-shrink-0">{l}</span>
                <span className="font-semibold text-gray-900">{v}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Earnings</p>
              {[['Basic', record.components.basic], ['HRA', record.components.hra], ['Special Allowance', record.components.specialAllowance]].map(([l, v]) => (
                <div key={String(l)} className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">{l}</span>
                  <span className="font-medium tabular-nums">{fmt(Number(v))}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Deductions</p>
              {[['PF', record.components.pf], ['TDS', record.components.tds]].map(([l, v]) => (
                <div key={String(l)} className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">{l}</span>
                  <span className="font-medium text-red-600 tabular-nums">{fmt(Number(v))}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-[#f7fee7] border border-[#d9f99d] rounded-xl px-6 py-4 flex items-center justify-between">
            <span className="font-bold text-gray-700">Net Pay</span>
            <span className="font-black text-2xl text-varistor-limeText tabular-nums">{fmt(record.netPay)}</span>
          </div>
          <p className="text-[11px] text-gray-400 mt-4 text-center">✉ Auto-mailed on 15 {record.month} · 10:00 IST</p>
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
      const missingRequired = ['name', 'email', 'ctc'].filter(r => !headers.includes(r));
      if (missingRequired.length > 0) {
        setParseError(`Missing required columns: ${missingRequired.join(', ')}. Check your header row matches: Name, Email, CTC, Deductions.`);
        return;
      }

      const parsed: SlipRow[] = [];
      for (let i = 1; i < raw.length; i++) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const row = raw[i] as any[];
        if (row.every(cell => String(cell).trim() === '')) continue; // skip blank rows
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj: any = {};
        headers.forEach((key, idx) => { if (key) obj[key] = row[idx]; });
        const ctc = parseNumber(obj.ctc);
        const deductions = parseNumber(obj.deductions ?? 0);
        parsed.push({
          name: String(obj.name || '').trim(),
          email: String(obj.email || '').trim(),
          employeeId: obj.employeeId ? String(obj.employeeId).trim() : undefined,
          department: obj.department ? String(obj.department).trim() : undefined,
          month: obj.month ? String(obj.month).trim() : MONTH,
          ctc,
          deductions,
          netPay: ctc - deductions,
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
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                isDragging
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
                    {['#', 'Name', 'Email', 'Dept', 'CTC', 'Deductions', 'Net Pay', 'Month', ''].map(h => (
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
                        <td className="px-4 py-2.5 text-varistor-muted text-xs">{row.department || '—'}</td>
                        <td className="px-4 py-2.5 tabular-nums text-xs font-mono">{fmt(row.ctc)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-xs font-mono text-red-600">{fmt(row.deductions)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-xs font-bold text-varistor-limeText">{fmt(row.netPay)}</td>
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

// ─── Admin Salary Engine ──────────────────────────────────────────────────────

const FORMULAS = [
  { component: 'Basic', formula: '= CTC * 0.6', auto: true },
  { component: 'HRA', formula: '= Basic * 0.4', auto: true },
  { component: 'PF', formula: '= Basic * 0.12', auto: true },
  { component: 'TDS', formula: '= slab(Gross)', auto: true },
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

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getPayrollRecords();
    setRecords(data);
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const departments = ['All', ...Array.from(new Set(records.map(r => r.department)))];

  const visible = records
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
    if (isNaN(ctc)) return;
    const updated = await updatePayrollRecord(id, { ctc });
    if (updated) setRecords(prev => prev.map(r => r.id === id ? updated : r));
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
    await applyFormulaToAll();
    await load();
    setApplyingAll(false);
  };

  const handleRevision = async (id: string) => {
    await createRevision(id, 'hr@varistor.in');
    await load();
  };

  const draftCount = records.filter(r => r.status === 'draft').length;
  const approvedCount = records.filter(r => r.status === 'approved').length;
  const totalNetPay = records.reduce((s, r) => s + r.netPay, 0);

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
                        <p className="text-gray-500 text-xs">{entry.by} · Net: {fmt(entry.netPay)}</p>
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
          <p className="text-sm text-varistor-muted mt-0.5">Excel-driven formula engine · {MONTH} · {records.length} employees</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowUploadPanel(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-lg transition-colors border ${
              showUploadPanel
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
          {selectedIds.size > 0 && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-varistor-lime text-white rounded-lg hover:bg-[#65a30d] transition-colors disabled:opacity-60"
            >
              {approving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Approve {selectedIds.size} Selected
            </button>
          )}
        </div>
      </div>

      {/* Excel Upload Panel */}
      {showUploadPanel && (
        <ExcelUploadPanel onClose={() => setShowUploadPanel(false)} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Employees', val: records.length, icon: Users, color: 'text-blue-500' },
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
      <div className="bg-white rounded-varistor border border-varistor-border p-5 mb-6 shadow-varistor">
        <p className="text-xs font-bold text-varistor-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <BarChart3 size={13} /> Payroll Formulas (Excel-driven)
        </p>
        <div className="overflow-x-auto">
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
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <select
          value={filterDept}
          onChange={e => setFilterDept(e.target.value)}
          className="text-sm border border-varistor-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-varistor-lime"
        >
          {departments.map(d => <option key={d}>{d}</option>)}
        </select>
        <span className="text-xs text-varistor-muted">{visible.length} employees shown</span>
        {selectedIds.size > 0 && <span className="text-xs font-semibold text-varistor-lime">{selectedIds.size} selected</span>}
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
                    { key: 'department', label: 'Dept' },
                    { key: 'ctc', label: 'Monthly CTC' },
                    { key: null, label: 'Basic' },
                    { key: null, label: 'HRA' },
                    { key: null, label: 'PF' },
                    { key: null, label: 'TDS' },
                    { key: 'netPay', label: 'Net Pay' },
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
                      <td className="px-4 py-3 text-varistor-muted">{rec.department}</td>
                      <td className="px-4 py-3">
                        {isAdmin && !isApproved ? (
                          <input
                            type="number"
                            defaultValue={rec.ctc}
                            onBlur={e => handleCTCChange(rec.id, e.target.value)}
                            className="w-28 border border-varistor-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-varistor-lime"
                          />
                        ) : (
                          <span className="font-mono text-xs">{fmt(rec.ctc)}</span>
                        )}
                      </td>
                      {(['basic', 'hra', 'pf', 'tds'] as const).map(f => (
                        <td key={f} className="px-4 py-3 tabular-nums text-xs font-mono text-varistor-dark">{fmt(rec.components[f])}</td>
                      ))}
                      <td className="px-4 py-3"><span className="font-bold text-varistor-limeText tabular-nums">{fmt(rec.netPay)}</span></td>
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
    </div>
  );
};

// ─── Employee Salary Slip View ────────────────────────────────────────────────

const EmployeePayrollView: React.FC = () => {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PayrollRecord | null>(null);

  useEffect(() => {
    getPayrollRecords(LOGGED_IN_EMP).then(data => { setRecords(data); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw size={20} className="animate-spin text-varistor-lime" />
      <span className="ml-2 text-sm text-varistor-muted">Loading your salary slips…</span>
    </div>
  );

  const rec = records[0];

  return (
    <div className="max-w-2xl mx-auto pb-20 animate-[fadeInPage_250ms_ease-out]">
      {selected && <SalarySlip record={selected} onClose={() => setSelected(null)} />}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-varistor-dark flex items-center gap-2">
          <FileText size={20} className="text-varistor-lime" /> My Salary Slips
        </h1>
        <p className="text-sm text-varistor-muted mt-0.5">Read-only · Showing your slips only · {MONTH}</p>
      </div>

      {!rec ? (
        <div className="bg-white rounded-varistor border border-varistor-border p-10 text-center shadow-varistor">
          <AlertCircle size={32} className="text-varistor-muted mx-auto mb-3" />
          <p className="text-sm text-varistor-muted">No payroll records found for your account.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-6 mb-5">
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
                { label: 'Net Pay', val: fmt(rec.netPay), highlight: true },
                { label: 'Basic', val: fmt(rec.components.basic) },
                { label: 'HRA', val: fmt(rec.components.hra) },
                { label: 'PF Deduction', val: fmt(rec.components.pf), deduct: true },
                { label: 'TDS Deduction', val: fmt(rec.components.tds), deduct: true },
              ].map(item => (
                <div key={item.label} className={`rounded-lg p-3 border ${item.highlight ? 'bg-varistor-limeLight border-varistor-lime' : 'bg-varistor-pageBg border-varistor-border'}`}>
                  <p className="text-[11px] text-varistor-muted">{item.label}</p>
                  <p className={`font-bold mt-0.5 tabular-nums ${item.deduct ? 'text-red-600' : item.highlight ? 'text-varistor-limeText text-lg' : 'text-varistor-dark text-sm'}`}>{item.val}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor overflow-hidden">
            <div className="px-5 py-4 border-b border-varistor-border flex items-center justify-between">
              <p className="font-semibold text-varistor-dark text-sm">Available Slips</p>
              <span className="text-xs text-varistor-muted">{records.length} slip{records.length !== 1 ? 's' : ''}</span>
            </div>
            {records.map(r => (
              <div key={r.id} className="flex items-center justify-between px-5 py-4 border-b border-varistor-border last:border-0 hover:bg-varistor-pageBg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-varistor-limeLight rounded-lg flex items-center justify-center">
                    <FileText size={16} className="text-varistor-lime" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-varistor-dark">Salary Slip · {r.month}</p>
                    <p className="text-[11px] text-varistor-muted">Net: {fmt(r.netPay)} · Rev {r.revision}</p>
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
          <p className="text-[11px] text-varistor-muted text-center mt-4">✉ Slip auto-mailed on 15th of each month · 10:00 IST via cron + Resend</p>
        </>
      )}
    </div>
  );
};

// ─── Root ──────────────────────────────────────────────────────────────────────

const Payroll: React.FC = () => {
  const { currentRole } = useVariPoints();
  return (currentRole === 'Admin' || currentRole === 'HR') ? <SalaryEngine /> : <EmployeePayrollView />;
};

export default Payroll;
