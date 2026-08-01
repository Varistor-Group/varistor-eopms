import React, { useEffect, useMemo, useState } from 'react';
import { Award, TrendingUp } from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';
import { getPointsHistory, type VpTransaction } from '../api/vpTransactions';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']; // index 0 = Sunday, matching Date.getDay()

export const PointsBalance: React.FC = () => {
  const { pointsBalance, currentUser } = useVariPoints();
  const [transactions, setTransactions] = useState<VpTransaction[]>([]);

  useEffect(() => {
    if (!currentUser) return;
    getPointsHistory(currentUser.id).then(setTransactions);
  }, [currentUser]);

  const weeklyData = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // back to this week's Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    // Mon–Sat, matching the original 6-bar layout
    const days = [1, 2, 3, 4, 5, 6].map(offset => {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + offset);
      return { date, label: DAY_LABELS[date.getDay()], points: 0 };
    });

    for (const txn of transactions) {
      const txnDate = new Date(txn.created_at);
      const dayEntry = days.find(d =>
        d.date.getFullYear() === txnDate.getFullYear() &&
        d.date.getMonth() === txnDate.getMonth() &&
        d.date.getDate() === txnDate.getDate()
      );
      if (dayEntry) {
        dayEntry.points += txn.type === 'credit' ? txn.points : -txn.points;
      }
    }

    const maxPoints = Math.max(1, ...days.map(d => Math.abs(d.points)));

    return days.map(d => ({
      day: d.label,
      points: d.points,
      // Scale bar height proportionally (max 16, matching original h-16 cap), minimum sliver for 0
      heightPx: d.points === 0 ? 4 : Math.max(6, Math.round((Math.abs(d.points) / maxPoints) * 64)),
    }));
  }, [transactions]);

  const thisWeekTotal = weeklyData.reduce((acc, curr) => acc + curr.points, 0);

  return (
    <div
      onClick={() => window.dispatchEvent(new CustomEvent('navigateTab', { detail: 'ledger' }))}
      className="bg-white rounded-varistor border border-varistor-border p-5 shadow-varistor flex flex-col justify-between h-[210px] transition-varistor hover:shadow-md cursor-pointer"
    >
      <div className="flex justify-between items-center pb-2 border-b border-[#edf0ec]">
        <h3 className="text-sm font-semibold text-varistor-dark">Vari Points</h3>
        <span className="text-[10px] text-varistor-limeText font-semibold bg-varistor-limeLight px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
          <TrendingUp size={10} />
          {thisWeekTotal >= 0 ? '+' : ''}{thisWeekTotal} this week
        </span>
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex flex-col">
          <span className="text-3xl font-extrabold text-varistor-dark">
            {pointsBalance.toLocaleString()}
          </span>
          <span className="text-[10px] text-varistor-muted mt-1 flex items-center gap-1 font-medium">
            <Award size={12} className="text-varistor-lime" />
            Total Balance
          </span>
        </div>

        <div className="flex items-end gap-1.5 h-16 pt-2">
          {weeklyData.map((data, index) => (
            <div key={index} className="flex flex-col items-center group relative">
              <div className="absolute bottom-full mb-1 px-1.5 py-0.5 bg-black text-white text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                {data.points >= 0 ? '+' : ''}{data.points} VP
              </div>
              <div
                style={{ height: `${data.heightPx}px` }}
                className={`w-3.5 rounded-t-[3px] transition-varistor cursor-pointer ${
                  data.points < 0 ? 'bg-red-400 hover:bg-red-500' : 'bg-varistor-lime hover:bg-[#72be0e]'
                }`}
              />
              <span className="text-[9px] text-varistor-muted mt-1 font-semibold">{data.day}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};