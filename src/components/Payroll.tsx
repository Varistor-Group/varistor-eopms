import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DollarSign, CheckSquare, Square, ChevronDown, ChevronUp,
  Download, Upload, RefreshCw, ShieldCheck, AlertCircle,
  FileText, Users, Lock, Unlock, Clock, Eye, Printer,
  TrendingUp, BarChart3, CheckCircle2
} from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';
import {
  getPayrollRecords,
  updatePayrollRecord,
  approvePayroll,
  createRevision,
  applyFormulaToAll,
  payrollAuditLog,
  computeNet,
  type PayrollRecord
} from '../api/payroll';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

const MONTH = 'Jun 2026';
const LOGGED_IN_EMP = 'VAR-024'; // Mock current user

// ─── Formula Badge ────────────────────────────────────────────────────────────

const FormulaBadge = ({ formula }: { formula: string }) => (
  <span className="font-mono text-[10px] bg-[#f0fdf4] text-[#15803d] border border-[#bbf7d0] px-1.5 py-0.5 rounded">
    {formula}
  </span>
);

// ─── Salary Slip (Employee / Admin preview) ───────────────────────────────────

const SalarySlip: React.FC<{ record: PayrollRecord; onClose?: () => void }> = ({ record, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" id="salary-slip-overlay">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto print:shadow-none print:rounded-none print:max-h-none print:overflow-visible" id="salary-slip-card">
        {/* Print action bar (hidden in print) */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 print:hidden">
          <span className="text-sm font-semibold text-gray-500">Salary Slip Preview</span>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-varistor-lime text-white text-sm font-semibold rounded-lg hover:bg-[#65a30d] transition-colors"
            >
              <Printer size={15} /> Print / Download PDF
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Slip body */}
        <div className="p-8 print:p-10 font-sans" id="slip-printable">
          {/* Lime header strip */}
          <div className="bg-varistor-lime rounded-xl px-6 py-4 mb-6 flex items-center justify-between print:rounded-none print:-mx-10 print:px-10">
            <div>
              <p className="text-white font-bold text-lg tracking-wide uppercase">VARISTOR TECHNOLOGIES PVT LTD</p>
              <p className="text-lime-900 text-sm font-medium mt-0.5">Salary Slip · {record.month}</p>
            </div>
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-white font-black text-xl">V</span>
            </div>
          </div>

          {/* Employee info */}
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div className="space-y-2">
              <div className="flex gap-2">
                <span className="text-gray-500 w-24 flex-shrink-0">Employee</span>
                <span className="font-semibold text-gray-900">{record.employeeName}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 w-24 flex-shrink-0">ID</span>
                <span className="font-semibold text-gray-900">{record.employeeId}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 w-24 flex-shrink-0">Dept</span>
                <span className="font-semibold text-gray-900">{record.department}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 w-24 flex-shrink-0">CTC</span>
                <span className="font-semibold text-gray-900">{fmt(record.ctc * 12)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <span className="text-gray-500 w-24 flex-shrink-0">Month</span>
                <span className="font-semibold text-gray-900">{record.month}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-500 w-24 flex-shrink-0">Status</span>
                <span className={`font-semibold text-xs px-2 py-0.5 rounded-full ${record.status === 'approved' ? 'bg-varistor-limeTint text-varistor-limeText' : 'bg-yellow-100 text-yellow-800'}`}>
                  {record.status === 'approved' ? '✓ Approved' : 'Draft'}
                </span>
              </div>
              {record.approvedBy && (
                <div className="flex gap-2">
                  <span className="text-gray-500 w-24 flex-shrink-0">Approved by</span>
                  <span className="font-semibold text-gray-900 text-xs">{record.approvedBy}</span>
                </div>
              )}
            </div>
          </div>

          {/* Earnings / Deductions */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Earnings</p>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Basic', val: record.components.basic },
                  { label: 'HRA', val: record.components.hra },
                  { label: 'Special Allowance', val: record.components.specialAllowance },
                ].map(row => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-gray-600">{row.label}</span>
                    <span className="font-medium text-gray-900 tabular-nums">{fmt(row.val)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Deductions</p>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'PF', val: record.components.pf },
                  { label: 'TDS', val: record.components.tds },
                ].map(row => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-gray-600">{row.label}</span>
                    <span className="font-medium text-red-600 tabular-nums">{fmt(row.val)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Net Pay */}
          <div className="bg-[#f7fee7] border border-[#d9f99d] rounded-xl px-6 py-4 flex items-center justify-between">
            <span className="font-bold text-gray-700 text-base">Net Pay</span>
            <span className="font-black text-2xl text-varistor-limeText tabular-nums">{fmt(record.netPay)}</span>
          </div>

          {/* Auto-mail notice */}
          <p className="text-[11px] text-gray-400 mt-4 text-center">
            ✉ Auto-mailed on 15 {record.month} · 10:00 IST via scheduled cron
          </p>
        </div>
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
  const [uploadMsg, setUploadMsg] = useState('');
  const [sortField, setSortField] = useState<keyof PayrollRecord>('employeeName');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterDept, setFilterDept] = useState('All');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getPayrollRecords();
    setRecords(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const departments = ['All', ...Array.from(new Set(records.map(r => r.department)))];

  const visible = records
    .filter(r => filterDept === 'All' || r.department === filterDept)
    .sort((a, b) => {
      const av = a[sortField] as any;
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
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === visible.filter(r => r.status === 'draft').length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visible.filter(r => r.status === 'draft').map(r => r.id)));
    }
  };

  const handleCTCChange = async (id: string, value: string) => {
    const ctc = parseInt(value.replace(/,/g, ''), 10);
    if (isNaN(ctc)) return;
    const updated = await updatePayrollRecord(id, { ctc });
    if (updated) {
      setRecords(prev => prev.map(r => r.id === id ? updated : r));
    }
  };

  const handleApprove = async () => {
    const draftSelected = [...selectedIds].filter(id => {
      const r = records.find(r => r.id === id);
      return r?.status === 'draft';
    });
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

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadMsg(`Template "${file.name}" uploaded — formulas synced.`);
      setTimeout(() => setUploadMsg(''), 4000);
    }
    e.target.value = '';
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
      {/* Preview Modal */}
      {previewRecord && (
        <SalarySlip record={previewRecord} onClose={() => setPreviewRecord(null)} />
      )}

      {/* Audit Modal */}
      {showAudit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-900">Payroll Audit Log</h3>
              <button onClick={() => setShowAudit(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="p-6 space-y-3">
              {payrollAuditLog.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">No audit entries yet.</p>
              ) : (
                payrollAuditLog.slice().reverse().map((entry, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                    <ShieldCheck size={16} className="text-varistor-lime mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-800">{entry.action} · {entry.employeeId}</p>
                      <p className="text-gray-500 text-xs">{entry.by} · Net: {fmt(entry.netPay)}</p>
                      <p className="text-gray-400 text-[11px]">{new Date(entry.timestamp).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                ))
              )}
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
          <input ref={fileInputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={onFileSelected} />
          <button
            onClick={handleUpload}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-varistor-border rounded-lg hover:bg-varistor-limeLight transition-colors text-varistor-dark"
          >
            <Upload size={14} /> Upload xlsx template
          </button>
          <button
            onClick={handleApplyAll}
            disabled={applyingAll}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-varistor-border rounded-lg hover:bg-varistor-limeLight transition-colors text-varistor-dark disabled:opacity-50"
          >
            {applyingAll ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Apply to all employees
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

      {/* Upload success notice */}
      {uploadMsg && (
        <div className="mb-4 px-4 py-3 bg-[#f0fdf4] border border-[#bbf7d0] rounded-lg text-sm text-[#15803d] flex items-center gap-2">
          <CheckCircle2 size={15} /> {uploadMsg}
          <span className="ml-auto text-xs text-gray-400">· Cron: 15th of each month · 10:00 IST · auto-email slip</span>
        </div>
      )}

      {/* Stats bar */}
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

      {/* Formula Reference Card */}
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
                  <td className="py-2 text-center">
                    <CheckCircle2 size={14} className="text-varistor-lime inline" />
                  </td>
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
        {selectedIds.size > 0 && (
          <span className="text-xs font-semibold text-varistor-lime">{selectedIds.size} selected for approval</span>
        )}
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
                    <button onClick={toggleAll} className="text-varistor-muted hover:text-varistor-lime">
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
                    <tr
                      key={rec.id}
                      className={`transition-colors ${isSelected ? 'bg-varistor-limeLight' : 'hover:bg-varistor-pageBg'} ${isApproved ? 'opacity-80' : ''}`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3">
                        {!isApproved ? (
                          <button onClick={() => toggleSelect(rec.id)}>
                            {isSelected
                              ? <CheckSquare size={15} className="text-varistor-lime" />
                              : <Square size={15} className="text-gray-300" />
                            }
                          </button>
                        ) : (
                          <Lock size={13} className="text-gray-300 mx-auto" />
                        )}
                      </td>
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-varistor-dark">{rec.employeeName}</div>
                        <div className="text-[11px] text-varistor-muted">{rec.employeeId}</div>
                      </td>
                      {/* Dept */}
                      <td className="px-4 py-3 text-varistor-muted">{rec.department}</td>
                      {/* CTC (editable if draft & Admin) */}
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
                      {/* Formula cells */}
                      {(['basic', 'hra', 'pf', 'tds'] as const).map(field => (
                        <td key={field} className="px-4 py-3 tabular-nums text-xs font-mono text-varistor-dark">
                          {fmt(rec.components[field])}
                        </td>
                      ))}
                      {/* Net Pay */}
                      <td className="px-4 py-3">
                        <span className="font-bold text-varistor-limeText tabular-nums">{fmt(rec.netPay)}</span>
                      </td>
                      {/* Status */}
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
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setPreviewRecord(rec)}
                            className="p-1.5 rounded-lg hover:bg-varistor-limeLight text-varistor-muted hover:text-varistor-lime transition-colors"
                            title="Preview Slip"
                          >
                            <Eye size={14} />
                          </button>
                          {isApproved && isAdmin && (
                            <button
                              onClick={() => handleRevision(rec.id)}
                              className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-400 hover:text-orange-600 transition-colors"
                              title="Create new revision"
                            >
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
    getPayrollRecords(LOGGED_IN_EMP).then(data => {
      setRecords(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw size={20} className="animate-spin text-varistor-lime" />
        <span className="ml-2 text-sm text-varistor-muted">Loading your salary slips…</span>
      </div>
    );
  }

  const rec = records[0];

  return (
    <div className="max-w-2xl mx-auto pb-20 animate-[fadeInPage_250ms_ease-out]">
      {selected && <SalarySlip record={selected} onClose={() => setSelected(null)} />}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-varistor-dark flex items-center gap-2">
          <FileText size={20} className="text-varistor-lime" />
          My Salary Slips
        </h1>
        <p className="text-sm text-varistor-muted mt-0.5">
          Read-only · Showing your slips only · {MONTH}
        </p>
      </div>

      {!rec ? (
        <div className="bg-white rounded-varistor border border-varistor-border p-10 text-center shadow-varistor">
          <AlertCircle size={32} className="text-varistor-muted mx-auto mb-3" />
          <p className="text-sm text-varistor-muted">No payroll records found for your account.</p>
        </div>
      ) : (
        <>
          {/* Quick summary card */}
          <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-6 mb-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="font-bold text-varistor-dark text-base">{rec.employeeName}</p>
                <p className="text-xs text-varistor-muted">{rec.employeeId} · {rec.department}</p>
              </div>
              {rec.status === 'approved' ? (
                <span className="flex items-center gap-1 text-xs font-semibold bg-varistor-limeTint text-varistor-limeText px-3 py-1.5 rounded-full">
                  <ShieldCheck size={12} /> Approved
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-semibold bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-full border border-yellow-200">
                  <Clock size={12} /> Pending Approval
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Monthly CTC', val: fmt(rec.ctc), sub: '' },
                { label: 'Net Pay', val: fmt(rec.netPay), sub: 'After deductions', highlight: true },
                { label: 'Basic', val: fmt(rec.components.basic), sub: '60% of CTC' },
                { label: 'HRA', val: fmt(rec.components.hra), sub: '40% of Basic' },
                { label: 'PF Deduction', val: fmt(rec.components.pf), sub: '12% of Basic', deduct: true },
                { label: 'TDS Deduction', val: fmt(rec.components.tds), sub: 'Tax slab', deduct: true },
              ].map(item => (
                <div
                  key={item.label}
                  className={`rounded-lg p-3 border ${item.highlight ? 'bg-varistor-limeLight border-varistor-lime' : 'bg-varistor-pageBg border-varistor-border'}`}
                >
                  <p className="text-[11px] text-varistor-muted">{item.label}</p>
                  <p className={`font-bold mt-0.5 tabular-nums ${item.deduct ? 'text-red-600' : item.highlight ? 'text-varistor-limeText text-lg' : 'text-varistor-dark text-sm'}`}>
                    {item.val}
                  </p>
                  {item.sub && <p className="text-[10px] text-varistor-muted mt-0.5">{item.sub}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Slips list */}
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
                <div className="flex items-center gap-2">
                  {r.status === 'approved'
                    ? <Lock size={12} className="text-varistor-lime" />
                    : <Clock size={12} className="text-yellow-500" />
                  }
                  <button
                    onClick={() => setSelected(r)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-varistor-lime text-white text-xs font-semibold rounded-lg hover:bg-[#65a30d] transition-colors"
                  >
                    <Download size={12} /> View / Download
                  </button>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-varistor-muted text-center mt-4">
            ✉ Slip auto-mailed on 15th of each month · 10:00 IST via cron + Resend
          </p>
        </>
      )}
    </div>
  );
};

// ─── Root Payroll Component ───────────────────────────────────────────────────

const Payroll: React.FC = () => {
  const { currentRole } = useVariPoints();
  const isAdminOrHR = currentRole === 'Admin' || currentRole === 'HR';
  return isAdminOrHR ? <SalaryEngine /> : <EmployeePayrollView />;
};

export default Payroll;
