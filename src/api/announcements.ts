/**
 * ANNOUNCEMENTS SERVICE — MySQL (via PHP backend)
 */

import { apiFetch } from './httpClient';
import type { AnnouncementDTO, Announcement } from '../types';

export const announcementsApi = {
  async fetchAnnouncements(_userId: string): Promise<AnnouncementDTO[]> {
    try {
      const res = await apiFetch('/api/announcements');
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error('[fetchAnnouncements]', e);
      return [];
    }
  },

  async toggleReaction(announcementId: string, _userId: string, emojiType: string): Promise<AnnouncementDTO[]> {
    try {
      const res = await apiFetch(`/api/announcements/${announcementId}/react`, {
        method: 'POST',
        body: JSON.stringify({ emojiType }),
      });
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error('[toggleReaction]', e);
      return [];
    }
  },

  async markAsRead(announcementId: string, _userId: string): Promise<AnnouncementDTO[]> {
    try {
      const res = await apiFetch(`/api/announcements/${announcementId}/read`, {
        method: 'POST',
      });
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error('[markAsRead]', e);
      return [];
    }
  },

  async createAnnouncement(
    announcement: Omit<Announcement, 'id' | 'created_at'>,
    _userId: string
  ): Promise<AnnouncementDTO[]> {
    try {
      const res = await apiFetch('/api/announcements', {
        method: 'POST',
        body: JSON.stringify({
          title: announcement.title,
          content: announcement.content,
          author_role: announcement.author_role,
          type: announcement.type,
        }),
      });
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error('[createAnnouncement]', e);
      return [];
    }
  },

  async deleteAnnouncement(announcementId: string, _userId: string): Promise<AnnouncementDTO[]> {
    try {
      const res = await apiFetch(`/api/announcements/${announcementId}`, { method: 'DELETE' });
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error('[deleteAnnouncement]', e);
      return [];
    }
  },

  _getData() { return { announcements: [], reactions: [], reads: [] }; },
  _saveData() {},
};