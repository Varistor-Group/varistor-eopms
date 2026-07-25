/**
 * CHAT SERVICE — MySQL (via PHP backend)
 * Was previously 100% localStorage/mock — now real, shared, multi-user chat.
 * NOTE: no realtime push — callers should poll fetchMessages/getUnreadSummary
 * periodically. Attachment file upload is NOT implemented (Task 3 scope) —
 * only attachment metadata (name/size/type) is stored, no actual file data.
 */

import type { ChatChannel, ChatMessage, ChannelId } from '../types';
import { apiFetch } from './httpClient';

const CHAT_EVENT = 'varistor-chat-updated';

function notifyUpdated() {
  window.dispatchEvent(new CustomEvent(CHAT_EVENT));
}

function getSelfName(): string {
  try {
    const saved = localStorage.getItem('eopms_current_user');
    if (!saved) return '';
    return JSON.parse(saved)?.name ?? '';
  } catch {
    return '';
  }
}

export const chatApi = {
  CHAT_EVENT,
  get SELF_NAME() { return getSelfName(); },

  async getChannels(): Promise<ChatChannel[]> {
    try {
      const res = await apiFetch('/api/chat/channels');
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error('[getChannels]', e);
      return [];
    }
  },

  async createChannel(name: string, allowedEmployeeIds?: string[], departments?: string[]): Promise<ChatChannel | null> {
    try {
      const res = await apiFetch('/api/chat/channels', {
        method: 'POST',
        body: JSON.stringify({ name, allowedEmployeeIds, departments }),
      });
      const data = await res.json().catch(() => null);
      notifyUpdated();
      if (!res.ok || !data?.success) return null;
      return data.channels.find((c: ChatChannel) => c.name === name) ?? null;
    } catch (e) {
      console.error('[createChannel]', e);
      return null;
    }
  },

  async editChannel(channelId: string, name: string, allowedEmployeeIds?: string[], departments?: string[]): Promise<ChatChannel | null> {
    try {
      const res = await apiFetch(`/api/chat/channels/${channelId}`, {
        method: 'PUT',
        body: JSON.stringify({ name, allowedEmployeeIds, departments }),
      });
      const data = await res.json().catch(() => null);
      notifyUpdated();
      if (!res.ok || !data?.success) return null;
      return data.channels.find((c: ChatChannel) => c.id === channelId) ?? null;
    } catch (e) {
      console.error('[editChannel]', e);
      return null;
    }
  },

  async deleteChannel(channelId: ChannelId): Promise<void> {
    const res = await apiFetch(`/api/chat/channels/${channelId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error || 'Failed to delete channel.');
    }
    notifyUpdated();
  },

  async fetchMessages(channelId: ChannelId): Promise<ChatMessage[]> {
    try {
      const res = await apiFetch(`/api/chat/messages/${channelId}`);
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      console.error('[fetchMessages]', e);
      return [];
    }
  },

  async sendMessage(
    channelId: ChannelId,
    text?: string,
    attachment?: { name: string; size: string; type?: string }
  ): Promise<ChatMessage | null> {
    try {
      const res = await apiFetch('/api/chat/messages', {
        method: 'POST',
        body: JSON.stringify({ channelId, text, attachment }),
      });
      const data = await res.json().catch(() => null);
      notifyUpdated();
      if (!res.ok || !data?.success) return null;
      return data.message;
    } catch (e) {
      console.error('[sendMessage]', e);
      return null;
    }
  },

  async deleteMessage(messageId: string): Promise<void> {
    await apiFetch(`/api/chat/messages/${messageId}`, { method: 'DELETE' });
    notifyUpdated();
  },

  async editMessage(messageId: string, newText: string): Promise<void> {
    await apiFetch(`/api/chat/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({ text: newText }),
    });
    notifyUpdated();
  },

  async toggleReaction(messageId: string, emoji: string): Promise<void> {
    await apiFetch(`/api/chat/messages/${messageId}/react`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
    notifyUpdated();
  },

  async markChannelRead(channelId: ChannelId): Promise<void> {
    await apiFetch(`/api/chat/channels/${channelId}/read`, { method: 'POST' });
    notifyUpdated();
  },

  async getUnreadSummary(): Promise<{ total: number; byChannel: Record<string, number> }> {
    try {
      const res = await apiFetch('/api/chat/unread');
      if (!res.ok) return { total: 0, byChannel: {} };
      return await res.json();
    } catch (e) {
      console.error('[getUnreadSummary]', e);
      return { total: 0, byChannel: {} };
    }
  },
};