import React from 'react';
import { Award, TrendingUp } from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';

export const PointsBalance: React.FC = () => {
  const { pointsBalance } = useVariPoints();

  // Weekly breakdown points (Mon to Sat)
  const weeklyData = [
    { day: 'M', points: 10, height: 'h-8' },
    { day: 'T', points: 15, height: 'h-11' },
    { day: 'W', points: 5, height: 'h-4' },
    { day: 'T', points: 20, height: 'h-14' },
    { day: 'F', points: 10, height: 'h-8' },
    { day: 'S', points: 25, height: 'h-16' }
  ];

  const thisWeekTotal = weeklyData.reduce((acc, curr) => acc + curr.points, 0);

  return (
    <div className="bg-white rounded-varistor border border-varistor-border p-5 shadow-varistor flex flex-col justify-between h-[210px] transition-varistor hover:shadow-md">
      <div className="flex justify-between items-center pb-2 border-b border-[#edf0ec]">
        <h3 className="text-sm font-semibold text-varistor-dark">Vari Points</h3>
        <span className="text-[10px] text-varistor-limeText font-semibold bg-varistor-limeLight px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
          <TrendingUp size={10} />
          +{thisWeekTotal} this week
        </span>
      </div>

      <div className="flex items-center justify-between mt-3">
        {/* Value Display */}
        <div className="flex flex-col">
          <span className="text-3xl font-extrabold text-varistor-dark">
            {pointsBalance.toLocaleString()}
          </span>
          <span className="text-[10px] text-varistor-muted mt-1 flex items-center gap-1 font-medium">
            <Award size={12} className="text-varistor-lime" />
            Total Balance
          </span>
        </div>

        {/* Small Bar Chart */}
        <div className="flex items-end gap-1.5 h-16 pt-2">
          {weeklyData.map((data, index) => (
            <div key={index} className="flex flex-col items-center group relative">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 px-1.5 py-0.5 bg-black text-white text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                +{data.points} VP
              </div>
              {/* Bar */}
              <div 
                className={`w-3.5 rounded-t-[3px] bg-varistor-lime hover:bg-[#72be0e] transition-varistor cursor-pointer ${data.height}`}
              />
              <span className="text-[9px] text-varistor-muted mt-1 font-semibold">{data.day}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
