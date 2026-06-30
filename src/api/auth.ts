import type { UserRole } from '../types';

/**
 * MOCK AUTHENTICATION SERVICE
 * 
 * TODO: Replace with real Supabase Auth implementation.
 */

const MOCK_USERS = [
  {
    id: 'VAR-001',
    email: 'admin@varistor.in',
    password: 'password123',
    role: 'Admin' as UserRole,
    name: 'Admin User'
  },
  {
    id: 'VAR-024',
    email: 'employee@varistor.in',
    password: 'password123',
    role: 'Employee' as UserRole,
    name: 'Aarav Patel'
  }
];

export async function mockLogin(email: string, password: string) {
  // Simulate network delay to make it feel like a real API
  await new Promise(resolve => setTimeout(resolve, 800));

  // Basic validation (simulating server-side validation)
  if (!email || !password) {
    return { user: null, error: 'Email and password are required' };
  }

  // Simulate secure lookup
  const user = MOCK_USERS.find(u => u.email === email);
  
  if (!user) {
    // Return generic error message for security (don't reveal if email exists)
    return { user: null, error: 'Invalid email or password' };
  }

  // In a real app, this would use bcrypt.compare or similar
  if (user.password !== password) {
    return { user: null, error: 'Invalid email or password' };
  }

  // Return the user without the password field
  const { password: _, ...secureUser } = user;
  
  return { 
    user: secureUser, 
    error: null 
  };
}

export async function mockResetPassword(email: string) {
  await new Promise(resolve => setTimeout(resolve, 600));
  
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Please enter a valid email address' };
  }
  
  // Security best practice: Always return success even if email doesn't exist 
  // to prevent email enumeration attacks
  return { 
    success: true, 
    message: 'If an account exists with this email, a reset link has been sent.' 
  };
}
