import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { UserRole } from '../types';

const ROLES: UserRole[] = ['Employee', 'Reporting Manager', 'HR', 'Admin'];

interface RoleSwitcherProps {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
}

// Custom-styled dropdown replacing a native <select>, whose popup ignores our
// theme CSS entirely (it's rendered by the OS/browser chrome, not our page),
// making unselected options unreadable in dark mode.
export const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ currentRole, setCurrentRole }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (role: UserRole) => {
    setCurrentRole(role);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-1.5 bg-varistor-surfaceMuted px-2.5 py-1.5 rounded-full border border-varistor-border cursor-pointer"
        title="Switch active role for permission testing"
      >
        <span className="text-[9px] text-varistor-muted font-bold uppercase tracking-wider hidden md:inline">Role:</span>
        <span className="text-xs font-bold text-varistor-dark">{currentRole}</span>
        <ChevronDown size={12} className={`text-varistor-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-44 bg-varistor-surface border border-varistor-border rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.10)] z-50 overflow-hidden animate-[fadeIn_150ms_ease-out]">
          {ROLES.map(role => (
            <button
              key={role}
              onClick={() => handleSelect(role)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-left cursor-pointer transition-colors ${
                role === currentRole
                  ? 'bg-varistor-limeLight text-varistor-limeText'
                  : 'text-varistor-dark hover:bg-varistor-surfaceMuted'
              }`}
            >
              {role}
              {role === currentRole && <Check size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
