import React, { useState, useEffect } from 'react';
import { Filter, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';
import { getPointsHistory, getAllPointsHistory, type VpTransaction } from '../api/vpTransactions';

export const PointsLedger: React.FC = () => {
  const { pointsBalance, currentUser, currentRole } = useVariPoints();

  const [transactions, setTransactions] = useState<VpTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit'>('all');

  useEffect(() => {
    if (!currentUser) return;
    setIsLoading(true);
    const canSeeAll = currentRole === 'HR' || currentRole === 'Admin';
    const fetcher = canSeeAll ? getAllPointsHistory() : getPointsHistory(currentUser.id);
    fetcher.then(rows => {
      setTransactions(rows);
      setIsLoading(false);
    });
  }, [currentUser, currentRole]);

  const filteredLedger = transactions.filter((entry) => {
    if (filterType === 'all') return true;
    return entry.type === filterType;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-varistor-dark">Vari Points Ledger</h1>
        <p className="text-xs text-varistor-muted mt-0.5">Transparent point tracking history, reward credits, and performance adjustments.</p>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-varistor border border-varistor-border p-5 shadow-varistor flex flex-col justify-center h-[130px]">
          <span className="text-[10px] text-varistor-muted font-bold uppercase tracking-wider block">Total Points Balance</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-extrabold text-varistor-dark">{pointsBalance.toLocaleString()}</span>
            <span className="text-xs font-bold text-varistor-limeText bg-varistor-limeLight px-1.5 py-0.5 rounded">VP</span>
          </div>
        </div>
      </div>

      {/* Ledger Table Container */}
      <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor overflow-hidden">
        <div className="px-6 py-4 border-b border-varistor-border flex justify-between items-center bg-varistor-pageBg">
          <h3 className="text-xs font-bold text-varistor-dark uppercase tracking-wider flex items-center gap-1.5">
            <Filter size={14} className="text-varistor-muted" />
            Transaction Logs
          </h3>
          <div className="flex bg-varistor-pageBg p-0.5 rounded-lg text-[11px] font-semibold">
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

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-varistor-border text-[10px] text-varistor-muted uppercase tracking-wider font-semibold bg-varistor-pageBg">
                <th className="px-6 py-3">Timestamp</th>
                <th className="px-6 py-3">Reason</th>
                <th className="px-6 py-3">Processed By</th>
                <th className="px-6 py-3 text-right">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f3f0] text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-varistor-muted italic">
                    Loading…
                  </td>
                </tr>
              ) : filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-varistor-muted italic">
                    No transactions found matching the filter.
                  </td>
                </tr>
              ) : (
                filteredLedger.map((entry) => {
                  const isDebit = entry.type === 'debit';

                  return (
                    <tr key={entry.id} className="hover:bg-varistor-pageBg transition-colors">
                      <td className="px-6 py-4 text-varistor-muted whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="px-6 py-4 font-semibold text-varistor-dark">
                        {entry.reason}
                      </td>
                      <td className="px-6 py-4 text-[#555a52]">
                        {entry.admin_name ?? '—'}
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