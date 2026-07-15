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

const DEFAULT_CHANNELS: Omit<ChatChannel, 'memberCount'>[] = [
  { id: 'all-hands', name: 'all-hands', pinned: 'POSH policy.pdf' },
  { id: 'hr-announcements', name: 'hr-announcements' },
  { id: 'finance', name: 'finance', departments: ['Finance'] },
  { id: 'sales-team', name: 'sales-team', departments: ['Sales'] },
  { id: 'operations', name: 'operations', departments: ['Operations'] },
  { id: 'tech-dev', name: 'tech-dev', departments: ['Tech'] },
  { id: 'digital-marketing', name: 'digital-marketing', departments: ['Digital Marketing'] },
  { id: 'ops-heads', name: 'ops-heads', departments: ['Ops Heads'] },
];

const CHANNELS_KEY = 'eopms_chat_channels_v1';

function loadChannelList(): Omit<ChatChannel, 'memberCount'>[] {
  const saved = localStorage.getItem(CHANNELS_KEY);
  if (saved) return JSON.parse(saved);
  localStorage.setItem(CHANNELS_KEY, JSON.stringify(DEFAULT_CHANNELS));
  return DEFAULT_CHANNELS;
}

function saveChannelList(channels: Omit<ChatChannel, 'memberCount'>[]) {
  localStorage.setItem(CHANNELS_KEY, JSON.stringify(channels));
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildChannels(user?: { id: string; department?: string; role?: string }): ChatChannel[] {
  const allChannels = loadChannelList().map(c => {
    let count = mockEmployeeStore.length;
    if (c.departments || c.allowedEmployeeIds) {
      // Find all employees that match the departments OR are in allowed IDs
      const matches = mockEmployeeStore.filter(e => {
        if (c.departments && c.departments.includes(e.department)) return true;
        if (c.allowedEmployeeIds && c.allowedEmployeeIds.includes(e.id)) return true;
        return false;
      });
      count = matches.length;
    }
    return { ...c, memberCount: count };
  });

  if (!user || user.role === 'Admin') return allChannels;

  return allChannels.filter(c => {
    if (!c.departments && !c.allowedEmployeeIds) return true; // Public channel
    if (c.departments && user.department && c.departments.includes(user.department)) return true;
    if (c.allowedEmployeeIds && c.allowedEmployeeIds.includes(user.id)) return true;
    return false;
  });
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
  SELF_NAME,

  getChannels(user?: { id: string; department?: string; role?: string }): ChatChannel[] {
    return buildChannels(user);
  },

  createChannel(name: string, allowedEmployeeIds?: string[], departments?: string[]): ChatChannel {
    const channels = loadChannelList();
    const newChannel: Omit<ChatChannel, 'memberCount'> = {
      id: slugify(name) + '-' + Math.random().toString(36).slice(2, 6),
      name,
      allowedEmployeeIds: allowedEmployeeIds && allowedEmployeeIds.length > 0 ? allowedEmployeeIds : undefined,
      departments: departments && departments.length > 0 ? departments : undefined
    };
    channels.push(newChannel);
    saveChannelList(channels);
    notifyUpdated();
    
    let count = mockEmployeeStore.length;
    if (newChannel.departments || newChannel.allowedEmployeeIds) {
      const matches = mockEmployeeStore.filter(e => {
        if (newChannel.departments && newChannel.departments.includes(e.department)) return true;
        if (newChannel.allowedEmployeeIds && newChannel.allowedEmployeeIds.includes(e.id)) return true;
        return false;
      });
      count = matches.length;
    }
    return { ...newChannel, memberCount: count };
  },

  editChannel(channelId: string, name: string, allowedEmployeeIds?: string[], departments?: string[]): ChatChannel | null {
    const channels = loadChannelList();
    const index = channels.findIndex(c => c.id === channelId);
    if (index === -1) return null;

    channels[index] = {
      ...channels[index],
      name,
      allowedEmployeeIds: allowedEmployeeIds && allowedEmployeeIds.length > 0 ? allowedEmployeeIds : undefined,
      departments: departments && departments.length > 0 ? departments : undefined
    };
    saveChannelList(channels);
    notifyUpdated();

    const updatedChannel = channels[index];
    let count = mockEmployeeStore.length;
    if (updatedChannel.departments || updatedChannel.allowedEmployeeIds) {
      const matches = mockEmployeeStore.filter(e => {
        if (updatedChannel.departments && updatedChannel.departments.includes(e.department)) return true;
        if (updatedChannel.allowedEmployeeIds && updatedChannel.allowedEmployeeIds.includes(e.id)) return true;
        return false;
      });
      count = matches.length;
    }
    return { ...updatedChannel, memberCount: count };
  },

  async fetchMessages(channelId: ChannelId, selfName?: string): Promise<ChatMessage[]> {
    await delay();
    const resolvedSelfName = selfName ?? SELF_NAME;
    return loadMessages()
      .filter(m => m.channelId === channelId)
      .map(m => ({ ...m, isSelf: m.authorName === resolvedSelfName }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  async sendMessage(
    channelId: ChannelId,
    text?: string,
    attachment?: { name: string; size: string; type?: string; dataUrl?: string },
    sender?: { name: string; role: string; avatarUrl: string; selfName: string }
  ): Promise<ChatMessage> {
    const resolvedSender = sender ?? { name: SELF_NAME, role: 'Operations', avatarUrl: SELF_AVATAR, selfName: SELF_NAME };
    const message: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      channelId,
      authorName: resolvedSender.name,
      authorRole: resolvedSender.role,
      authorAvatar: resolvedSender.avatarUrl,
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

  deleteMessage(messageId: string) {
    const messages = loadMessages().filter(m => m.id !== messageId);
    saveMessages(messages);
    notifyUpdated();
  },

  editMessage(messageId: string, newText: string) {
    const messages = loadMessages();
    const index = messages.findIndex(m => m.id === messageId);
    if (index === -1) return;

    messages[index] = { ...messages[index], text: newText, edited: true };
    saveMessages(messages);
    notifyUpdated();
  },

  // WhatsApp-style: one reaction per person per message. Picking a new emoji
  // swaps it; picking the same emoji again clears it.
  toggleReaction(messageId: string, emoji: string) {
    const messages = loadMessages();
    const index = messages.findIndex(m => m.id === messageId);
    if (index === -1) return;

    const reactions = messages[index].reactions ?? [];
    const ownIndex = reactions.findIndex(r => r.userName === SELF_NAME);
    let nextReactions: typeof reactions;

    if (ownIndex !== -1 && reactions[ownIndex].emoji === emoji) {
      nextReactions = reactions.filter((_, i) => i !== ownIndex);
    } else if (ownIndex !== -1) {
      nextReactions = reactions.map((r, i) => (i === ownIndex ? { ...r, emoji } : r));
    } else {
      nextReactions = [...reactions, { emoji, userName: SELF_NAME }];
    }

    messages[index] = { ...messages[index], reactions: nextReactions };
    saveMessages(messages);
    notifyUpdated();
  },


  deleteChannel(channelId: ChannelId) {
    const existing = loadChannelList();
    if (existing.length <= 1) throw new Error('At least one channel must remain.');

    saveChannelList(existing.filter(c => c.id !== channelId));

    // Cascade: a deleted channel takes its messages and read-state with it.
    saveMessages(loadMessages().filter(m => m.channelId !== channelId));
    const lastRead = loadLastRead();
    delete lastRead[channelId];
    saveLastRead(lastRead);

    notifyUpdated();
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
