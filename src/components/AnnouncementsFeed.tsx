import React, { useState } from 'react';
import { Megaphone, Search, Plus, Send, X, Check, Sparkles } from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';

export const AnnouncementsFeed: React.FC = () => {
  const { 
    announcements, 
    reactToAnnouncement, 
    readAnnouncement, 
    addAnnouncement, 
    currentRole 
  } = useVariPoints();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'Standard' | 'Birthday' | 'Policy'>('all');

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newType, setNewType] = useState<'Standard' | 'Birthday' | 'Policy'>('Standard');
  const [newAuthor, setNewAuthor] = useState<'HR' | 'Admin'>('HR');

  const hasAccess = currentRole === 'Admin' || currentRole === 'HR';

  const handlePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    addAnnouncement(newTitle.trim(), newContent.trim(), newType, newAuthor);
    
    // Reset Form
    setNewTitle('');
    setNewContent('');
    setNewType('Standard');
    setShowForm(false);
  };

  // Helper to format relative time
  const formatRelativeTime = (dateString: string) => {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Filter & Search Logic
  const filteredAnnouncements = announcements.filter((ann) => {
    const matchesFilter = activeFilter === 'all' || ann.type === activeFilter;
    const matchesSearch = ann.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          ann.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getBadgeStyles = (type: string) => {
    switch (type) {
      case 'Policy': return 'bg-varistor-dangerBg text-varistor-dangerText border-varistor-dangerBorder';
      case 'Birthday': return 'bg-varistor-limeLight text-varistor-limeText border-varistor-successBorder';
      default: return 'bg-varistor-surfaceMuted text-varistor-dark border-varistor-border';
    }
  };

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-varistor-dark">Announcements Feed</h1>
          <p className="text-xs text-varistor-muted mt-0.5">Stay updated with official policy releases, company updates, and special occasions.</p>
        </div>
        {hasAccess && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-varistor-dark text-varistor-pageBg hover:opacity-90 font-bold py-2 px-4 rounded-varistor text-xs flex items-center gap-1.5 cursor-pointer shadow-sm transition-all duration-150"
          >
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancel Post' : 'Post Announcement'}
          </button>
        )}
      </div>

      {/* Admin Create Form */}
      {showForm && hasAccess && (
        <div className="bg-varistor-surface border border-varistor-border rounded-varistor p-6 shadow-varistor animate-[fadeIn_200ms_ease-out]">
          <h3 className="text-xs font-bold text-varistor-dark uppercase tracking-wider mb-4 flex items-center gap-1.5">
            <Megaphone size={15} className="text-varistor-lime" />
            Publish New Announcement
          </h3>

          <form onSubmit={handlePost} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Title */}
              <div className="md:col-span-2">
                <label className="text-[10px] text-varistor-muted font-bold uppercase tracking-wider block mb-1">Announcement Title</label>
                <input
                  type="text"
                  placeholder="e.g. Town-hall details / Policy update / Festive bonus"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-varistor-surface border border-varistor-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-varistor-lime transition-colors text-varistor-dark"
                  required
                />
              </div>

              {/* Type Selection */}
              <div>
                <label className="text-[10px] text-varistor-muted font-bold uppercase tracking-wider block mb-1">Announcement Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as any)}
                  className="w-full bg-varistor-surface border border-varistor-border rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-varistor-lime cursor-pointer text-varistor-dark font-medium"
                >
                  <option value="Standard">Standard Board News</option>
                  <option value="Policy">Policy Update</option>
                  <option value="Birthday">Birthday Wishes</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Content Description */}
              <div className="md:col-span-2">
                <label className="text-[10px] text-varistor-muted font-bold uppercase tracking-wider block mb-1">Content Details</label>
                <textarea
                  placeholder="Write full detailed description of the communication..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={4}
                  className="w-full bg-varistor-surface border border-varistor-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-varistor-lime transition-colors text-varistor-dark leading-relaxed"
                  required
                />
              </div>

              {/* Author Attribution Selector */}
              <div>
                <label className="text-[10px] text-varistor-muted font-bold uppercase tracking-wider block mb-1">Author Attribution</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewAuthor('HR')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      newAuthor === 'HR'
                        ? 'bg-varistor-limeLight border-varistor-lime text-varistor-limeText'
                        : 'bg-varistor-surface border-varistor-border text-varistor-muted hover:border-varistor-muted'
                    }`}
                  >
                    HR Office
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewAuthor('Admin')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                      newAuthor === 'Admin'
                        ? 'bg-varistor-limeLight border-varistor-lime text-varistor-limeText'
                        : 'bg-varistor-surface border-varistor-border text-varistor-muted hover:border-varistor-muted'
                    }`}
                  >
                    System Admin
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-varistor-border">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-varistor-surface border border-varistor-border text-varistor-dark px-4 py-2 rounded-lg text-xs font-bold hover:bg-varistor-surfaceMuted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-varistor-lime hover:bg-[#7bc012] text-black px-5 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <Send size={13} />
                Publish Announcement
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-varistor-surface rounded-varistor border border-varistor-border p-4 shadow-varistor flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-2.5 text-varistor-muted" size={15} />
          <input
            type="text"
            placeholder="Search announcements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-varistor-surfaceMuted border border-transparent rounded-full pl-9 pr-4 py-2 text-xs focus:outline-none focus:bg-varistor-surface focus:border-varistor-lime transition-all text-varistor-dark"
          />
        </div>

        {/* Tab Filters */}
        <div className="flex flex-wrap bg-varistor-surfaceMuted p-0.5 rounded-lg text-[11px] font-semibold">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-md transition-varistor cursor-pointer ${activeFilter === 'all' ? 'bg-varistor-surface text-varistor-dark shadow-sm' : 'text-varistor-muted hover:text-varistor-dark'}`}
          >
            All
          </button>
          <button
            onClick={() => setActiveFilter('Standard')}
            className={`px-3 py-1.5 rounded-md transition-varistor cursor-pointer ${activeFilter === 'Standard' ? 'bg-varistor-surface text-varistor-dark shadow-sm' : 'text-varistor-muted hover:text-varistor-dark'}`}
          >
            Standard
          </button>
          <button
            onClick={() => setActiveFilter('Policy')}
            className={`px-3 py-1.5 rounded-md transition-varistor cursor-pointer ${activeFilter === 'Policy' ? 'bg-varistor-surface text-varistor-dark shadow-sm' : 'text-varistor-muted hover:text-varistor-dark'}`}
          >
            Policies
          </button>
          <button
            onClick={() => setActiveFilter('Birthday')}
            className={`px-3 py-1.5 rounded-md transition-varistor cursor-pointer ${activeFilter === 'Birthday' ? 'bg-varistor-surface text-varistor-dark shadow-sm' : 'text-varistor-muted hover:text-varistor-dark'}`}
          >
            Birthdays
          </button>
        </div>
      </div>

      {/* Announcements Feed Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredAnnouncements.length === 0 ? (
          <div className="col-span-full bg-varistor-surface border border-varistor-border rounded-varistor p-12 text-center shadow-varistor">
            <Megaphone size={32} className="text-varistor-muted mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-varistor-muted">No announcements found matching the filter.</p>
          </div>
        ) : (
          filteredAnnouncements.map((ann) => {
            const isBirthday = ann.type === 'Birthday';
            
            return (
              <div
                key={ann.id}
                onClick={() => readAnnouncement(ann.id)}
                className={`bg-varistor-surface rounded-varistor border p-5 shadow-varistor flex flex-col justify-between transition-all duration-200 cursor-pointer ${
                  ann.isRead 
                    ? 'border-varistor-border opacity-95 hover:shadow-md' 
                    : 'border-varistor-lime shadow-[0_2px_8px_rgba(132,204,22,0.06)] hover:shadow-lg'
                }`}
              >
                {/* Header row */}
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${getBadgeStyles(ann.type)}`}>
                      {ann.type}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-varistor-muted font-bold">
                        {ann.author_role} · {formatRelativeTime(ann.created_at)}
                      </span>
                      {ann.isRead ? (
                        <span className="text-[9px] text-varistor-muted bg-varistor-surfaceMuted px-1.5 py-0.5 rounded flex items-center gap-0.5" title="Marked as Read">
                          <Check size={10} strokeWidth={2.5} />
                          Read
                        </span>
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-varistor-lime animate-pulse" title="Unread Announcement" />
                      )}
                    </div>
                  </div>

                  {/* Announcement Title */}
                  <h3 className="text-sm font-bold text-varistor-dark leading-snug mb-2">
                    {ann.title}
                  </h3>

                  {/* Content details */}
                  <p className="text-xs text-varistor-muted leading-relaxed mb-4">
                    {ann.content}
                  </p>
                </div>

                {/* Footer Reactions / Action Panel */}
                <div className="pt-3 border-t border-varistor-border flex flex-wrap gap-2 items-center justify-between mt-auto">
                  {/* Reaction icons counters */}
                  <div className="flex flex-wrap gap-1.5">
                    {ann.reactions.map((r) => {
                      // Only render the emoji picker button if count > 0 OR if it is standard (👍, ❤️, 🎉)
                      if (r.count === 0 && !['👍', '❤️', '🎉'].includes(r.emoji)) return null;

                      return (
                        <button
                          key={r.emoji}
                          onClick={(e) => {
                            e.stopPropagation();
                            reactToAnnouncement(ann.id, r.emoji);
                            readAnnouncement(ann.id);
                          }}
                          className={`flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                            r.reactedByUser 
                              ? 'bg-varistor-limeLight border-varistor-lime text-varistor-limeText font-bold shadow-sm' 
                              : 'bg-varistor-surfaceMuted border-varistor-border text-varistor-muted hover:bg-varistor-surface hover:border-varistor-muted'
                          }`}
                        >
                          <span>{r.emoji}</span>
                          {r.count > 0 && <span className="font-extrabold">{r.count}</span>}
                        </button>
                      );
                    })}
                  </div>

                  {/* Quick Special wishes button for Birthday */}
                  {isBirthday && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        reactToAnnouncement(ann.id, '🎉');
                        readAnnouncement(ann.id);
                      }}
                      className="text-xs font-bold text-varistor-limeText bg-varistor-limeLight hover:bg-varistor-lime hover:text-black border border-varistor-successBorder hover:border-transparent px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-all duration-150 cursor-pointer"
                    >
                      <Sparkles size={12} className="animate-bounce" />
                      React Wishes 🎉
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
