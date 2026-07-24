/**
 * POLICY SERVICE — MySQL (via PHP backend)
 */

import { apiFetch } from './httpClient';

export type PolicyTarget = 'Field' | 'Office' | 'Both';

export interface Policy {
  id: string;
  title: string;
  target: PolicyTarget;
  content: string;
  effectiveDate: string;
  createdAt?: string;
  updatedAt?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPolicy(row: any): Policy {
  return {
    id: row.id,
    title: row.title,
    target: row.target as PolicyTarget,
    content: row.content,
    effectiveDate: row.effective_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getPolicies(): Promise<Policy[]> {
  try {
    const res = await apiFetch('/api/policies');
    if (!res.ok) return [];
    const rows = await res.json();
    return (rows ?? []).map(rowToPolicy);
  } catch (e) {
    console.error('[getPolicies]', e);
    return [];
  }
}

export async function addPolicy(
  data: Omit<Policy, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{ success: boolean; policy?: Policy; error: string | null }> {
  try {
    const res = await apiFetch('/api/policies', {
      method: 'POST',
      body: JSON.stringify({
        title: data.title,
        target: data.target,
        content: data.content,
        effectiveDate: data.effectiveDate,
      }),
    });
    const result = await res.json().catch(() => null);
    if (!res.ok || !result?.success) {
      return { success: false, error: result?.error || 'Failed to create policy.' };
    }
    return { success: true, policy: rowToPolicy(result.policy), error: null };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function updatePolicy(
  id: string,
  data: Partial<Omit<Policy, 'id'>>
): Promise<{ success: boolean; error: string | null }> {
  try {
    const body: Record<string, unknown> = {};
    if (data.title !== undefined) body.title = data.title;
    if (data.target !== undefined) body.target = data.target;
    if (data.content !== undefined) body.content = data.content;
    if (data.effectiveDate !== undefined) body.effectiveDate = data.effectiveDate;

    const res = await apiFetch(`/api/policies/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    const result = await res.json().catch(() => null);
    if (!res.ok || !result?.success) {
      return { success: false, error: result?.error || 'Failed to update policy.' };
    }
    return { success: true, error: null };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function deletePolicy(id: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const res = await apiFetch(`/api/policies/${id}`, { method: 'DELETE' });
    const result = await res.json().catch(() => null);
    if (!res.ok || !result?.success) {
      return { success: false, error: result?.error || 'Failed to delete policy.' };
    }
    return { success: true, error: null };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Legacy stubs kept for backwards compatibility
export async function getMockPolicy(): Promise<string> { return ''; }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function saveMockPolicy(_html: string): Promise<{ success: boolean; error: string | null }> {
  return { success: true, error: null };
}