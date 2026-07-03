import type { ChatChannel, ChatMessage, ChannelId } from '../types';
import { mockEmployeeStore } from './employees';

/**
 * MOCK CHAT SERVICE
 *
 * TODO: Replace with Supabase Realtime (or Ably) channels + /storage/chat/:channelId/:file uploads.
 *
 * Membership and message authors are constrained to mockEmployeeStore, the
 * same employee directory Document Vault and Employee Management read from.
 * There is no separate cast of chat-only "teammates" - if someone isn't a
 * real employee record, they can't appear here.
 */

const SELF_NAME = 'Aarav Patel';
const SELF_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60';

const BASE_CHANNELS: Omit<ChatChannel, 'memberCount'>[] = [
  { id: 'all-hands', name: 'all-hands', pinned: 'POSH policy.pdf' },
  { id: 'sales-team', name: 'sales-team' },
  { id: 'operations', name: 'operations' },
  { id: 'tech-dev', name: 'tech-dev' },
  { id: 'hr-announcements', name: 'hr-announcements' },
];

function buildChannels(): ChatChannel[] {
  // Member count reflects the actual employee directory, not an invented headcount.
  return BASE_CHANNELS.map(c => ({ ...c, memberCount: mockEmployeeStore.length }));
}

function seedMessages(): ChatMessage[] {
  // No fabricated conversation history. A fresh company chat starts empty -
  // messages only ever come from the logged-in user or real created employees.
  return [];
}

// v2: bumped so browsers with the old fabricated-teammate seed data reload clean
const MESSAGES_KEY = 'eopms_chat_messages_v2';
const LAST_READ_KEY = 'eopms_chat_last_read_v2';
const CHAT_EVENT = 'varistor-chat-updated';

const delay = (ms = 150) => new Promise(resolve => setTimeout(resolve, ms));

function notifyUpdated() {
  window.dispatchEvent(new CustomEvent(CHAT_EVENT));
}

function loadMessages(): ChatMessage[] {
  const saved = localStorage.getItem(MESSAGES_KEY);
  if (saved) return JSON.parse(saved);
  const seeded = seedMessages();
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(seeded));
  return seeded;
}

function saveMessages(messages: ChatMessage[]) {
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
}

function loadLastRead(): Record<string, string> {
  return JSON.parse(localStorage.getItem(LAST_READ_KEY) || '{}');
}

function saveLastRead(map: Record<string, string>) {
  localStorage.setItem(LAST_READ_KEY, JSON.stringify(map));
}

export const chatApi = {
  CHAT_EVENT,

  getChannels(): ChatChannel[] {
    return buildChannels();
  },

  async fetchMessages(channelId: ChannelId): Promise<ChatMessage[]> {
    await delay();
    return loadMessages()
      .filter(m => m.channelId === channelId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  async sendMessage(channelId: ChannelId, text?: string, attachment?: { name: string; size: string; type?: string; dataUrl?: string }): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      channelId,
      authorName: SELF_NAME,
      authorRole: 'Operations',
      authorAvatar: SELF_AVATAR,
      isSelf: true,
      text,
      attachment,
      timestamp: new Date().toISOString(),
    };

    const messages = loadMessages();
    messages.push(message);
    saveMessages(messages);
    this.markChannelRead(channelId);
    notifyUpdated();

    await delay(50);
    return message;
  },

  markChannelRead(channelId: ChannelId) {
    const map = loadLastRead();
    map[channelId] = new Date().toISOString();
    saveLastRead(map);
    notifyUpdated();
  },

  getUnreadSummary(): { total: number; byChannel: Record<string, number> } {
    const messages = loadMessages();
    const lastRead = loadLastRead();
    const byChannel: Record<string, number> = {};
    let total = 0;

    for (const channel of buildChannels()) {
      const lastReadTime = lastRead[channel.id] ? new Date(lastRead[channel.id]).getTime() : 0;
      const unread = messages.filter(
        m => m.channelId === channel.id && !m.isSelf && new Date(m.timestamp).getTime() > lastReadTime
      ).length;
      if (unread > 0) {
        byChannel[channel.id] = unread;
        total += unread;
      }
    }

    return { total, byChannel };
  },
};
