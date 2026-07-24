/**
 * AUTH SERVICE — PHP/MySQL backend (fully off Supabase)
 */

import type { UserRole } from '../types';
import { API_URL } from '../config/api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  department: string;
  avatarUrl: string;
  role: UserRole;
  is_field_employee?: boolean;
}

const loginAttempts: Record<string, { count: number; lockedUntil: number }> = {};
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('eopms_auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function mockLogin(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
  if (!email || !password) {
    return { user: null, error: 'Email and password are required.' };
  }

  const now = Date.now();
  const attempt = loginAttempts[email];
  if (attempt?.lockedUntil > now) {
    const secsLeft = Math.ceil((attempt.lockedUntil - now) / 1000);
    return { user: null, error: `Too many failed attempts. Please wait ${secsLeft}s before trying again.` };
  }

  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
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
      return { user: null, error: `${data?.error || 'Invalid email or password.'}${suffix}` };
    }

    delete loginAttempts[email];
    localStorage.setItem('eopms_auth_token', data.token);
    window.dispatchEvent(new Event('eopms-auth-change'));

    return { user: data.user as AuthUser, error: null };
  } catch {
    return { user: null, error: 'Unable to reach the server. Please try again.' };
  }
}

export async function signOut(): Promise<void> {
  localStorage.removeItem('eopms_auth_token');
  window.dispatchEvent(new Event('eopms-auth-change'));
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = localStorage.getItem('eopms_auth_token');
  if (!token) return null;

  try {
    const res = await fetch(`${API_URL}/api/auth/me`, { headers: authHeaders() });
    if (!res.ok) {
      localStorage.removeItem('eopms_auth_token');
      return null;
    }
    const data = await res.json();
    return data.user as AuthUser;
  } catch {
    return null;
  }
}

export async function mockResetPassword(email: string): Promise<{ success: boolean; error?: string; message?: string }> {
  return sendPasswordReset(email);
}

export async function sendPasswordReset(email: string): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  try {
    const res = await fetch(`${API_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => null);
    if (res.ok && data?.success) {
      return { success: true, message: data.message || 'If an account exists with this email, a new password has been sent.' };
    }
    return { success: false, error: data?.error || 'Could not process reset request.' };
  } catch {
    return { success: false, error: 'Unable to reach the server. Please try again.' };
  }
}

export async function updatePassword(password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/auth/update-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success) {
      return { success: false, error: data?.error || 'Failed to update password.' };
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Unable to reach the server. Please try again.' };
  }
}

// Replaces Supabase's onAuthStateChange — same callback shape/return value
// so existing callers don't need to change, just backed by our own token
// + a custom event fired on login/logout, plus cross-tab sync via 'storage'.
export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  const handler = async () => {
    const user = await getCurrentUser();
    callback(user);
  };

  window.addEventListener('eopms-auth-change', handler);
  window.addEventListener('storage', (e) => {
    if (e.key === 'eopms_auth_token') handler();
  });

  // Fire once immediately, mirroring Supabase's initial callback behavior
  handler();

  return {
    data: {
      subscription: {
        unsubscribe() {
          window.removeEventListener('eopms-auth-change', handler);
        },
      },
    },
  };
}