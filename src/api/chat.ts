import type { ChatChannel, ChatMessage, ChannelId } from '../types';

/**
 * MOCK CHAT SERVICE
 *
 * TODO: Replace with Supabase Realtime (or Ably) channels + /storage/chat/:channelId/:file uploads.
 */

const SELF_NAME = 'Aarav Patel';
const SELF_AVATAR = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60';

const TEAMMATES: Record<ChannelId, { name: string; role: string; avatar: string }> = {
  'all-hands': { name: 'Priya Sharma', role: 'HR', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&fit=crop&q=60' },
  'sales-team': { name: 'Karan Verma', role: 'Sales', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&fit=crop&q=60' },
  'operations': { name: 'Rohit Mehta', role: 'Ops', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&fit=crop&q=60' },
  'tech-dev': { name: 'Sana Khan', role: 'Tech', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&fit=crop&q=60' },
  'hr-announcements': { name: 'Priya Sharma', role: 'HR', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&fit=crop&q=60' },
};

export const CHANNELS: ChatChannel[] = [
  { id: 'all-hands', name: 'all-hands', memberCount: 40, pinned: 'POSH policy.pdf' },
  { id: 'sales-team', name: 'sales-team', memberCount: 12 },
  { id: 'operations', name: 'operations', memberCount: 14 },
  { id: 'tech-dev', name: 'tech-dev', memberCount: 4 },
  { id: 'hr-announcements', name: 'hr-announcements', memberCount: 40 },
];

function seedMessages(): ChatMessage[] {
  const now = Date.now();
  const minsAgo = (m: number) => new Date(now - m * 60 * 1000).toISOString();

  return [
    {
      id: 'msg-1',
      channelId: 'all-hands',
      authorName: 'Priya Sharma',
      authorRole: 'HR',
      authorAvatar: TEAMMATES['all-hands'].avatar,
      isSelf: false,
      text: 'Reminder: submit timesheets by EOD.',
      timestamp: minsAgo(46),
    },
    {
      id: 'msg-2',
      channelId: 'all-hands',
      authorName: SELF_NAME,
      authorRole: 'Operations',
      authorAvatar: SELF_AVATAR,
      isSelf: true,
      text: 'On it 👍',
      timestamp: minsAgo(44),
    },
    {
      id: 'msg-3',
      channelId: 'all-hands',
      authorName: 'Rohit Mehta',
      authorRole: 'Ops',
      authorAvatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&fit=crop&q=60',
      isSelf: false,
      attachment: { name: 'vendor-quotes-Q3.xlsx', size: '184 KB' },
      timestamp: minsAgo(40),
    },
    {
      id: 'msg-4',
      channelId: 'sales-team',
      authorName: 'Karan Verma',
      authorRole: 'Sales',
      authorAvatar: TEAMMATES['sales-team'].avatar,
      isSelf: false,
      text: 'Q3 pitch deck draft is ready for review.',
      timestamp: minsAgo(120),
    },
    {
      id: 'msg-5',
      channelId: 'operations',
      authorName: 'Rohit Mehta',
      authorRole: 'Ops',
      authorAvatar: TEAMMATES['operations'].avatar,
      isSelf: false,
      text: 'Warehouse Zone A inventory count starts tomorrow 9 AM.',
      timestamp: minsAgo(200),
    },
    {
      id: 'msg-6',
      channelId: 'tech-dev',
      authorName: 'Sana Khan',
      authorRole: 'Tech',
      authorAvatar: TEAMMATES['tech-dev'].avatar,
      isSelf: false,
      text: 'Staging deploy is green ✅',
      timestamp: minsAgo(300),
    },
    {
      id: 'msg-7',
      channelId: 'hr-announcements',
      authorName: 'Priya Sharma',
      authorRole: 'HR',
      authorAvatar: TEAMMATES['hr-announcements'].avatar,
      isSelf: false,
      text: 'New POSH policy v2.1 has been published — please review.',
      timestamp: minsAgo(600),
    },
  ];
}

const MESSAGES_KEY = 'eopms_chat_messages';
const LAST_READ_KEY = 'eopms_chat_last_read';
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
    return CHANNELS;
  },

  async fetchMessages(channelId: ChannelId): Promise<ChatMessage[]> {
    await delay();
    return loadMessages()
      .filter(m => m.channelId === channelId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  },

  async sendMessage(channelId: ChannelId, text?: string, attachment?: { name: string; size: string }): Promise<ChatMessage> {
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

    for (const channel of CHANNELS) {
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
