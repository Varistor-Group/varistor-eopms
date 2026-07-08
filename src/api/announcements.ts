/**
 * ANNOUNCEMENTS SERVICE — Supabase
 * Replaces the localStorage-backed store.
 */

import { supabase } from '../lib/supabase';
import type { Announcement, AnnouncementDTO } from '../types';

const EMOJIS = ['👍', '❤️', '🎉', '💵', '🎂'];

// ─── Fetch ────────────────────────────────────────────────────────────────────

export const announcementsApi = {
  async fetchAnnouncements(userId: string): Promise<AnnouncementDTO[]> {
    const [{ data: anns }, { data: reactions }, { data: reads }] = await Promise.all([
      supabase.from('announcements').select('*').order('created_at', { ascending: false }),
      supabase.from('announcement_reactions').select('*'),
      supabase.from('announcement_reads').select('*').eq('user_id', userId),
    ]);

    return (anns ?? []).map(ann => {
      const annReactions = (reactions ?? []).filter(r => r.announcement_id === ann.id);
      const countsMap: Record<string, number> = {};
      annReactions.forEach(r => { countsMap[r.emoji_type] = (countsMap[r.emoji_type] || 0) + 1; });
      const userReacted = new Set(annReactions.filter(r => r.user_id === userId).map(r => r.emoji_type));
      const uniqueEmojis = Array.from(new Set([...EMOJIS, ...Object.keys(countsMap)]));
      const isRead = (reads ?? []).some(r => r.announcement_id === ann.id);

      return {
        ...ann,
        author_role: ann.author_role as 'HR' | 'Admin',
        type: ann.type as 'Standard' | 'Birthday' | 'Policy',
        reactions: uniqueEmojis.map(emoji => ({ emoji, count: countsMap[emoji] || 0, reactedByUser: userReacted.has(emoji) })),
        isRead,
      };
    });
  },

  // ─── React ──────────────────────────────────────────────────────────────────

  async toggleReaction(announcementId: string, userId: string, emojiType: string): Promise<AnnouncementDTO[]> {
    const { data: existing } = await supabase
      .from('announcement_reactions')
      .select('id')
      .eq('announcement_id', announcementId)
      .eq('user_id', userId)
      .eq('emoji_type', emojiType)
      .single();

    if (existing) {
      await supabase.from('announcement_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('announcement_reactions').insert({ announcement_id: announcementId, user_id: userId, emoji_type: emojiType });
    }
    return this.fetchAnnouncements(userId);
  },

  // ─── Mark as read ────────────────────────────────────────────────────────────

  async markAsRead(announcementId: string, userId: string): Promise<AnnouncementDTO[]> {
    await supabase.from('announcement_reads').upsert(
      { announcement_id: announcementId, user_id: userId },
      { onConflict: 'announcement_id,user_id', ignoreDuplicates: true }
    );
    return this.fetchAnnouncements(userId);
  },

  // ─── Create ──────────────────────────────────────────────────────────────────

  async createAnnouncement(
    announcement: Omit<Announcement, 'id' | 'created_at'>,
    userId: string
  ): Promise<AnnouncementDTO[]> {
    const { data: newAnn, error } = await supabase
      .from('announcements')
      .insert({
        title: announcement.title,
        content: announcement.content,
        author_role: announcement.author_role,
        type: announcement.type,
      })
      .select()
      .single();

    if (error || !newAnn) {
      console.error('[createAnnouncement]', error?.message);
      return this.fetchAnnouncements(userId);
    }

    // Auto mark as read for creator
    await supabase.from('announcement_reads').upsert(
      { announcement_id: newAnn.id, user_id: userId },
      { onConflict: 'announcement_id,user_id', ignoreDuplicates: true }
    );

    return this.fetchAnnouncements(userId);
  },

  // ─── Delete ──────────────────────────────────────────────────────────────────

  async deleteAnnouncement(announcementId: string, userId: string): Promise<AnnouncementDTO[]> {
    await supabase.from('announcements').delete().eq('id', announcementId);
    return this.fetchAnnouncements(userId);
  },

  // ─── Legacy helpers (kept for backwards compat) ──────────────────────────────

  _getData() { return { announcements: [], reactions: [], reads: [] }; },
  _saveData() { /* no-op — data lives in Supabase */ },
};
