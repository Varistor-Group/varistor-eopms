import React, { type ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  isLoading,
  variant = 'primary',
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'px-4 py-2.5 rounded-xl font-medium transition-all duration-150 flex items-center justify-center gap-2 outline-none cursor-pointer';
  
  const variants = {
    primary: 'bg-brand-lime text-brand-ink hover:bg-[#92cc2e] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed',
    secondary: 'bg-white border border-gray-200 text-brand-ink hover:bg-gray-50 active:scale-[0.98] disabled:opacity-50',
    ghost: 'bg-transparent text-gray-600 hover:text-brand-ink hover:bg-gray-100 disabled:opacity-50',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : null}
      {children}
    </button>
  );
};
