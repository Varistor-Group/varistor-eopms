import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200" 
        onClick={onClose}
      />
      <div
        className="relative bg-varistor-surface rounded-[12px] shadow-xl w-full max-w-md flex flex-col overflow-hidden transform transition-all duration-200 scale-95 opacity-0 animate-[modal-enter_200ms_ease-out_forwards]"
      >
        <div className="flex items-center justify-between p-4 border-b border-varistor-border">
          <h2 className="text-lg font-semibold text-brand-ink">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-varistor-muted hover:text-varistor-dark hover:bg-varistor-surfaceMuted transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4">
          {children}
        </div>
      </div>
      <style>{`
        @keyframes modal-enter {
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
