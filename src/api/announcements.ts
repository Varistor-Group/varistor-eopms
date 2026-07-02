import type { Announcement, AnnouncementReaction, AnnouncementRead } from '../types';

// Seed Announcements
const defaultAnnouncements: Announcement[] = [
  {
    id: 'ann-1',
    title: 'New POSH policy v2.1 published',
    content: 'We have updated our Prevention of Sexual Harassment (POSH) guidelines. All employees are required to review the document and complete the mandatory training module in the learning panel by the end of the month.',
    author_role: 'HR',
    type: 'Policy',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2h ago
  },
  {
    id: 'ann-2',
    title: 'Quarterly town-hall this Friday',
    content: 'Join us for our Q2 performance review town-hall this Friday at 3:00 PM in the main conference room. We will share important updates about business scaling, customer successes, and our new employee reward points system.',
    author_role: 'HR',
    type: 'Standard',
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() // 5h ago
  },
  {
    id: 'ann-3',
    title: 'Tomorrow: Priya\'s birthday',
    content: 'Please join us in wishing Priya Sharma (COO) a fantastic happy birthday tomorrow! React with wishes below or drop by her desk.',
    author_role: 'HR',
    type: 'Birthday',
    created_at: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString() // 18h ago
  },
  {
    id: 'ann-4',
    title: 'Diwali bonus credited with Oct salary',
    content: 'Happy Diwali! The festive bonus calculations have been finalized and credited along with your October salaries. Please review your payroll salary slip for the breakdown.',
    author_role: 'Admin',
    type: 'Standard',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 1d ago
  },
  {
    id: 'ann-5',
    title: 'Office closed on 2nd Oct',
    content: 'In observance of Gandhi Jayanti, the office will remain closed on October 2nd. Regular operations will resume on October 3rd. Have a safe national holiday!',
    author_role: 'HR',
    type: 'Standard',
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() // 3d ago
  }
];

// Seed Reactions
const defaultReactions: AnnouncementReaction[] = [
  // POSH Policy: 👍 18, ❤️ 6, 🎉 2
  ...Array.from({ length: 18 }, (_, i) => ({
    id: `re-posh-1-${i}`,
    announcement_id: 'ann-1',
    user_id: `user-temp-${i}`,
    emoji_type: '👍',
    created_at: new Date().toISOString()
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    id: `re-posh-2-${i}`,
    announcement_id: 'ann-1',
    user_id: `user-temp-auth-${i}`,
    emoji_type: '❤️',
    created_at: new Date().toISOString()
  })),
  ...Array.from({ length: 2 }, (_, i) => ({
    id: `re-posh-3-${i}`,
    announcement_id: 'ann-1',
    user_id: `user-temp-diff-${i}`,
    emoji_type: '🎉',
    created_at: new Date().toISOString()
  })),
  // Town hall: 👍 12, ❤️ 4, 🎉 2
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `re-town-1-${i}`,
    announcement_id: 'ann-2',
    user_id: `user-temp-town1-${i}`,
    emoji_type: '👍',
    created_at: new Date().toISOString()
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `re-town-2-${i}`,
    announcement_id: 'ann-2',
    user_id: `user-temp-town2-${i}`,
    emoji_type: '❤️',
    created_at: new Date().toISOString()
  })),
  // Diwali: 💵 32, 👍 14
  ...Array.from({ length: 32 }, (_, i) => ({
    id: `re-diwali-1-${i}`,
    announcement_id: 'ann-4',
    user_id: `user-temp-diw1-${i}`,
    emoji_type: '💵',
    created_at: new Date().toISOString()
  })),
  ...Array.from({ length: 14 }, (_, i) => ({
    id: `re-diwali-2-${i}`,
    announcement_id: 'ann-4',
    user_id: `user-temp-diw2-${i}`,
    emoji_type: '👍',
    created_at: new Date().toISOString()
  })),
  // Office closed: 👍 22
  ...Array.from({ length: 22 }, (_, i) => ({
    id: `re-closed-1-${i}`,
    announcement_id: 'ann-5',
    user_id: `user-temp-cl1-${i}`,
    emoji_type: '👍',
    created_at: new Date().toISOString()
  }))
];

// Helper to simulate API response latency
const delay = (ms = 150) => new Promise(resolve => setTimeout(resolve, ms));

export const announcementsApi = {
  // Helper to load current local storage arrays
  _getData() {
    let announcements: Announcement[] = JSON.parse(localStorage.getItem('eopms_announcements') || '[]');
    let reactions: AnnouncementReaction[] = JSON.parse(localStorage.getItem('eopms_announcement_reactions') || '[]');
  // eslint-disable-next-line prefer-const
    let reads: AnnouncementRead[] = JSON.parse(localStorage.getItem('eopms_announcement_reads') || '[]');

    if (announcements.length === 0) {
      announcements = defaultAnnouncements;
      reactions = defaultReactions;
      localStorage.setItem('eopms_announcements', JSON.stringify(announcements));
      localStorage.setItem('eopms_announcement_reactions', JSON.stringify(reactions));
      localStorage.setItem('eopms_announcement_reads', JSON.stringify(reads));
    }

    return { announcements, reactions, reads };
  },

  // Save current local storage arrays
  _saveData(announcements: Announcement[], reactions: AnnouncementReaction[], reads: AnnouncementRead[]) {
    localStorage.setItem('eopms_announcements', JSON.stringify(announcements));
    localStorage.setItem('eopms_announcement_reactions', JSON.stringify(reactions));
    localStorage.setItem('eopms_announcement_reads', JSON.stringify(reads));
  },

  // GET /api/announcements
  async fetchAnnouncements(userId: string) {
    await delay();
    const { announcements, reactions, reads } = this._getData();

    // Aggregate reactions and read status
    return announcements.map((ann) => {
      const annReactions = reactions.filter(r => r.announcement_id === ann.id);
      
      // Group reaction counts
      const countsMap = annReactions.reduce((acc, curr) => {
        acc[curr.emoji_type] = (acc[curr.emoji_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Check if logged-in user reacted
      const userReactions = annReactions.filter(r => r.user_id === userId).map(r => r.emoji_type);

      // We default to displaying standard emojis, but include all unique emojis present
      const emojisToInclude = ['👍', '❤️', '🎉', '💵', '🎂'];
      const uniqueEmojis = Array.from(new Set([...emojisToInclude, ...Object.keys(countsMap)]));

      const reactionsAggregated = uniqueEmojis.map(emoji => ({
        emoji,
        count: countsMap[emoji] || 0,
        reactedByUser: userReactions.includes(emoji)
      }));

      // Check if logged in user has read this
      const isRead = reads.some(r => r.announcement_id === ann.id && r.user_id === userId);

      return {
        ...ann,
        reactions: reactionsAggregated,
        isRead
      };
    });
  },

  // POST /api/announcements/react
  async toggleReaction(announcementId: string, userId: string, emojiType: string) {
    await delay();
    const { announcements, reactions, reads } = this._getData();

    const existingReactionIndex = reactions.findIndex(
      r => r.announcement_id === announcementId && r.user_id === userId && r.emoji_type === emojiType
    );

    if (existingReactionIndex > -1) {
      // Remove reaction (toggle off)
      reactions.splice(existingReactionIndex, 1);
    } else {
      // Add reaction (toggle on)
      reactions.push({
        id: `re-${Date.now()}-${Math.random()}`,
        announcement_id: announcementId,
        user_id: userId,
        emoji_type: emojiType,
        created_at: new Date().toISOString()
      });
    }

    this._saveData(announcements, reactions, reads);
    return this.fetchAnnouncements(userId);
  },

  // POST /api/announcements/read
  async markAsRead(announcementId: string, userId: string) {
    await delay();
    const { announcements, reactions, reads } = this._getData();

    const alreadyRead = reads.some(r => r.announcement_id === announcementId && r.user_id === userId);

    if (!alreadyRead) {
      reads.push({
        id: `rd-${Date.now()}-${Math.random()}`,
        announcement_id: announcementId,
        user_id: userId,
        read_at: new Date().toISOString()
      });
      this._saveData(announcements, reactions, reads);
    }

    return this.fetchAnnouncements(userId);
  },

  // POST /api/announcements (Admin/HR only)
  async createAnnouncement(
    announcement: Omit<Announcement, 'id' | 'created_at'>,
    userId: string
  ) {
    await delay();
    const { announcements, reactions, reads } = this._getData();

    const newAnnouncement: Announcement = {
      ...announcement,
      id: `ann-${Date.now()}`,
      created_at: new Date().toISOString()
    };

    // Prepend new announcement to the feed
    announcements.unshift(newAnnouncement);

    // Auto mark as read for creator
    reads.push({
      id: `rd-${Date.now()}-${Math.random()}`,
      announcement_id: newAnnouncement.id,
      user_id: userId,
      read_at: new Date().toISOString()
    });

    this._saveData(announcements, reactions, reads);
    return this.fetchAnnouncements(userId);
  }
};
