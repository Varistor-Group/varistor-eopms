'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/shared/Input';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import { mockLogin, mockResetPassword } from '@/lib/mock/auth';

export default function LoginScreen() {
  const router = useRouter();
  
  // Login Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Validation Errors State
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  
  // Forgot Password Modal State
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  const validateForm = () => {
    const newErrors: typeof errors = {};
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (!password) {
      newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setIsLoading(true);
    setErrors({});
    
    try {
      const { user, error } = await mockLogin(email, password);
      
      if (error) {
        setErrors({ general: error });
        setIsLoading(false);
        return;
      }
      
      if (user) {
        // Securely handle routing based on role
        if (user.role === 'admin' || user.role === 'hr') {
          router.push('/admin');
        } else {
          router.push('/dashboard');
        }
      }
    } catch (err) {
      setErrors({ general: 'An unexpected error occurred. Please try again later.' });
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);
    setResetMessage('');
    
    try {
      const { message, error } = await mockResetPassword(resetEmail);
      if (error) {
        setResetMessage(error);
      } else if (message) {
        setResetMessage(message);
        // Clear email after success
        setResetEmail('');
      }
    } catch (err) {
      setResetMessage('An error occurred while sending the reset link.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-white">
      {/* Brand Panel (Left Side) */}
      <div className="w-full md:w-1/2 bg-brand-lime p-8 md:p-12 lg:p-20 flex flex-col justify-center">
        <div className="max-w-md mx-auto md:mx-0 w-full">
          <div className="mb-8">
            <img src="/logo.svg" alt="Varistor Logo" className="h-12 w-auto object-contain" />
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-brand-ink leading-tight mb-4">
            One platform.<br />
            Every team. Every day.
          </h1>
          <p className="text-brand-ink/80 text-sm md:text-base font-medium flex flex-wrap gap-2 md:gap-3 items-center">
            <span>Training</span>
            <span className="w-1 h-1 bg-brand-ink/40 rounded-full" />
            <span>Tasks</span>
            <span className="w-1 h-1 bg-brand-ink/40 rounded-full" />
            <span>Vari Points</span>
            <span className="w-1 h-1 bg-brand-ink/40 rounded-full" />
            <span>Payroll</span>
            <span className="w-1 h-1 bg-brand-ink/40 rounded-full" />
            <span>Chat</span>
          </p>
        </div>
      </div>

      {/* Sign-in Form (Right Side) */}
      <div className="w-full md:w-1/2 p-8 md:p-12 lg:p-20 flex flex-col justify-center bg-[#fafafa]">
        <div className="max-w-md mx-auto w-full bg-white p-8 rounded-[12px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            SIGN IN
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-brand-ink mb-8">
            Welcome back
          </h2>

          <form onSubmit={handleLogin} className="space-y-5">
            <Input
              label="Email Address"
              type="email"
              placeholder="employee@varistor.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              autoComplete="email"
            />
            
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              autoComplete="current-password"
            />

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-brand-lime focus:ring-brand-lime/50"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="text-sm font-medium text-gray-600">Remember me</span>
              </label>
              
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                className="text-sm font-medium text-brand-lime hover:text-[#92cc2e] transition-colors"
              >
                Forgot password?
              </button>
            </div>

            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 font-medium">
                {errors.general}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full mt-6 py-3 text-base"
              isLoading={isLoading}
            >
              Log in
            </Button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-8 font-medium">
            Need access? Contact HR / Admin
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => {
          setIsForgotModalOpen(false);
          setResetMessage('');
          setResetEmail('');
        }}
        title="Reset Password"
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            Enter your email address and we'll send you a secure link to reset your password.
          </p>
          
          <Input
            label="Email Address"
            type="email"
            placeholder="employee@varistor.in"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            autoComplete="email"
            required
          />

          {resetMessage && (
            <div className={`p-3 rounded-lg text-sm font-medium ${
              resetMessage.includes('error') || resetMessage.includes('valid')
                ? 'bg-red-50 text-red-600 border border-red-100'
                : 'bg-brand-lime-tint text-brand-ink border border-[#dcf0a8]'
            }`}>
              {resetMessage}
            </div>
          )}

          <div className="pt-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsForgotModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isResetting}
            >
              Send reset link
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
