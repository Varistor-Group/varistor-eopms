/**
 * POLICY SERVICE — Supabase
 * Replaces the Express server-backed mock.
 */

import { supabase } from '../lib/supabase';

export type PolicyTarget = 'Field' | 'Office' | 'Both';

export interface Policy {
  id: string;
  title: string;
  target: PolicyTarget;
  content: string;       // pipe-separated bullet points
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
  const { data, error } = await supabase
    .from('policies')
    .select('*')
    .order('effective_date', { ascending: false });
  if (error) { console.error('[getPolicies]', error.message); return []; }
  return (data ?? []).map(rowToPolicy);
}

export async function addPolicy(
  data: Omit<Policy, 'id' | 'createdAt' | 'updatedAt'>
): Promise<{ success: boolean; policy?: Policy; error: string | null }> {
  const { data: row, error } = await supabase
    .from('policies')
    .insert({
      title: data.title,
      target: data.target,
      content: data.content,
      effective_date: data.effectiveDate,
    })
    .select()
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, policy: rowToPolicy(row), error: null };
}

export async function updatePolicy(
  id: string,
  data: Partial<Omit<Policy, 'id'>>
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase.from('policies').update({
    ...(data.title !== undefined && { title: data.title }),
    ...(data.target !== undefined && { target: data.target }),
    ...(data.content !== undefined && { content: data.content }),
    ...(data.effectiveDate !== undefined && { effective_date: data.effectiveDate }),
  }).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function deletePolicy(id: string): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase.from('policies').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

// Legacy stubs kept for backwards compatibility
export async function getMockPolicy(): Promise<string> { return ''; }
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function saveMockPolicy(_html: string): Promise<{ success: boolean; error: string | null }> {
  return { success: true, error: null };
}
