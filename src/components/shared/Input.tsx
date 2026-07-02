import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        <label className="text-sm font-medium text-brand-ink">
          {label}
        </label>
        <input
          ref={ref}
          className={`px-3 py-2 border rounded-xl outline-none transition-all duration-200 focus:ring-2 focus:ring-brand-lime/50 bg-white
            ${error ? 'border-red-500' : 'border-gray-200 focus:border-brand-lime'}
            ${className}`}
          {...props}
        />
        {error && (
          <span className="text-xs text-red-500 font-medium">
            {error}
          </span>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
