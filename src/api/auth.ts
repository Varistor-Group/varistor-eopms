/**
 * AUTH SERVICE — Supabase Auth
 * Replaces the mock authentication system.
 */

import { supabase } from '../lib/supabase';
import type { UserRole } from '../types';

export interface AuthUser {
  id: string;          // employees.id e.g. "VAR-001"
  name: string;
  email: string;
  department: string;
  avatarUrl: string;
  role: UserRole;
}

// ─── Rate limiter (client-side, mirrors previous mock behaviour) ──────────────

const loginAttempts: Record<string, { count: number; lockedUntil: number }> = {};
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

// ─── Login ────────────────────────────────────────────────────────────────────

export async function mockLogin(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
  if (!email || !password) {
    return { user: null, error: 'Email and password are required.' };
  }

  // Rate limit check
  const now = Date.now();
  const attempt = loginAttempts[email];
  if (attempt?.lockedUntil > now) {
    const secsLeft = Math.ceil((attempt.lockedUntil - now) / 1000);
    return { user: null, error: `Too many failed attempts. Please wait ${secsLeft}s before trying again.` };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    // Increment attempts
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

  delete loginAttempts[email];

  // Load the employee profile for this auth user
  const { data: emp, error: empError } = await supabase
    .from('employees')
    .select('id, full_name, personal_email, department, role, avatar_url')
    .eq('auth_id', data.user.id)
    .single();

  if (empError || !emp) {
    await supabase.auth.signOut();
    return { user: null, error: 'Employee profile not found. Contact your administrator.' };
  }

  return {
    user: {
      id: emp.id,
      name: emp.full_name,
      email: emp.personal_email,
      department: emp.department ?? '',
      avatarUrl: emp.avatar_url ?? '',
      role: emp.role as UserRole,
    },
    error: null,
  };
}

// ─── Sign Out ─────────────────────────────────────────────────────────────────

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

// ─── Get Current Session ──────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<AuthUser | null> {
  const { data } = await supabase.auth.getSession();
  if (!data.session?.user) return null;

  const { data: emp } = await supabase
    .from('employees')
    .select('id, full_name, personal_email, department, role, avatar_url')
    .eq('auth_id', data.session.user.id)
    .single();

  if (!emp) return null;

  return {
    id: emp.id,
    name: emp.full_name,
    email: emp.personal_email,
    department: emp.department ?? '',
    avatarUrl: emp.avatar_url ?? '',
    role: emp.role as UserRole,
  };
}

// ─── Password Reset ───────────────────────────────────────────────────────────

export async function mockResetPassword(email: string): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  // Security: always return success to prevent email enumeration
  return {
    success: true,
    message: 'If an account exists with this email, a reset link has been sent.',
  };
}

export async function sendPasswordReset(email: string): Promise<{ success: boolean; error?: string; message?: string }> {
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    console.error('Password reset error:', error);
    return { success: false, error: `Failed to send reset link: ${error.message}` };
  }

  return { success: true, message: 'Reset link sent — check your inbox' };
}

export async function updatePassword(password: string): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true };
}

// ─── Auth state change listener ───────────────────────────────────────────────

export function onAuthStateChange(callback: (user: AuthUser | null) => void) {
  return supabase.auth.onAuthStateChange(async (_event, session) => {
    if (!session?.user) {
      callback(null);
      return;
    }
    const { data: emp } = await supabase
      .from('employees')
      .select('id, full_name, personal_email, department, role, avatar_url')
      .eq('auth_id', session.user.id)
      .single();

    if (emp) {
      callback({
        id: emp.id,
        name: emp.full_name,
        email: emp.personal_email,
        department: emp.department ?? '',
        avatarUrl: emp.avatar_url ?? '',
        role: emp.role as UserRole,
      });
    } else {
      callback(null);
    }
  });
}
