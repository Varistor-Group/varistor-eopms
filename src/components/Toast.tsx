import React from 'react';
import { Check, X, Award, AlertCircle } from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';

export const Toast: React.FC = () => {
  const { toasts, dismissToast } = useVariPoints();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isDebit = toast.type === 'debit';
        
        return (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 p-4 bg-varistor-successBg border border-varistor-successBorder rounded-varistor shadow-[0_4px_12px_rgba(0,0,0,0.08)] animate-toast-in transition-all duration-200"
            style={{
              backgroundColor: isDebit ? '#fef2f2' : '#eefed4',
              borderColor: isDebit ? '#fee2e2' : '#d2f3a6'
            }}
          >
            {/* Left Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {isDebit ? (
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle size={13} className="text-red-700" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-[#d2f3a6] flex items-center justify-center">
                  <Check size={13} className="text-varistor-successText" />
                </div>
              )}
            </div>

            {/* Message & Points Details */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-varistor-dark leading-tight">
                {toast.message}
              </p>
              {toast.points > 0 && (
                <div className="mt-1 flex items-center gap-1.5">
                  <Award size={14} className={isDebit ? "text-red-700" : "text-varistor-successText"} />
                  <span className={`text-xs font-bold ${isDebit ? 'text-red-700' : 'text-varistor-successText'}`}>
                    {isDebit ? '-' : '+'}{toast.points} Vari Points
                  </span>
                </div>
              )}
            </div>

            {/* Dismiss Button */}
            <button
              onClick={() => dismissToast(toast.id)}
              className="flex-shrink-0 text-varistor-muted hover:text-black p-0.5 rounded-full hover:bg-black hover:bg-opacity-5 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
