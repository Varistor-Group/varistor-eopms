import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  rightElement?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', rightElement, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        <label className="text-sm font-medium text-brand-ink">
          {label}
        </label>
        <div className="relative w-full">
          <input
            ref={ref}
            className={`px-3 py-2 border rounded-xl outline-none transition-all duration-200 focus:ring-2 focus:ring-brand-lime/50 bg-varistor-surface text-varistor-dark w-full
              ${error ? 'border-varistor-dangerText' : 'border-varistor-border focus:border-brand-lime'}
              ${rightElement ? 'pr-10' : ''}
              ${className}`}
            {...props}
          />
          {rightElement && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-gray-400">
              {rightElement}
            </div>
          )}
        </div>
        {error && (
          <span className="text-xs text-varistor-dangerText font-medium">
            {error}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
