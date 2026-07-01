import type { UserRole } from '../types';

/**
 * MOCK AUTHENTICATION SERVICE
 *
 * TODO: Replace with real Supabase Auth implementation.
 * Expected return shape: { user: { id, email, role, name } | null, error: string | null }
 *
 * Security features implemented (mock):
 * - Generic error messages (no email enumeration)
 * - Rate limiting (max 5 attempts → 30 s lockout)
 * - Password-stripped response object
 */

const MOCK_USERS = [
  {
    id: 'VAR-001',
    email: 'admin@varistor.in',
    password: 'Admin@2026!',
    role: 'Admin' as UserRole,
    name: 'Admin User',
    department: 'Management',
    avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&fit=crop&q=60',
  },
  {
    id: 'VAR-024',
    email: 'employee@varistor.in',
    password: 'Employee@2026!',
    role: 'Employee' as UserRole,
    name: 'Aarav Patel',
    department: 'Operations',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60',
  },
  {
    id: 'VAR-003',
    email: 'hr@varistor.in',
    password: 'Hr@2026!',
    role: 'HR' as UserRole,
    name: 'Priya Sharma',
    department: 'Human Resources',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&fit=crop&q=60',
  },
];

// In-memory rate limiter: { email -> { count, lockedUntil } }
const loginAttempts: Record<string, { count: number; lockedUntil: number }> = {};
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000; // 30 seconds

export async function mockLogin(email: string, password: string) {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  if (!email || !password) {
    return { user: null, error: 'Email and password are required.' };
  }

  // --- Rate limiting check ---
  const now = Date.now();
  const attempt = loginAttempts[email];
  if (attempt && attempt.lockedUntil > now) {
    const secsLeft = Math.ceil((attempt.lockedUntil - now) / 1000);
    return {
      user: null,
      error: `Too many failed attempts. Please wait ${secsLeft}s before trying again.`,
    };
  }

  // --- Credential check ---
  const user = MOCK_USERS.find(u => u.email === email);
  const isValid = user && user.password === password;

  if (!isValid) {
    // Increment attempt counter
    const prev = loginAttempts[email] ?? { count: 0, lockedUntil: 0 };
    const newCount = prev.count + 1;
    loginAttempts[email] = {
      count: newCount,
      lockedUntil: newCount >= MAX_ATTEMPTS ? now + LOCKOUT_MS : 0,
    };

    const remaining = MAX_ATTEMPTS - newCount;
    const suffix =
      newCount >= MAX_ATTEMPTS
        ? ' Account temporarily locked for 30 seconds.'
        : remaining > 0
          ? ` ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : '';

    return { user: null, error: `Invalid email or password.${suffix}` };
  }

  // Clear attempts on success
  delete loginAttempts[email];

  // Strip password from returned object
  const { password: _pw, ...secureUser } = user;
  return { user: secureUser, error: null };
}

export async function mockResetPassword(email: string) {
  await new Promise(resolve => setTimeout(resolve, 600));

  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  // Security: always return success (prevents email enumeration)
  return {
    success: true,
    message: 'If an account exists with this email, a reset link has been sent.',
  };
}

export async function sendPasswordReset(email: string) {
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  try {
    const res = await fetch('http://localhost:3001/api/send-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const result = await res.json();
    if (!result.success) {
      return { success: false, error: result.error || 'Failed to send reset link.' };
    }
    return {
      success: true,
      message: 'Reset link sent — check your inbox',
    };
  } catch (err) {
    return { success: false, error: 'Email server unreachable.' };
  }
}
