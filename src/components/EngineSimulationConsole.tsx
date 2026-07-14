import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, History } from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';
import { mockEmployeeStore, getEmployees, type Employee } from '../api/employees';
import { vpAuditApi, type VpAuditLog } from '../api/vpAudit';

export const EngineSimulationConsole: React.FC = () => {
  const { currentRole, assertAdministrativeTransaction } = useVariPoints();
  const [transactionMode, setTransactionMode] = useState<'debit' | 'credit'>('debit');
  const [transactionType, setTransactionType] = useState<'misconduct' | 'late_entry' | 'custom_debit' | 'custom_credit'>('misconduct');
  const [reason, setReason] = useState('');
  const [customPoints, setCustomPoints] = useState<number | ''>('');
  const [employeeId, setEmployeeId] = useState('');
  const [logs, setLogs] = useState<VpAuditLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>(mockEmployeeStore);

  const hasAccess = currentRole === 'Admin' || currentRole === 'HR';

  const fetchLogsAndEmployees = async () => {
    try {
      const [logsData, empsData] = await Promise.all([
        vpAuditApi.getLogs(),
        getEmployees()
      ]);
      setLogs(logsData);
      setEmployees(empsData.length > 0 ? empsData : mockEmployeeStore);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (hasAccess) {
      fetchLogsAndEmployees();
    }
  }, [hasAccess]);

  const getEmployeeName = (id?: string) => {
    if (!id) return 'Unknown';
    const emp = employees.find(e => e.id === id || e.employeeId === id);
    return emp ? emp.fullName : 'Unknown User';
  };

  const getActionByDisplay = (id?: string) => {
    if (!id) return 'System';
    if (id === 'VAR-001') return 'System Admin (Admin)';
    
    const emp = employees.find(e => e.id === id || e.employeeId === id);
    if (emp) {
      return `${emp.fullName} (${emp.role})`;
    }
    return `Unknown User (${id})`;
  };


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

    setTimeout(() => {
      fetchLogsAndEmployees();
    }, 1000);
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

  return (
    <div className="space-y-6 animate-[fadeInPage_250ms_ease-out]">
      <div>
        <h1 className="text-xl font-bold text-varistor-dark">VP Management Console</h1>
        <p className="text-xs text-varistor-muted mt-0.5">Administrative tools for testing and asserting manual Vari Points transactions.</p>
      </div>

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
               ? <>Test administrative penalties: **Office Misconduct** (debits <span className="font-bold text-varistor-dangerText">-50 VP</span>) or **Late Entry** (debits <span className="font-bold text-varistor-dangerText">-25 VP</span>).</>
               : <>Grant manual points for **Custom Credit** (e.g. Exceptional Performance, Overtime).</>
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

      <div className="bg-varistor-surface rounded-varistor border border-varistor-border shadow-varistor max-w-3xl overflow-hidden mt-6">
        <div className="px-6 py-5 border-b border-varistor-border flex items-center gap-2">
          <History size={18} className="text-varistor-dark" />
          <h3 className="text-sm font-bold text-varistor-dark uppercase tracking-wider">Transaction Log</h3>
        </div>
        <div className="p-0">
          {logs.length === 0 ? (
            <p className="text-xs text-varistor-muted p-6 text-center">No transaction logs available.</p>
          ) : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-varistor-surface z-10">
                  <tr className="bg-varistor-surfaceMuted border-b border-varistor-border">
                    <th className="p-3 text-[10px] font-bold text-varistor-muted uppercase">Date</th>
                    <th className="p-3 text-[10px] font-bold text-varistor-muted uppercase">Points</th>
                    <th className="p-3 text-[10px] font-bold text-varistor-muted uppercase">Employee</th>
                    <th className="p-3 text-[10px] font-bold text-varistor-muted uppercase">Reason</th>
                    <th className="p-3 text-[10px] font-bold text-varistor-muted uppercase">Action By</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b border-varistor-border last:border-b-0 hover:bg-varistor-surfaceMuted/50 transition-colors">
                      <td className="p-3 text-xs text-varistor-dark whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="p-3 text-xs font-bold">
                        <span className={log.type === 'debit' ? 'text-red-500' : 'text-green-500'}>
                          {log.type === 'debit' ? '-' : '+'}{log.points} VP
                        </span>
                      </td>
                      <td className="p-3 text-xs text-varistor-dark font-medium">
                        {getEmployeeName(log.recipient_id)}
                      </td>
                      <td className="p-3 text-xs text-varistor-muted max-w-[200px] truncate" title={log.reason}>
                        {log.reason}
                      </td>
                      <td className="p-3 text-xs text-varistor-muted">
                        {getActionByDisplay(log.admin_id)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
