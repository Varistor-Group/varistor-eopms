import React, { useEffect, useState } from 'react';

interface PerformanceMeterProps {
  score?: number;
}

export const PerformanceMeter: React.FC<PerformanceMeterProps> = ({ score = 78 }) => {
  const [offset, setOffset] = useState(219.9); // radius 70: PI * 70 = 219.9 (for 180deg)

  useEffect(() => {
    // Animate on mount to create the ease-out effect
    const timer = setTimeout(() => {
      const calculatedOffset = 219.9 - (219.9 * (score / 100));
      setOffset(calculatedOffset);
    }, 100);
    return () => clearTimeout(timer);
  }, [score]);

  return (
    <div className="bg-white rounded-varistor border border-varistor-border p-5 shadow-varistor flex flex-col justify-between h-[210px] transition-varistor hover:shadow-md">
      <div className="flex justify-between items-center pb-2 border-b border-[#edf0ec]">
        <h3 className="text-sm font-semibold text-varistor-dark">Performance meter</h3>
      </div>
      
      <div className="relative flex items-end justify-center h-[110px] overflow-hidden">
        {/* SVG Arc Gauge */}
        <svg className="w-[170px] h-[170px] translate-y-[40px]" viewBox="0 0 180 180">
          {/* Background Arc */}
          <path
            d="M 20,90 A 70,70 0 0,1 160,90"
            fill="none"
            stroke="#edf1eb"
            strokeWidth="13"
            strokeLinecap="round"
          />
          {/* Active Arc */}
          <path
            d="M 20,90 A 70,70 0 0,1 160,90"
            fill="none"
            stroke="#84cc16"
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray="219.9"
            style={{
              strokeDashoffset: offset,
              transition: 'stroke-dashoffset 600ms ease-out'
            }}
          />
        </svg>

        {/* Score display inside the gauge */}
        <div className="absolute bottom-4 flex flex-col items-center">
          <span className="text-3xl font-extrabold text-varistor-dark leading-none">{score}</span>
          <span className="text-[10px] text-varistor-muted font-medium uppercase tracking-wider mt-1">Rating</span>
        </div>
      </div>
      
      <div className="flex justify-between items-center text-[10px] text-varistor-muted mt-2 pt-2 border-t border-[#edf0ec]">
        <span>This quarter</span>
        <span className="text-[#3f6212] font-semibold bg-[#eefed4] px-1.5 py-0.5 rounded-full">Good Standing</span>
      </div>
    </div>
  );
};
