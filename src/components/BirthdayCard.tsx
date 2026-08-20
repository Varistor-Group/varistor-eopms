import React, { useState, useEffect } from 'react';
import { Cake, Gift, X, Sparkles } from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';

export const BirthdayCard: React.FC = () => {
  const { currentUser } = useVariPoints();
  const [showCard, setShowCard] = useState(false);
  const currentYear = new Date().getFullYear();

  const isBirthdayToday = () => {
    const dob = currentUser?.dob;
    if (!dob) return false;
    const today = new Date();
    const dobDate = new Date(dob);
    return today.getMonth() === dobDate.getMonth() && today.getDate() === dobDate.getDate();
  };

  useEffect(() => {
    // Check if user already dismissed it for this year
    const isDismissed = localStorage.getItem(`birthday_dismissed_${currentYear}`);

    if (isBirthdayToday() && !isDismissed) {
  // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowCard(true);
    }
  }, [currentYear, currentUser?.dob]);

  const handleDismiss = () => {
    localStorage.setItem(`birthday_dismissed_${currentYear}`, 'true');
    setShowCard(false);
  };

  if (!showCard) return null;

  const firstName = currentUser?.name?.split(' ')[0] ?? 'there';

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#f7fee7] to-[#ecfccb] border border-varistor-successBorder rounded-varistor p-5 shadow-[0_4px_16px_rgba(132,204,22,0.12)] transition-varistor hover:shadow-lg animate-[fadeInScale_300ms_ease-out] col-span-full">
      {/* Decorative Floating Balloons (pure CSS animation) */}
      <div className="absolute right-8 -bottom-2 flex gap-4 opacity-25 pointer-events-none">
        <div className="w-10 h-14 bg-red-400 rounded-full animate-[bounce_3s_infinite]" />
        <div className="w-12 h-16 bg-lime-400 rounded-full animate-[bounce_4s_infinite_1s]" />
        <div className="w-9 h-12 bg-blue-400 rounded-full animate-[bounce_2.5s_infinite_0.5s]" />
      </div>

      <div className="flex items-start justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-varistor-lime flex items-center justify-center text-black">
            <Cake size={20} strokeWidth={1.5} className="animate-spin" style={{ animationDuration: '6s' }} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-base font-bold text-varistor-dark">Happy Birthday, {firstName}!</h2>
              <Sparkles size={16} className="text-yellow-600 animate-pulse" />
            </div>
            <p className="text-xs text-varistor-limeText font-medium mt-0.5">
              Varistor Technologies wishes you a fantastic day ahead. Enjoy your special rewards!
            </p>
          </div>
        </div>

        <button 
          onClick={handleDismiss}
          className="p-1 rounded-full text-varistor-muted hover:text-black hover:bg-black hover:bg-opacity-5 transition-colors"
          title="Dismiss for this year"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-2 relative z-10">
        <div className="bg-white border border-varistor-successBorder px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm">
          <Gift size={15} className="text-varistor-lime" />
          <span className="text-xs font-bold text-varistor-dark">+100 Vari Points Birthday Bonus Credited!</span>
        </div>
      </div>

      {/* Embedded CSS for custom keyframes */}
      <style>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.97);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};
