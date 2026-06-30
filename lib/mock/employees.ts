/**
 * MOCK EMPLOYEES SERVICE
 * 
 * TODO: Replace with real Supabase Auth + Database inserts.
 */

export async function createEmployee(data: any) {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // In a real app, this would:
  // 1. Generate temp password
  // 2. Insert into auth.users (Supabase)
  // 3. Insert into public.employees
  // 4. Trigger email via Resend/Sendgrid
  
  console.log('[Mock DB] Created employee:', data);
  
  return {
    success: true,
    user: {
      id: `VAR-0${Math.floor(Math.random() * 100) + 40}`,
      ...data
    }
  };
}
