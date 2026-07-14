import React, { useEffect, useRef, useState } from 'react';
import { Hash, Paperclip, Send, Smile, Pin, FileSpreadsheet, Users, Eye, Download, X, Trash2, Plus, Menu, Edit2 } from 'lucide-react';
import { chatApi } from '../api/chat';
import { useVariPoints } from '../hooks/useVariPoints';
import { Modal } from './shared/Modal';
import { Input } from './shared/Input';
import { Button } from './shared/Button';
import type { ChannelId, ChatChannel, ChatMessage, ChatAttachment } from '../types';
import { getEmployees, type Employee } from '../api/employees';

type PendingAttachment = Required<Pick<ChatAttachment, 'name' | 'size' | 'type' | 'dataUrl'>>;

const QUICK_EMOJIS = ['👍', '❤️', '🎉', '😂', '🙏', '👀'];
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB - keeps localStorage well within quota

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Highlights "@Name" mention tokens inline within message text
function renderMessageText(text: string) {
  const parts = text.split(/(@[A-Za-z]+(?:\s[A-Za-z]+)?)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-bold text-varistor-limeText bg-varistor-limeLight px-1 rounded">
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

export const Chat: React.FC = () => {
  const { currentRole, currentUser } = useVariPoints();
  const selfName = currentUser?.name ?? 'You';
  const selfRole = currentRole;
  const selfAvatar = currentUser?.avatarUrl ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(selfName)}&background=84CC16&color=fff&size=80&bold=true`;
  const canModerate = currentRole === 'Admin' || currentRole === 'HR';
  const canManageChannels = currentRole === 'Admin' || currentRole === 'HR';
  const [channels, setChannels] = useState<ChatChannel[]>(() => chatApi.getChannels(currentUser ?? undefined));
  const [activeChannelId, setActiveChannelId] = useState<ChannelId>('all-hands');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [unread, setUnread] = useState<{ total: number; byChannel: Record<string, number> }>({ total: 0, byChannel: {} });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDepts, setNewChannelDepts] = useState<string[]>([]);
  const [newChannelMembers, setNewChannelMembers] = useState<string[]>([]);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [showMobileChannels, setShowMobileChannels] = useState(false);
  const [viewportHeight, setViewportHeight] = useState('100dvh');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeChannel = channels.find(c => c.id === activeChannelId) ?? channels[0];

  const refreshUnread = () => setUnread(chatApi.getUnreadSummary());
  const refreshChannels = () => setChannels(chatApi.getChannels(currentUser ?? undefined));

  // Fix #8: Adjust layout when mobile keyboard opens/closes
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setViewportHeight(`${vv.height}px`);
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  // Handle hardware back button closing the channels sidebar
  useEffect(() => {
    const handleGlobalBack = (e: Event) => {
      if (showMobileChannels) {
        e.preventDefault(); // Stop App.tsx from processing this
        setShowMobileChannels(false);
      }
    };
    window.addEventListener('app_back_button', handleGlobalBack);
    return () => window.removeEventListener('app_back_button', handleGlobalBack);
  }, [showMobileChannels]);

  const loadChannelMessages = async (channelId: ChannelId) => {
    setIsLoading(true);
    const data = await chatApi.fetchMessages(channelId, selfName);
    setMessages(data);
    setIsLoading(false);
    chatApi.markChannelRead(channelId);
    refreshUnread();
  };

  useEffect(() => {
   
    loadChannelMessages(activeChannelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannelId]);

  useEffect(() => {
   
    refreshUnread();
    const handler = () => {
      refreshUnread();
      refreshChannels();
    };
    window.addEventListener(chatApi.CHAT_EVENT, handler);
    getEmployees().then(setEmployees);
    return () => window.removeEventListener(chatApi.CHAT_EVENT, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // If the active channel was deleted (by this tab or another), fall back to whatever remains.
  useEffect(() => {
    if (channels.length > 0 && !channels.some(c => c.id === activeChannelId)) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, activeChannelId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text && !pendingAttachment) return;

    const message = await chatApi.sendMessage(
      activeChannelId,
      text || undefined,
      pendingAttachment ?? undefined,
      { name: selfName, role: selfRole, avatarUrl: selfAvatar, selfName }
    );
    setMessages(prev => [...prev, { ...message, isSelf: true }]);
    setDraft('');
    setPendingAttachment(null);
    setShowEmojiPicker(false);
  };

  const handleAttachClick = () => fileInputRef.current?.click();

  // Stages the file for preview - it isn't sent until the user hits Send,
  // same as attaching a file in WhatsApp or similar messaging apps.
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachError(`"${file.name}" is over the 5 MB attachment limit.`);
      setTimeout(() => setAttachError(null), 4000);
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    setPendingAttachment({
      name: file.name,
      size: formatFileSize(file.size),
      type: file.type || 'application/octet-stream',
      dataUrl,
    });
  };

  const removePendingAttachment = () => setPendingAttachment(null);

  const handleDeleteMessage = (message: ChatMessage) => {
    const confirmed = window.confirm(
      message.isSelf ? 'Delete this message?' : `Delete this message from ${message.authorName}?`
    );
    if (!confirmed) return;

    chatApi.deleteMessage(message.id);
    setMessages(prev => prev.filter(m => m.id !== message.id));
    refreshUnread();
  };

  const insertEmoji = (emoji: string) => {
    setDraft(prev => `${prev}${emoji}`);
    setShowEmojiPicker(false);
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    chatApi.toggleReaction(messageId, emoji);
    setMessages(await chatApi.fetchMessages(activeChannelId));
    setReactionPickerFor(null);
  };

  const openCreateChannel = () => {
    setNewChannelName('');
    setNewChannelDepts([]);
    setNewChannelMembers([]);
    setChannelError(null);
    setShowCreateChannel(true);
  };

  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const allowedIds = newChannelMembers.length > 0 ? newChannelMembers : undefined;
      const depts = newChannelDepts.length > 0 ? newChannelDepts : undefined;
      const channel = chatApi.createChannel(newChannelName, allowedIds, depts);
      refreshChannels();
      setActiveChannelId(channel.id);
      setShowCreateChannel(false);
    } catch (err) {
      setChannelError(err instanceof Error ? err.message : 'Could not create channel.');
    }
  };

  const handleEditSave = (messageId: string) => {
    if (!editingDraft.trim()) return;
    chatApi.editMessage(messageId, editingDraft);
    setEditingMessageId(null);
    setEditingDraft('');
  };

  const handleDeleteChannel = (e: React.MouseEvent, channel: ChatChannel) => {
    e.stopPropagation();
    const confirmed = window.confirm(`Delete #${channel.name}? This removes it and all its messages for everyone.`);
    if (!confirmed) return;

    try {
      chatApi.deleteChannel(channel.id);
      refreshChannels();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not delete channel.');
    }
  };

  return (
    <div className="relative bg-varistor-surface rounded-varistor border border-varistor-border shadow-varistor flex flex-col md:flex-row overflow-hidden" style={{ height: `calc(${viewportHeight} - 160px)`, minHeight: '400px' }}>
      
      {/* Mobile Backdrop */}
      {showMobileChannels && (
        <div 
          className="md:hidden absolute inset-0 bg-black/50 z-20 transition-opacity"
          onClick={() => setShowMobileChannels(false)}
        />
      )}

      {/* Channel List – slide-over on mobile, fixed aside on desktop */}
      <aside 
        className={`absolute inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out md:relative md:transform-none flex w-[80%] md:w-56 flex-shrink-0 border-r border-varistor-border flex-col bg-varistor-surfaceMuted ${
          showMobileChannels ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="px-4 py-3 border-b border-varistor-border flex items-center justify-between">
          <span className="text-[10px] font-bold text-varistor-muted uppercase tracking-wider">Channels</span>
          {canManageChannels && (
            <button
              onClick={openCreateChannel}
              title="Create channel"
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 text-varistor-muted hover:text-varistor-dark transition-colors cursor-pointer"
            >
              <Plus size={14} />
            </button>
          )}
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {channels.map(channel => {
            const isActive = channel.id === activeChannelId;
            const unreadCount = unread.byChannel[channel.id];
            const canDeleteChannel = canManageChannels && channels.length > 1;
            return (
              <div key={channel.id} className="group relative">
                <button
                  onClick={() => { setActiveChannelId(channel.id); setShowMobileChannels(false); }}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-varistor cursor-pointer border-l-[3px] ${
                    isActive
                      ? 'bg-varistor-limeLight text-varistor-dark border-varistor-lime'
                      : 'text-varistor-muted border-transparent hover:bg-black/5 dark:hover:bg-white/5 hover:text-varistor-dark'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Hash size={13} className="flex-shrink-0" />
                    <span className="truncate">{channel.name}</span>
                  </span>
                  {!isActive && unreadCount > 0 && (
                    <span className={`flex-shrink-0 min-w-[16px] h-4 px-1 rounded-full bg-varistor-lime text-black text-[9px] font-extrabold flex items-center justify-center ${canDeleteChannel ? 'group-hover:hidden' : ''}`}>
                      {unreadCount}
                    </span>
                  )}
                </button>
                {canDeleteChannel && (
                  <button
                    onClick={(e) => handleDeleteChannel(e, channel)}
                    title={`Delete #${channel.name}`}
                    className="hidden group-hover:flex absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-varistor-muted hover:text-varistor-dangerText hover:bg-varistor-dangerBg transition-all cursor-pointer"
                  >
                    <Trash2 size={11} />
                  </button>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Message Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel Header */}
        <div className="h-14 md:h-16 px-4 md:px-5 flex items-center justify-between border-b border-varistor-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMobileChannels(prev => !prev)}
              className="md:hidden p-1.5 rounded-lg hover:bg-varistor-surfaceMuted text-varistor-muted"
              title="Toggle channels"
            >
              <Menu size={18} />
            </button>
            <h3 className="text-sm font-bold text-varistor-dark flex items-center gap-1">
              <Hash size={14} className="text-varistor-muted" />
              {activeChannel.name}
            </h3>
            <div className="flex items-center gap-2 text-[10px] text-varistor-muted mt-0.5">
              <span className="flex items-center gap-1"><Users size={10} /> {activeChannel.memberCount} members</span>
              {activeChannel.pinned && (
                <span className="flex items-center gap-1">
                  <Pin size={10} /> pinned: {activeChannel.pinned}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-varistor-surfaceMuted rounded-lg w-2/3" />
              ))}
            </div>
          ) : (
            messages.map(message => {
              const canDelete = message.isSelf || canModerate;
              return (
              <div key={message.id} className={`group flex gap-3 ${message.isSelf ? 'flex-row-reverse' : ''}`}>
                <img
                  src={message.authorAvatar}
                  alt={message.authorName}
                  className="w-8 h-8 rounded-full object-cover border border-varistor-border flex-shrink-0"
                />
                <div className={`relative max-w-[70%] ${message.isSelf ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`flex items-center gap-1.5 mb-1 ${message.isSelf ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[11px] font-bold text-varistor-dark">
                      {message.isSelf ? 'You' : message.authorName}
                    </span>
                    {!message.isSelf && (
                      <span className="text-[9px] text-varistor-muted font-semibold uppercase">{message.authorRole}</span>
                    )}
                    <span className="text-[9px] text-varistor-muted">{formatTime(message.timestamp)}</span>
                    <button
                      onClick={() => setReactionPickerFor(prev => (prev === message.id ? null : message.id))}
                      title="React"
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-varistor-muted hover:text-varistor-dark hover:bg-varistor-surfaceMuted transition-all cursor-pointer"
                    >
                      <Smile size={11} />
                    </button>
                    {message.isSelf && (
                      <button
                        onClick={() => {
                          setEditingMessageId(message.id);
                          setEditingDraft(message.text || '');
                        }}
                        title="Edit message"
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-varistor-muted hover:text-varistor-dark hover:bg-varistor-surfaceMuted transition-all cursor-pointer"
                      >
                        <Edit2 size={11} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteMessage(message)}
                        title={message.isSelf ? 'Delete message' : `Remove message (${currentRole} moderation)`}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-varistor-muted hover:text-varistor-dangerText hover:bg-varistor-dangerBg transition-all cursor-pointer"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>

                  {message.attachment && (
                    message.attachment.dataUrl && message.attachment.type?.startsWith('image/') ? (
                      <a href={message.attachment.dataUrl} target="_blank" rel="noreferrer" title={`Preview ${message.attachment.name}`}>
                        <img
                          src={message.attachment.dataUrl}
                          alt={message.attachment.name}
                          className="max-w-[220px] max-h-[220px] rounded-lg border border-varistor-border object-cover"
                        />
                      </a>
                    ) : (
                      <div className="flex items-center gap-2 bg-varistor-surfaceMuted border border-varistor-border rounded-lg px-3 py-2 text-xs">
                        <FileSpreadsheet size={16} className="text-varistor-lime flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-varistor-dark truncate">{message.attachment.name}</p>
                          <p className="text-[10px] text-varistor-muted">{message.attachment.size} · searchable archive</p>
                        </div>
                        {message.attachment.dataUrl && (
                          <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                            <a
                              href={message.attachment.dataUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="Preview"
                              className="p-1.5 rounded hover:bg-varistor-surface text-varistor-muted hover:text-varistor-dark transition-colors"
                            >
                              <Eye size={13} />
                            </a>
                            <a
                              href={message.attachment.dataUrl}
                              download={message.attachment.name}
                              title="Download"
                              className="p-1.5 rounded hover:bg-varistor-surface text-varistor-muted hover:text-varistor-dark transition-colors"
                            >
                              <Download size={13} />
                            </a>
                          </div>
                        )}
                      </div>
                    )
                  )}
                  {message.text && (
                    <div
                      className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${message.attachment ? 'mt-1.5' : ''} ${
                        message.isSelf
                          ? 'bg-varistor-lime text-black font-medium'
                          : 'bg-varistor-surfaceMuted text-varistor-dark'
                      }`}
                    >
                      {editingMessageId === message.id ? (
                        <div className="flex flex-col gap-2 min-w-[200px]">
                          <textarea
                            value={editingDraft}
                            onChange={(e) => setEditingDraft(e.target.value)}
                            className="w-full text-black bg-white rounded p-1.5 text-xs outline-none focus:ring-2 focus:ring-black/20 resize-none min-h-[60px]"
                            autoFocus
                          />
                          <div className="flex justify-end gap-1.5">
                            <button onClick={() => setEditingMessageId(null)} className="px-2 py-1 bg-black/10 hover:bg-black/20 rounded text-[10px] font-bold cursor-pointer">Cancel</button>
                            <button onClick={() => handleEditSave(message.id)} className="px-2 py-1 bg-black text-white hover:bg-gray-800 rounded text-[10px] font-bold cursor-pointer">Save</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {renderMessageText(message.text)}
                          {message.edited && <span className="ml-1 text-[9px] opacity-60">(edited)</span>}
                        </>
                      )}
                    </div>
                  )}

                  {message.reactions && message.reactions.length > 0 && (
                    <div className={`flex flex-wrap gap-1 mt-1 ${message.isSelf ? 'justify-end' : 'justify-start'}`}>
                      {Object.entries(
                        message.reactions.reduce<Record<string, string[]>>((groups, r) => {
                          (groups[r.emoji] ??= []).push(r.userName === chatApi.SELF_NAME ? 'You' : r.userName);
                          return groups;
                        }, {})
                      ).map(([emoji, names]) => {
                        const selfReacted = names.includes('You');
                        return (
                          <button
                            key={emoji}
                            onClick={() => handleToggleReaction(message.id, emoji)}
                            title={names.join(', ')}
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] border transition-colors cursor-pointer ${
                              selfReacted
                                ? 'bg-varistor-limeLight border-varistor-lime text-varistor-limeText'
                                : 'bg-varistor-surfaceMuted border-varistor-border text-varistor-muted hover:text-varistor-dark'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="font-semibold">{names.length}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {reactionPickerFor === message.id && (
                    <div
                      className={`absolute top-full mt-1 z-10 bg-varistor-surface border border-varistor-border rounded-lg shadow-varistor p-1.5 flex gap-1 ${
                        message.isSelf ? 'right-0' : 'left-0'
                      }`}
                    >
                      {QUICK_EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleToggleReaction(message.id, emoji)}
                          className="text-sm p-1 hover:bg-varistor-surfaceMuted rounded cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              );
            })
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Attachment error */}
        {attachError && (
          <div className="px-4 py-2 text-[11px] font-semibold text-varistor-dangerText bg-varistor-dangerBg border-t border-varistor-dangerBorder flex-shrink-0">
            {attachError}
          </div>
        )}

        {/* Composer */}
        <form onSubmit={handleSend} className="border-t border-varistor-border px-3 md:px-4 py-2 md:py-3 flex flex-col gap-2 relative flex-shrink-0">
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} />

          {/* Staged attachment preview - not sent until the user hits Send */}
          {pendingAttachment && (
            <div className="flex items-center gap-3 bg-varistor-surfaceMuted border border-varistor-border rounded-lg px-3 py-2">
              {pendingAttachment.type.startsWith('image/') ? (
                <img
                  src={pendingAttachment.dataUrl}
                  alt={pendingAttachment.name}
                  className="w-12 h-12 rounded object-cover border border-varistor-border flex-shrink-0"
                />
              ) : (
                <FileSpreadsheet size={20} className="text-varistor-lime flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-varistor-dark truncate">{pendingAttachment.name}</p>
                <p className="text-[10px] text-varistor-muted">{pendingAttachment.size} · ready to send</p>
              </div>
              <button
                type="button"
                onClick={removePendingAttachment}
                title="Remove attachment"
                className="p-1.5 rounded-full hover:bg-varistor-surface text-varistor-muted hover:text-varistor-dark transition-colors cursor-pointer flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAttachClick}
              className="p-2 rounded-full hover:bg-varistor-surfaceMuted text-varistor-muted hover:text-varistor-dark transition-colors cursor-pointer flex-shrink-0"
              title="Attach a file"
            >
              <Paperclip size={16} />
            </button>

            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={pendingAttachment ? 'Add a caption...' : `Message #${activeChannel.name}...`}
              className="flex-1 bg-varistor-surfaceMuted border border-transparent rounded-full px-4 py-2 text-xs focus:outline-none focus:bg-varistor-surface focus:border-varistor-lime transition-all text-varistor-dark"
            />

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(prev => !prev)}
                className="p-2 rounded-full hover:bg-varistor-surfaceMuted text-varistor-muted hover:text-varistor-dark transition-colors cursor-pointer"
                title="Add emoji"
              >
                <Smile size={16} />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-11 right-0 bg-varistor-surface border border-varistor-border rounded-lg shadow-varistor p-2 flex gap-1 z-10">
                  {QUICK_EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => insertEmoji(emoji)}
                      className="text-base p-1 hover:bg-varistor-surfaceMuted rounded cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!draft.trim() && !pendingAttachment}
              className="p-2 rounded-full bg-varistor-lime hover:bg-[#7bc012] text-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex-shrink-0"
              title="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>

      {/* Create Channel Modal - Admin/HR only */}
      <Modal isOpen={showCreateChannel} onClose={() => setShowCreateChannel(false)} title="Create a channel">
        <form onSubmit={handleCreateChannel} className="flex flex-col gap-4">
          <Input
            label="Channel name"
            placeholder="e.g. design-team"
            value={newChannelName}
            onChange={(e) => setNewChannelName(e.target.value)}
            error={channelError ?? undefined}
            autoFocus
          />
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-varistor-dark mb-1.5">Select Departments (Optional)</label>
              <div className="max-h-48 overflow-y-auto border border-varistor-border rounded-lg p-2 space-y-1">
                {Array.from(new Set(employees.map(e => e.department))).filter(Boolean).map(d => (
                  <label key={d} className="flex items-center gap-2 text-sm hover:bg-varistor-surfaceMuted p-1.5 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newChannelDepts.includes(d)}
                      onChange={(e) => {
                        if (e.target.checked) setNewChannelDepts(prev => [...prev, d]);
                        else setNewChannelDepts(prev => prev.filter(dept => dept !== d));
                      }}
                      className="rounded text-varistor-lime focus:ring-varistor-lime"
                    />
                    {d}
                  </label>
                ))}
              </div>
            </div>
            
            <div className="flex-1">
              <label className="block text-xs font-semibold text-varistor-dark mb-1.5">Select Specific Employees (Optional)</label>
              <div className="max-h-48 overflow-y-auto border border-varistor-border rounded-lg p-2 space-y-1">
                {employees.map(emp => (
                  <label key={emp.id} className="flex items-center gap-2 text-sm hover:bg-varistor-surfaceMuted p-1.5 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newChannelMembers.includes(emp.id)}
                      onChange={(e) => {
                        if (e.target.checked) setNewChannelMembers(prev => [...prev, emp.id]);
                        else setNewChannelMembers(prev => prev.filter(id => id !== emp.id));
                      }}
                      className="rounded text-varistor-lime focus:ring-varistor-lime"
                    />
                    {emp.fullName} ({emp.department})
                  </label>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-varistor-muted mt-1">If neither is selected, the channel will be public (all employees).</p>
          <div className="flex justify-end gap-2 mt-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreateChannel(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!newChannelName.trim()}>
              Create channel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
