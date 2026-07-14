/**
 * VP (Vacation Points) Audit Log API
 */
import { supabase } from '../lib/supabase';


export interface VpAuditLog {
  id: string;
  admin_id: string;
  recipient_id?: string;
  points: number;
  type: 'credit' | 'debit';
  reason: string;
  created_at: string;
}

export const vpAuditApi = {
  async logTransaction(
    adminId: string,
    points: number,
    type: 'credit' | 'debit',
    reason: string,
    recipientId?: string
  ): Promise<VpAuditLog | null> {
    const { data, error } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('vp_audit_log' as any)
      .insert({
        admin_id: adminId,
        recipient_id: recipientId,
        points,
        type,
        reason
      })
      .select()
      .single();

    if (error) {
      console.error('[logVpTransaction] Error:', error);
      return null;
    }
    return data as unknown as VpAuditLog;
  },

  async getLogs(): Promise<VpAuditLog[]> {
    const { data, error } = await supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('vp_audit_log' as any)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[getVpAuditLogs] Error:', error);
      return [];
    }
    return (data as unknown as VpAuditLog[]) || [];
  }
};
