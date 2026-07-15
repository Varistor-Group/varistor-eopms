import React, { useState, useEffect, useCallback } from 'react';
import { Input } from './shared/Input';
import { Button } from './shared/Button';
import { Modal } from './shared/Modal';
import { mockLogin, sendPasswordReset } from '../api/auth';
import { useVariPoints } from '../hooks/useVariPoints';
import type { CurrentUser } from '../context/EopmsContext';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLogin: (isFirstLogin: boolean, user: CurrentUser) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { setCurrentRole, setCurrentUser } = useVariPoints();

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  // Rate-limit countdown display
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // Forgot password modal
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);


  // Lockout countdown tick
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const t = setInterval(() => setLockoutSeconds(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [lockoutSeconds]);

  const validateForm = useCallback(() => {
    const errs: typeof errors = {};
    if (!email) errs.email = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Please enter a valid email.';
    if (!password) errs.password = 'Password is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [email, password]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const { user, error } = await mockLogin(email, password);

      if (error) {
        // Extract lockout seconds from error message if present
        const match = error.match(/wait (\d+)s/);
        if (match) setLockoutSeconds(parseInt(match[1], 10));
        setErrors({ general: error });
        setIsLoading(false);
        return;
      }

      if (user) {
        setCurrentRole(user.role);
        const loggedInUser: CurrentUser = {
          id: user.id,
          name: user.name,
          email: user.email,
          department: user.department,
          avatarUrl: user.avatarUrl,
          role: user.role,
          dob: user.role === 'Admin' ? new Date().toISOString().split('T')[0] : undefined, // Test DOB for Admin
        };
        setCurrentUser(loggedInUser);
        const isFirstLogin = !localStorage.getItem('eopms_first_login_done');
        if (isFirstLogin) {
          localStorage.setItem('eopms_first_login_done', 'true');
        }
        onLogin(isFirstLogin, loggedInUser);
      }
    } catch {
      setErrors({ general: 'An unexpected error occurred. Please try again.' });
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);
    setResetMessage('');
    setResetSuccess(false);

    try {
      const result = await sendPasswordReset(resetEmail);
      if (result.error || !result.success) {
        setResetMessage(result.error || 'An error occurred while sending the reset link.');
        setResetSuccess(false);
      } else if (result.message) {
        setResetMessage(result.message);
        setResetSuccess(true);
        // Do not reset email so user sees they submitted it, or we could reset it
      }
    } catch {
      setResetMessage('An error occurred while sending the reset link.');
    } finally {
      setIsResetting(false);
    }
  };

  const closeForgotModal = () => {
    setIsForgotModalOpen(false);
    setResetMessage('');
    setResetEmail('');
    setResetSuccess(false);
  };

  return (
    <div className="force-light min-h-screen flex flex-col md:flex-row bg-white w-full">

      {/* Brand Panel (Left Side) */}
      <div className="w-full md:w-1/2 bg-brand-lime p-8 md:p-12 lg:p-20 flex flex-col justify-between">
        <div className="max-w-md mx-auto md:mx-0 w-full">
          <div className="mb-8">
            <div className="inline-block bg-brand-ink p-3 md:p-4 rounded-[16px] shadow-sm border border-brand-ink/20">
              <img src="/logo.png" alt="Varistor Logo" className="h-8 md:h-10 w-auto object-contain block bg-black dark:bg-transparent rounded p-1" />
            </div>
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

        {/* About Us — bottom-left, desktop only */}
        <div className="hidden md:block max-w-md mx-auto md:mx-0 w-full mt-12">
          <div className="bg-white/90 backdrop-blur-sm rounded-[14px] px-5 py-4 shadow-[0_4px_16px_rgba(0,0,0,0.10)] border border-white/50">
            <p className="text-[10px] font-bold text-varistor-muted uppercase tracking-widest mb-2.5">About Us</p>

            <p className="text-sm font-medium text-varistor-dark leading-snug mb-3">
              Varistor Technologies — powering operations across every team, every day.
            </p>

            <a
              href="https://www.varistor.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-ink hover:text-brand-ink/70 transition-colors duration-150"
            >
              Know More
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.5 9.5L9.5 2.5M9.5 2.5H4.5M9.5 2.5V7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>
        </div>
      </div>

      {/* Sign-in Form (Right Side) */}
      <div className="w-full md:w-1/2 p-8 md:p-12 lg:p-20 flex flex-col justify-center bg-varistor-pageBg">
        <div className="max-w-md mx-auto w-full">

          {/* Sign-in Card */}
          <div className="bg-white p-8 rounded-[12px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-gray-100 animate-[fadeInPage_250ms_ease-out]">
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
                onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: undefined })); }}
                error={errors.email}
                autoComplete="email"
                disabled={lockoutSeconds > 0}
              />

              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors(prev => ({ ...prev, password: undefined })); }}
                error={errors.password}
                autoComplete="current-password"
                disabled={lockoutSeconds > 0}
                rightElement={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 hover:text-gray-700 focus:outline-none transition-colors"
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
              />

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-gray-300 text-brand-lime focus:ring-brand-lime/50 cursor-pointer"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="text-sm font-medium text-gray-600">Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => setIsForgotModalOpen(true)}
                  className="text-sm font-medium text-brand-lime hover:text-[#92cc2e] transition-colors cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              {errors.general && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 font-medium">
                  {errors.general}
                </div>
              )}

              {lockoutSeconds > 0 && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700 font-medium">
                  🔒 Account locked. Try again in {lockoutSeconds}s.
                </div>
              )}

              <Button
                type="submit"
                className="w-full mt-6 py-3 text-base"
                isLoading={isLoading}
                disabled={lockoutSeconds > 0}
              >
                {lockoutSeconds > 0 ? `Locked (${lockoutSeconds}s)` : 'Log in'}
              </Button>
            </form>

            <p className="text-center text-xs text-gray-500 mt-8 font-medium">
              Need access? Contact HR / Admin
            </p>
          </div>{/* end sign-in card */}

        </div>{/* end space-y-5 wrapper */}
      </div>{/* end right panel */}

      {/* ── Forgot Password Modal ── */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={closeForgotModal}
        title="Reset your password"
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <p className="text-sm text-varistor-muted">
            Enter your work email address and we'll send a secure one-time reset link.
          </p>

          <Input
            label="Work Email"
            type="email"
            placeholder="you@varistor.in"
            value={resetEmail}
            onChange={e => {
              setResetEmail(e.target.value);
              setResetMessage('');
              setResetSuccess(false);
            }}
            autoComplete="email"
            required
          />

          {resetMessage && resetSuccess && (
            <div className="p-3 rounded-lg text-sm font-medium bg-varistor-limeTint text-varistor-dark border border-[#c3f0a0] flex items-center gap-2">
              <ShieldCheck size={18} className="text-varistor-limeText flex-shrink-0" />
              {resetMessage}
            </div>
          )}

          {resetMessage && !resetSuccess && (
            <div className="p-3 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-100">
              {resetMessage}
            </div>
          )}

          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={closeForgotModal}>
              Close
            </Button>
            <Button type="submit" isLoading={isResetting}>
              Send reset link
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
