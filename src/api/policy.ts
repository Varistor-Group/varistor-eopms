/**
 * MOCK POLICY SERVICE
 *
 * TODO: Replace with real Supabase implementation:
 *  supabase.from('policies').select('*').order('effectiveDate', { ascending: false })
 *  supabase.from('policies').insert({ ... })
 *  supabase.from('policies').update({ ... }).eq('id', id)
 *  supabase.from('policies').delete().eq('id', id)
 */

export type PolicySeverity = 'mandatory' | 'standard' | 'advisory';
export type PolicyCategory = 'HR' | 'Operations' | 'Legal' | 'IT' | 'Finance' | 'General';

export interface Policy {
  id: string;
  title: string;
  category: PolicyCategory;
  severity: PolicySeverity;
  content: string;       // pipe-separated bullet points, e.g. "Rule 1|Rule 2|Rule 3"
  effectiveDate: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function getPolicies(): Promise<Policy[]> {
  try {
    const res = await fetch('http://localhost:3001/api/policies');
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch policies', err);
    return [];
  }
}

export async function addPolicy(
  data: Omit<Policy, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{ success: boolean; policy?: Policy; error: string | null }> {
  try {
    const res = await fetch('http://localhost:3001/api/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    return { success: result.success, policy: result.policy, error: result.error || null };
  } catch (err) {
    console.error('Failed to add policy', err);
    return { success: false, error: 'Server unreachable.' };
  }
}

export async function updatePolicy(
  id: string,
  data: Partial<Omit<Policy, 'id'>>
): Promise<{ success: boolean; error: string | null }> {
  try {
    const res = await fetch(`http://localhost:3001/api/policies/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const result = await res.json();
    return { success: result.success, error: result.error || null };
  } catch (err) {
    console.error('Failed to update policy', err);
    return { success: false, error: 'Server unreachable.' };
  }
}

export async function deletePolicy(id: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const res = await fetch(`http://localhost:3001/api/policies/${id}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    return { success: result.success, error: result.error || null };
  } catch (err) {
    console.error('Failed to delete policy', err);
    return { success: false, error: 'Server unreachable.' };
  }
}

// Legacy — kept for backwards compatibility with old server endpoint
export async function getMockPolicy(): Promise<string> { return ''; }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function saveMockPolicy(_html: string): Promise<{ success: boolean; error: string | null }> {
  return { success: true, error: null };
}
