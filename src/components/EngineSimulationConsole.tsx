import React, { useState } from 'react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';
import { mockEmployeeStore } from '../api/employees';

export const EngineSimulationConsole: React.FC = () => {
  const { currentRole, assertAdministrativePenalty } = useVariPoints();
  const [penaltyType, setPenaltyType] = useState<'misconduct' | 'late_entry' | 'custom'>('misconduct');
  const [penaltyReason, setPenaltyReason] = useState('');
  const [customPoints, setCustomPoints] = useState<number | ''>('');
  const [employeeId, setEmployeeId] = useState('');

  const hasAccess = currentRole === 'Admin' || currentRole === 'HR';

  const handleAssertPenalty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!penaltyReason.trim() || !employeeId) return;
    
    const pointsToDeduct = penaltyType === 'custom' ? Number(customPoints) : undefined;
    if (penaltyType === 'custom' && (!pointsToDeduct || pointsToDeduct <= 0)) return;

    assertAdministrativePenalty(penaltyType, penaltyReason.trim(), pointsToDeduct, employeeId);
    setPenaltyReason('');
    setCustomPoints('');
    setEmployeeId('');
  };

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-white rounded-varistor border border-red-200 shadow-sm">
        <div className="text-red-500 font-bold text-6xl mb-4">403</div>
        <h2 className="text-xl font-bold text-varistor-dark">Forbidden Access</h2>
        <p className="text-sm text-varistor-muted mt-2 text-center max-w-sm">You do not have the required permissions to view the Engine Simulation Console.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-[fadeInPage_250ms_ease-out]">
      <div>
        <h1 className="text-xl font-bold text-varistor-dark">Engine Simulation Console</h1>
        <p className="text-xs text-varistor-muted mt-0.5">Administrative tools for testing and asserting manual Vari Points penalties.</p>
      </div>

      <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor max-w-3xl overflow-hidden">
        <div className="px-6 py-5 border-b border-[#f1f3f0]">
           <div className="flex items-center gap-2">
             <ShieldAlert size={18} className="text-red-600 animate-pulse" />
             <h3 className="text-sm font-bold text-varistor-dark uppercase tracking-wider">Debit Points Adjustment</h3>
           </div>
           <p className="text-xs text-varistor-muted mt-2">
             Test administrative penalties: **Office Misconduct** (debits <span className="font-bold">-50 VP</span>) or **Late Entry** (debits <span className="font-bold">-25 VP</span>).
           </p>
        </div>
        
        <div className="p-6 bg-[#fff1f2] border-t border-red-200">
          <form onSubmit={handleAssertPenalty} className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Employee Selection */}
              <div className="w-full sm:w-48">
                <label className="text-[10px] text-red-800 font-bold uppercase tracking-wider block mb-1.5">Employee</label>
                <select
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full bg-white border border-red-300 rounded-lg px-3 py-2 text-xs text-red-900 focus:outline-none focus:border-red-500"
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
                <label className="text-[10px] text-red-800 font-bold uppercase tracking-wider block mb-1.5">Penalty Type</label>
                <select
                  value={penaltyType}
                  onChange={(e) => setPenaltyType(e.target.value as any)}
                  className="w-full bg-white border border-red-300 rounded-lg px-3 py-2 text-xs text-red-900 focus:outline-none focus:border-red-500"
                >
                  <option value="misconduct">Office Misconduct (-50 VP)</option>
                  <option value="late_entry">Late Entry (-25 VP)</option>
                  <option value="custom">Custom Penalty</option>
                </select>
              </div>

              <div className="flex-1">
                <label className="text-[10px] text-red-800 font-bold uppercase tracking-wider block mb-1.5">Reason justification</label>
                <input
                  type="text"
                  placeholder={penaltyType === 'misconduct' ? "e.g. Policy breach in meeting rooms" : (penaltyType === 'late_entry' ? "e.g. Late check-in exceeding 15 minutes" : "e.g. Unauthorized absence")}
                  value={penaltyReason}
                  onChange={(e) => setPenaltyReason(e.target.value)}
                  className="w-full bg-white border border-red-300 rounded-lg px-3 py-2 text-xs text-red-900 focus:outline-none focus:border-red-500 transition-colors"
                  required
                />
              </div>

              {penaltyType === 'custom' && (
                <div className="w-full sm:w-32">
                  <label className="text-[10px] text-red-800 font-bold uppercase tracking-wider block mb-1.5">Points to Deduct</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 100"
                    value={customPoints}
                    onChange={(e) => setCustomPoints(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-white border border-red-300 rounded-lg px-3 py-2 text-xs text-red-900 focus:outline-none focus:border-red-500 transition-colors"
                    required
                  />
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button 
                type="submit"
                className="bg-red-700 hover:bg-red-800 text-white px-5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-2"
              >
                <AlertTriangle size={14} />
                Submit Debit
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
