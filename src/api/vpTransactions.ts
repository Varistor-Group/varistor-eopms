import { apiFetch } from './httpClient';

export interface VpTransaction {
  id: string;
  admin_id: string;
  recipient_id: string;
  points: number;
  type: 'credit' | 'debit';
  reason: string;
  created_at: string;
  admin_name?: string;
  recipient_name?: string;
}

export async function awardPoints(
  recipientId: string,
  points: number,
  type: 'credit' | 'debit',
  reason: string
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  try {
    const res = await apiFetch('/api/vp-transactions', {
      method: 'POST',
      body: JSON.stringify({ recipientId, points, type, reason }),
    });
    const result = await res.json().catch(() => null);
    if (!res.ok || !result?.success) return { success: false, error: result?.error || 'Failed to process points.' };
    return { success: true, newBalance: result.newBalance };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to process points.' };
  }
}

export async function getPointsHistory(employeeId: string): Promise<VpTransaction[]> {
  try {
    const res = await apiFetch(`/api/vp-transactions/${employeeId}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function getAllPointsHistory(): Promise<VpTransaction[]> {
  try {
    const res = await apiFetch('/api/vp-transactions');
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}