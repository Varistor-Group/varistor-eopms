import React, { useState, useCallback } from 'react';
import { Input } from './shared/Input';
import { Button } from './shared/Button';
import { updatePassword } from '../api/auth';

export const ResetPassword: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string; general?: string }>({});

  // Token is handled automatically by Supabase via auth session

  const validateForm = useCallback(() => {
    const errs: typeof errors = {};
    if (!newPassword) errs.password = 'New password is required.';
    else if (newPassword.length < 8) errs.password = 'Password must be at least 8 characters.';
    
    if (!confirmPassword) errs.confirmPassword = 'Please confirm your new password.';
    else if (newPassword !== confirmPassword) errs.confirmPassword = 'Passwords do not match.';
    
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [newPassword, confirmPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsLoading(true);
    setErrors({});
    
    const { success, error } = await updatePassword(newPassword);
    
    if (!success) {
      setErrors({ general: error || 'Failed to reset password. The link might have expired.' });
    } else {
      setIsSuccess(true);
    }
    setIsLoading(false);
  };

  const navigateToLogin = () => {
    window.location.href = '/';
  };

  return (
    <div className="force-light min-h-screen w-full flex bg-white font-sans selection:bg-brand-lime/20 selection:text-brand-ink">
      
      {/* Brand Splash (Left Side) - Hidden on mobile */}
      <div className="hidden md:flex w-1/2 bg-[#f1f3f0] p-12 lg:p-20 flex-col justify-between relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-[#84CC16]/20 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-[#111111]/5 blur-[100px] pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-16">
            <div className="bg-[#111111] p-2.5 rounded-xl shadow-sm border border-[#111111]/20 flex items-center justify-center">
              <img src="/logo.png" alt="Varistor Logo" className="h-8 md:h-10 w-auto object-contain block" />
            </div>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-[#111111] leading-tight mb-4">
            Reset your password.
          </h1>
          <p className="text-[#111111]/80 text-sm md:text-base font-medium">
            Secure your account and get back to work.
          </p>
        </div>
      </div>

      {/* Reset Form (Right Side) */}
      <div className="w-full md:w-1/2 p-8 md:p-12 lg:p-20 flex flex-col justify-center bg-[#fafafa]">
        <div className="max-w-md mx-auto w-full bg-white p-8 rounded-[12px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 animate-[fadeInPage_250ms_ease-out]">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            ACCOUNT RECOVERY
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-[#111111] mb-8">
            Create new password
          </h2>

          {isSuccess ? (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h3 className="text-xl font-bold text-[#111111]">Password Updated</h3>
              <p className="text-gray-600 text-sm">
                Your password has been reset successfully. You can now log in with your new password.
              </p>
              <Button onClick={navigateToLogin} className="mt-4 w-full">
                Return to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="New Password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setErrors(prev => ({ ...prev, password: undefined })); }}
                error={errors.password}
              />

              <Input
                label="Confirm Password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setErrors(prev => ({ ...prev, confirmPassword: undefined })); }}
                error={errors.confirmPassword}
              />

              {errors.general && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 font-medium">
                  {errors.general}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                isLoading={isLoading}
                disabled={isLoading}
              >
                Reset Password
              </Button>
              
              <div className="pt-4 text-center">
                <button
                  type="button"
                  onClick={navigateToLogin}
                  className="text-sm font-medium text-gray-500 hover:text-[#111111] transition-colors cursor-pointer"
                >
                  Back to login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
