import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, History, TrendingDown, TrendingUp, Clock, User, RefreshCw } from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';
import { mockEmployeeStore } from '../api/employees';
import { supabase } from '../lib/supabase';

interface VPLogEntry {
  id: string;
  created_at: string;
  details: string;
  performed_by: string;
  metadata: {
    transaction_type: 'credit' | 'debit';
    rule_type: string;
    points: number;
    reason: string;
    employee_name: string;
    employee_code: string;
    performed_by_name: string;
    performed_by_role: string;
    vp_before: number;
    vp_after: number;
  } | null;
}

export const EngineSimulationConsole: React.FC = () => {
  const { currentRole, assertAdministrativeTransaction } = useVariPoints();
  const [transactionMode, setTransactionMode] = useState<'debit' | 'credit'>('debit');
  const [transactionType, setTransactionType] = useState<'misconduct' | 'late_entry' | 'custom_debit' | 'custom_credit'>('misconduct');
  const [reason, setReason] = useState('');
  const [customPoints, setCustomPoints] = useState<number | ''>('');
  const [employeeId, setEmployeeId] = useState('');

  // History state
  const [history, setHistory] = useState<VPLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'console' | 'history'>('console');

  const hasAccess = currentRole === 'Admin' || currentRole === 'HR';

  const fetchHistory = async () => {
    setHistoryLoading(true);
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('action', 'VP_TRANSACTION')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!error && data) {
      setHistory(data as VPLogEntry[]);
    }
    setHistoryLoading(false);
  };

  useEffect(() => {
    if (hasAccess) fetchHistory();
  }, [hasAccess]);

  const handleAssertTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || !employeeId) return;

    const isCustom = transactionType === 'custom_debit' || transactionType === 'custom_credit';
    const pointsToApply = isCustom ? Number(customPoints) : undefined;
    if (isCustom && (!pointsToApply || pointsToApply <= 0)) return;

    assertAdministrativeTransaction(transactionType, reason.trim(), pointsToApply, employeeId);
    setReason('');
    setCustomPoints('');
    setEmployeeId('');

    // Refresh history after a short delay to allow Supabase insert to complete
    setTimeout(() => fetchHistory(), 1000);
  };

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-varistor-surface rounded-varistor border border-varistor-dangerBorder shadow-sm">
        <div className="text-red-500 font-bold text-6xl mb-4">403</div>
        <h2 className="text-xl font-bold text-varistor-dark">Forbidden Access</h2>
        <p className="text-sm text-varistor-muted mt-2 text-center max-w-sm">You do not have the required permissions to view the Engine Simulation Console.</p>
      </div>
    );
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  return (
    <div className="space-y-6 animate-[fadeInPage_250ms_ease-out]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-varistor-dark">VP Management Console</h1>
          <p className="text-xs text-varistor-muted mt-0.5">Administrative tools for testing and asserting manual Vari Points transactions.</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-varistor-surfaceMuted rounded-lg p-1 w-fit border border-varistor-border">
        <button
          onClick={() => setActiveTab('console')}
          className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${activeTab === 'console' ? 'bg-varistor-surface shadow-sm text-varistor-dark border border-varistor-border' : 'text-varistor-muted hover:text-varistor-dark'}`}
        >
          <ShieldAlert size={13} /> Console
        </button>
        <button
          onClick={() => { setActiveTab('history'); fetchHistory(); }}
          className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${activeTab === 'history' ? 'bg-varistor-surface shadow-sm text-varistor-dark border border-varistor-border' : 'text-varistor-muted hover:text-varistor-dark'}`}
        >
          <History size={13} /> Transaction History
          {history.length > 0 && (
            <span className="ml-1 bg-varistor-lime text-varistor-limeText text-[9px] font-bold px-1.5 py-0.5 rounded-full">{history.length}</span>
          )}
        </button>
      </div>

      {/* ── CONSOLE TAB ── */}
      {activeTab === 'console' && (
        <div className="bg-varistor-surface rounded-varistor border border-varistor-border shadow-varistor max-w-3xl overflow-hidden">
          {/* Toggle Mode */}
          <div className="px-6 py-4 border-b border-varistor-border flex justify-between items-center bg-gray-50/50">
            <div className="flex bg-white rounded-lg p-1 border border-varistor-border shadow-sm">
              <button
                type="button"
                onClick={() => { setTransactionMode('debit'); setTransactionType('misconduct'); setCustomPoints(''); setReason(''); }}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${transactionMode === 'debit' ? 'bg-red-50 text-red-600 shadow-sm border border-red-100' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Debit (Penalty)
              </button>
              <button
                type="button"
                onClick={() => { setTransactionMode('credit'); setTransactionType('custom_credit'); setCustomPoints(''); setReason(''); }}
                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${transactionMode === 'credit' ? 'bg-green-50 text-green-600 shadow-sm border border-green-100' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Credit (Reward)
              </button>
            </div>
          </div>

          <div className="px-6 py-5 border-b border-varistor-border">
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} className={transactionMode === 'debit' ? "text-varistor-dangerText animate-pulse" : "text-varistor-limeText"} />
              <h3 className="text-sm font-bold text-varistor-dark uppercase tracking-wider">{transactionMode === 'debit' ? 'Debit Points Adjustment' : 'Credit Points Adjustment'}</h3>
            </div>
            <p className="text-xs text-varistor-muted mt-2">
              {transactionMode === 'debit'
                ? <><strong>Office Misconduct</strong> debits <span className="font-bold text-varistor-dangerText">-50 VP</span> or <strong>Late Entry</strong> debits <span className="font-bold text-varistor-dangerText">-25 VP</span>.</>
                : <>Grant manual points for <strong>Custom Credit</strong> (e.g. Exceptional Performance, Overtime).</>
              }
            </p>
          </div>

          <div className={`p-6 border-t ${transactionMode === 'debit' ? 'bg-varistor-dangerBg border-varistor-dangerBorder' : 'bg-varistor-limeLight border-varistor-lime'}`}>
            <form onSubmit={handleAssertTransaction} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Employee Selection */}
                <div className="w-full sm:w-48">
                  <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1.5 ${transactionMode === 'debit' ? 'text-varistor-dangerText' : 'text-varistor-limeText'}`}>Employee</label>
                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className={`w-full bg-varistor-surface border rounded-lg px-3 py-2 text-xs focus:outline-none ${transactionMode === 'debit' ? 'border-varistor-dangerBorder text-varistor-dangerText focus:border-varistor-dangerText' : 'border-varistor-lime text-varistor-limeText focus:border-varistor-lime'}`}
                    required
                  >
                    <option value="" disabled>Select Employee</option>
                    {mockEmployeeStore.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.fullName}</option>
                    ))}
                  </select>
                </div>

                {/* Type Selection */}
                <div className="w-full sm:w-48">
                  <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1.5 ${transactionMode === 'debit' ? 'text-varistor-dangerText' : 'text-varistor-limeText'}`}>Transaction Type</label>
                  <select
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value as any)}
                    className={`w-full bg-varistor-surface border rounded-lg px-3 py-2 text-xs focus:outline-none ${transactionMode === 'debit' ? 'border-varistor-dangerBorder text-varistor-dangerText focus:border-varistor-dangerText' : 'border-varistor-lime text-varistor-limeText focus:border-varistor-lime'}`}
                  >
                    {transactionMode === 'debit' ? (
                      <>
                        <option value="misconduct">Office Misconduct (-50 VP)</option>
                        <option value="late_entry">Late Entry (-25 VP)</option>
                        <option value="custom_debit">Custom Penalty</option>
                      </>
                    ) : (
                      <option value="custom_credit">Custom Credit</option>
                    )}
                  </select>
                </div>

                <div className="flex-1">
                  <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1.5 ${transactionMode === 'debit' ? 'text-varistor-dangerText' : 'text-varistor-limeText'}`}>Reason justification</label>
                  <input
                    type="text"
                    placeholder={transactionMode === 'debit' ? (transactionType === 'misconduct' ? "e.g. Policy breach in meeting rooms" : (transactionType === 'late_entry' ? "e.g. Late check-in exceeding 15 minutes" : "e.g. Unauthorized absence")) : "e.g. Outstanding performance on client project"}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className={`w-full bg-varistor-surface border rounded-lg px-3 py-2 text-xs placeholder:opacity-50 focus:outline-none ${transactionMode === 'debit' ? 'border-varistor-dangerBorder text-varistor-dangerText focus:border-varistor-dangerText' : 'border-varistor-lime text-varistor-limeText focus:border-varistor-lime'}`}
                    required
                  />
                </div>
              </div>

              {/* Custom Points Input */}
              {(transactionType === 'custom_debit' || transactionType === 'custom_credit') && (
                <div className="pt-2">
                  <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1.5 ${transactionMode === 'debit' ? 'text-varistor-dangerText' : 'text-varistor-limeText'}`}>Custom Points Amount</label>
                  <div className="relative w-48">
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 100"
                      value={customPoints}
                      onChange={(e) => setCustomPoints(Number(e.target.value) || '')}
                      className={`w-full bg-varistor-surface border rounded-lg px-3 py-2 text-xs focus:outline-none ${transactionMode === 'debit' ? 'border-varistor-dangerBorder text-varistor-dangerText focus:border-varistor-dangerText' : 'border-varistor-lime text-varistor-limeText focus:border-varistor-lime'}`}
                      required
                    />
                    <div className={`absolute right-3 top-2 text-xs font-bold ${transactionMode === 'debit' ? 'text-varistor-dangerText/50' : 'text-varistor-limeText/50'}`}>VP</div>
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  className={`px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-transform active:scale-95 ${transactionMode === 'debit' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-varistor-lime hover:bg-[#6edc00] text-varistor-limeText shadow-lg shadow-varistor-lime/20'}`}
                >
                  <AlertTriangle size={16} />
                  {transactionMode === 'debit' ? 'Submit Debit' : 'Submit Credit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <div className="bg-varistor-surface rounded-varistor border border-varistor-border shadow-varistor overflow-hidden">
          <div className="px-6 py-4 border-b border-varistor-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History size={16} className="text-varistor-muted" />
              <h3 className="text-sm font-bold text-varistor-dark">VP Transaction History</h3>
              <span className="text-xs text-varistor-muted">({history.length} records)</span>
            </div>
            <button
              onClick={fetchHistory}
              className="flex items-center gap-1.5 text-xs text-varistor-muted hover:text-varistor-dark transition-colors px-3 py-1.5 rounded-lg hover:bg-varistor-surfaceMuted border border-varistor-border"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center h-40 text-varistor-muted text-sm">
              <RefreshCw size={16} className="animate-spin mr-2" /> Loading history...
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-varistor-muted">
              <History size={32} strokeWidth={1.5} className="mb-2 opacity-40" />
              <p className="text-sm">No VP transactions recorded yet.</p>
              <p className="text-xs mt-1 opacity-60">Submit a transaction from the Console tab to see it here.</p>
            </div>
          ) : (
            <div className="divide-y divide-varistor-border">
              {history.map((entry) => {
                const meta = entry.metadata;
                const isCredit = meta?.transaction_type === 'credit';
                return (
                  <div key={entry.id} className="px-6 py-4 hover:bg-varistor-surfaceMuted transition-colors">
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isCredit ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                        {isCredit ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          {/* Points badge */}
                          <span className={`text-sm font-bold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                            {isCredit ? '+' : '-'}{meta?.points ?? '?'} VP
                          </span>
                          {/* Transaction type badge */}
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isCredit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {meta?.rule_type?.replace(/_/g, ' ').toUpperCase() ?? 'TRANSACTION'}
                          </span>
                        </div>

                        {/* Reason */}
                        <p className="text-xs text-varistor-dark mt-1 font-medium">"{meta?.reason ?? entry.details}"</p>

                        {/* Employee info */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                          <div className="flex items-center gap-1 text-xs text-varistor-muted">
                            <User size={11} />
                            <span>
                              <span className="font-semibold text-varistor-dark">{meta?.employee_name ?? '—'}</span>
                              {meta?.employee_code && <span className="ml-1 opacity-60">({meta.employee_code})</span>}
                            </span>
                          </div>
                          {meta?.vp_before !== undefined && meta?.vp_after !== undefined && (
                            <div className="flex items-center gap-1 text-xs text-varistor-muted">
                              <span className="opacity-60">VP:</span>
                              <span className="font-semibold">{meta.vp_before}</span>
                              <span className="opacity-40">→</span>
                              <span className={`font-bold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>{meta.vp_after}</span>
                            </div>
                          )}
                        </div>

                        {/* Performed by + timestamp */}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                          <div className="flex items-center gap-1 text-[11px] text-varistor-muted">
                            <ShieldAlert size={11} />
                            <span>By <span className="font-semibold text-varistor-dark">{meta?.performed_by_name ?? entry.performed_by}</span>
                              {meta?.performed_by_role && <span className="ml-1 opacity-60">({meta.performed_by_role})</span>}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-varistor-muted">
                            <Clock size={11} />
                            <span>{formatDate(entry.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
