import React, { useEffect, useRef, useState } from 'react';
import { Hash, Paperclip, Send, Smile, Pin, FileSpreadsheet, Users, Eye, Download, X } from 'lucide-react';
import { chatApi } from '../api/chat';
import type { ChannelId, ChatMessage, ChatAttachment } from '../types';

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
  const channels = chatApi.getChannels();
  const [activeChannelId, setActiveChannelId] = useState<ChannelId>('all-hands');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [unread, setUnread] = useState<{ total: number; byChannel: Record<string, number> }>({ total: 0, byChannel: {} });
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeChannel = channels.find(c => c.id === activeChannelId)!;

  const refreshUnread = () => setUnread(chatApi.getUnreadSummary());

  const loadChannelMessages = async (channelId: ChannelId) => {
    setIsLoading(true);
    const data = await chatApi.fetchMessages(channelId);
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
    const handler = () => refreshUnread();
    window.addEventListener(chatApi.CHAT_EVENT, handler);
    return () => window.removeEventListener(chatApi.CHAT_EVENT, handler);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text && !pendingAttachment) return;

    const message = await chatApi.sendMessage(activeChannelId, text || undefined, pendingAttachment ?? undefined);
    setMessages(prev => [...prev, message]);
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

  const insertEmoji = (emoji: string) => {
    setDraft(prev => `${prev}${emoji}`);
    setShowEmojiPicker(false);
  };

  return (
    <div className="bg-varistor-surface rounded-varistor border border-varistor-border shadow-varistor flex h-[calc(100vh-160px)] min-h-[520px] overflow-hidden">
      {/* Channel List */}
      <aside className="w-56 flex-shrink-0 border-r border-varistor-border flex flex-col bg-varistor-surfaceMuted">
        <div className="px-4 py-3 border-b border-varistor-border">
          <span className="text-[10px] font-bold text-varistor-muted uppercase tracking-wider">Channels</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {channels.map(channel => {
            const isActive = channel.id === activeChannelId;
            const unreadCount = unread.byChannel[channel.id];
            return (
              <button
                key={channel.id}
                onClick={() => setActiveChannelId(channel.id)}
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
                  <span className="flex-shrink-0 min-w-[16px] h-4 px-1 rounded-full bg-varistor-lime text-black text-[9px] font-extrabold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Message Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Channel Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-varistor-border flex-shrink-0">
          <div>
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
            messages.map(message => (
              <div key={message.id} className={`flex gap-3 ${message.isSelf ? 'flex-row-reverse' : ''}`}>
                <img
                  src={message.authorAvatar}
                  alt={message.authorName}
                  className="w-8 h-8 rounded-full object-cover border border-varistor-border flex-shrink-0"
                />
                <div className={`max-w-[70%] ${message.isSelf ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className={`flex items-center gap-1.5 mb-1 ${message.isSelf ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[11px] font-bold text-varistor-dark">
                      {message.isSelf ? 'You' : message.authorName}
                    </span>
                    {!message.isSelf && (
                      <span className="text-[9px] text-varistor-muted font-semibold uppercase">{message.authorRole}</span>
                    )}
                    <span className="text-[9px] text-varistor-muted">{formatTime(message.timestamp)}</span>
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
                      {renderMessageText(message.text)}
                    </div>
                  )}
                </div>
              </div>
            ))
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
        <form onSubmit={handleSend} className="border-t border-varistor-border px-4 py-3 flex flex-col gap-2 relative flex-shrink-0">
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
    </div>
  );
};
