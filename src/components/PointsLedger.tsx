import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert, Filter, ArrowUpRight, ArrowDownRight, Lock } from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';

export const PointsLedger: React.FC = () => {
  const { 
    ledger, 
    pointsBalance, 
    currentRole, 
    assertAdministrativePenalty 
  } = useVariPoints();
  
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit'>('all');
  
  // HR Penalty Form State
  const [showForm, setShowForm] = useState(false);
  const [penaltyType, setPenaltyType] = useState<'misconduct' | 'late_entry'>('misconduct');
  const [penaltyReason, setPenaltyReason] = useState('');

  const handleAssertPenalty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!penaltyReason.trim()) return;
    assertAdministrativePenalty(penaltyType, penaltyReason.trim());
    setPenaltyReason('');
    setShowForm(false);
  };

  const filteredLedger = ledger.filter((entry) => {
    if (filterType === 'all') return true;
    return entry.type === filterType;
  });

  const hasAccess = currentRole === 'Admin' || currentRole === 'HR';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-varistor-dark">Vari Points Ledger</h1>
        <p className="text-xs text-varistor-muted mt-0.5">Transparent point tracking history, reward credits, and performance adjustments.</p>
      </div>

      {/* Stats Summary & Simulation Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Balance Card */}
        <div className="bg-white rounded-varistor border border-varistor-border p-5 shadow-varistor flex flex-col justify-center h-[130px]">
          <span className="text-[10px] text-varistor-muted font-bold uppercase tracking-wider block">Total Points Balance</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-extrabold text-varistor-dark">{pointsBalance.toLocaleString()}</span>
            <span className="text-xs font-bold text-varistor-limeText bg-varistor-limeLight px-1.5 py-0.5 rounded">VP</span>
          </div>
        </div>

        {/* Engine Simulation Console */}
        <div className="bg-white rounded-varistor border border-varistor-border p-5 shadow-varistor flex flex-col justify-between h-[130px] lg:col-span-2">
          <div>
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-xs font-bold text-varistor-dark uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert size={15} className="text-red-600 animate-pulse" />
                Engine Simulation Console
              </h3>
              {!hasAccess && (
                <span className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Lock size={10} />
                  HR/Admin Only
                </span>
              )}
            </div>
            <p className="text-[11px] text-varistor-muted leading-relaxed">
              Test administrative penalties: **Office Misconduct** (debits <span className="font-bold">-50 VP</span>) or **Late Entry** (debits <span className="font-bold">-25 VP</span>).
            </p>
          </div>

          <div className="flex pt-3 border-t border-[#f1f3f0]">
            <button
              onClick={() => {
                if (hasAccess) setShowForm(!showForm);
              }}
              disabled={!hasAccess}
              className={`w-full py-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 transition-colors ${
                hasAccess 
                  ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100 cursor-pointer' 
                  : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
              }`}
            >
              <AlertTriangle size={14} />
              Assert Manual Penalty
            </button>
          </div>
        </div>
      </div>

      {/* Manual Penalty Form Popover */}
      {showForm && hasAccess && (
        <div className="bg-[#fff1f2] border border-red-200 rounded-varistor p-4 shadow-sm animate-fade-in">
          <form onSubmit={handleAssertPenalty} className="space-y-4">
            <h4 className="text-xs font-bold text-red-900 uppercase tracking-wider">Debit Points Adjustment</h4>
            
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Type Selection */}
              <div className="w-full sm:w-48">
                <label className="text-[9px] text-red-800 font-bold uppercase tracking-wider block mb-1">Penalty Type</label>
                <select
                  value={penaltyType}
                  onChange={(e) => setPenaltyType(e.target.value as any)}
                  className="w-full bg-white border border-red-300 rounded-lg px-2.5 py-1.5 text-xs text-red-900 focus:outline-none focus:border-red-500"
                >
                  <option value="misconduct">Office Misconduct (-50 VP)</option>
                  <option value="late_entry">Late Entry (-25 VP)</option>
                </select>
              </div>

              {/* Reason Input */}
              <div className="flex-1">
                <label className="text-[9px] text-red-800 font-bold uppercase tracking-wider block mb-1">Reason justification</label>
                <input
                  type="text"
                  placeholder={penaltyType === 'misconduct' ? "e.g. Policy breach in meeting rooms" : "e.g. Late check-in exceeding 15 minutes"}
                  value={penaltyReason}
                  onChange={(e) => setPenaltyReason(e.target.value)}
                  className="w-full bg-white border border-red-300 rounded-lg px-3 py-1.5 text-xs text-red-900 focus:outline-none focus:border-red-500 transition-colors"
                  required
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button 
                type="button" 
                onClick={() => setShowForm(false)}
                className="bg-white border border-red-200 text-red-700 px-3.5 py-1.5 rounded-lg text-xs hover:bg-red-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="bg-red-700 hover:bg-red-800 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Submit Debit
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ledger Table Container */}
      <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor overflow-hidden">
        {/* Table Filters */}
        <div className="px-6 py-4 border-b border-varistor-border flex justify-between items-center bg-[#fafbfa]">
          <h3 className="text-xs font-bold text-varistor-dark uppercase tracking-wider flex items-center gap-1.5">
            <Filter size={14} className="text-varistor-muted" />
            Transaction Logs
          </h3>
          <div className="flex bg-[#edf0ec] p-0.5 rounded-lg text-[11px] font-semibold">
            <button 
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-md transition-varistor cursor-pointer ${filterType === 'all' ? 'bg-white text-black shadow-sm' : 'text-[#6b7264] hover:text-black'}`}
            >
              All
            </button>
            <button 
              onClick={() => setFilterType('credit')}
              className={`px-3 py-1 rounded-md transition-varistor cursor-pointer ${filterType === 'credit' ? 'bg-white text-black shadow-sm' : 'text-[#6b7264] hover:text-black'}`}
            >
              Credits
            </button>
            <button 
              onClick={() => setFilterType('debit')}
              className={`px-3 py-1 rounded-md transition-varistor cursor-pointer ${filterType === 'debit' ? 'bg-white text-black shadow-sm' : 'text-[#6b7264] hover:text-black'}`}
            >
              Debits
            </button>
          </div>
        </div>

        {/* Ledger Entries List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-varistor-border text-[10px] text-varistor-muted uppercase tracking-wider font-semibold bg-[#fafbfa]">
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Reason / Task Title</th>
                <th className="px-6 py-3">Justification</th>
                <th className="px-6 py-3 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f3f0] text-xs">
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-varistor-muted italic">
                    No transactions found matching the filter.
                  </td>
                </tr>
              ) : (
                filteredLedger.map((entry) => {
                  const isDebit = entry.type === 'debit';
                  
                  return (
                    <tr key={entry.id} className="hover:bg-[#fafbfa] transition-colors">
                      <td className="px-6 py-4 text-varistor-muted whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4 font-semibold text-varistor-dark">
                        {entry.taskTitle}
                      </td>
                      <td className="px-6 py-4 text-[#555a52]">
                        {entry.reason}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span className={`inline-flex items-center gap-0.5 px-2 py-1 rounded font-bold ${
                          isDebit 
                            ? 'bg-red-50 text-red-700' 
                            : 'bg-varistor-limeLight text-varistor-successText'
                        }`}>
                          {isDebit ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
                          {isDebit ? '-' : '+'}{entry.points} VP
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
