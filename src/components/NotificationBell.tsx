import React, { useEffect, useRef, useState } from 'react';
import { Bell, Megaphone, Cake, MessageSquare, CheckCheck, Award, ClipboardList } from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';
import { useKanbanTasks } from '../hooks/useKanbanTasks';
import { chatApi } from '../api/chat';
import { getEmployees, type Employee } from '../api/employees';
import type { ChannelId, ChatChannel } from '../types';

interface NotificationBellProps {
  onNavigateToChat: () => void;
  onNavigateToTasks: () => void;
}

const formatRelativeTime = (dateString: string) => {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
};

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigateToChat, onNavigateToTasks }) => {
  const { announcements, readAnnouncement, reactToAnnouncement, ledger } = useVariPoints();
  const { tasks, currentRole, currentUser } = useKanbanTasks();
  const [isOpen, setIsOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState<{ total: number; byChannel: Record<string, number> }>({ total: 0, byChannel: {} });
  // NEW: channels now need to be fetched async and stored, since getChannels() is no longer sync
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [readLedgerIds, setReadLedgerIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('eopms_read_ledger');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [readTaskRequestIds, setReadTaskRequestIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('eopms_read_task_requests');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);

  // CHANGED: now async
  const refreshChatUnread = async () => setChatUnread(await chatApi.getUnreadSummary());
  const refreshChannels = async () => setChannels(await chatApi.getChannels());

  useEffect(() => {
    refreshChatUnread();
    refreshChannels();
    const handler = () => {
      refreshChatUnread();
      refreshChannels();
    };
    window.addEventListener(chatApi.CHAT_EVENT, handler);
    return () => window.removeEventListener(chatApi.CHAT_EVENT, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only managers/HR/Admin need the employee list, to know which task requests
  // belong to their own subordinates.
  useEffect(() => {
    if (currentRole === 'Admin' || currentRole === 'HR' || currentRole === 'Reporting Manager') {
      getEmployees().then(setAllEmployees);
    }
  }, [currentRole]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const persistReadLedger = (next: Set<string>) => {
    setReadLedgerIds(next);
    localStorage.setItem('eopms_read_ledger', JSON.stringify(Array.from(next)));
  };

  const persistReadTaskRequests = (next: Set<string>) => {
    setReadTaskRequestIds(next);
    localStorage.setItem('eopms_read_task_requests', JSON.stringify(Array.from(next)));
  };

  // Task requests awaiting this manager's approval (mirrors the filtering
  // logic in TaskManagement.tsx's "Task Requests Pending Approval" section).
  const subordinateIds = new Set(
    (currentRole === 'Admin' || currentRole === 'HR')
      ? allEmployees.map(e => e.id)
      : allEmployees.filter(e => e.reportingManagerId === currentUser?.id).map(e => e.id)
  );
  const pendingTaskRequests = tasks.filter(t => t.status === 'pending_review' && t.assigneeId && subordinateIds.has(t.assigneeId));
  const unreadTaskRequests = pendingTaskRequests.filter(t => !readTaskRequestIds.has(t.id));

  const unreadAnnouncements = announcements.filter(a => !a.isRead);
  const unreadLedger = ledger.filter(l => !readLedgerIds.has(l.id));
  const totalUnread = unreadAnnouncements.length + unreadLedger.length + chatUnread.total + unreadTaskRequests.length;

  const recentAnnouncements = [...announcements]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);
  const recentLedger = ledger.slice(0, 5);
  // CHANGED: uses the channels state instead of calling getChannels() synchronously
  const unreadChannels = channels.filter(c => chatUnread.byChannel[c.id]);

  // CHANGED: now async, awaits markChannelRead calls
  const handleMarkAllRead = async () => {
    unreadAnnouncements.forEach(a => readAnnouncement(a.id));
    await Promise.all(unreadChannels.map(c => chatApi.markChannelRead(c.id)));
    persistReadLedger(new Set([...readLedgerIds, ...ledger.map(l => l.id)]));
    persistReadTaskRequests(new Set([...readTaskRequestIds, ...pendingTaskRequests.map(t => t.id)]));
  };

  const handleLedgerItemClick = (id: string) => {
    persistReadLedger(new Set(readLedgerIds).add(id));
  };

  const handleTaskRequestClick = (id: string) => {
    persistReadTaskRequests(new Set(readTaskRequestIds).add(id));
    setIsOpen(false);
    onNavigateToTasks();
  };

  // CHANGED: now async, awaits markChannelRead
  const handleChatItemClick = async (channelId: ChannelId) => {
    await chatApi.markChannelRead(channelId);
    setIsOpen(false);
    onNavigateToChat();
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="p-2 rounded-full hover:bg-varistor-surfaceMuted transition-colors relative cursor-pointer"
        title="Notifications"
      >
        <Bell size={18} strokeWidth={1.5} className="text-varistor-dark" />
        {totalUnread > 0 && (
          <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-varistor-lime text-black text-[8px] font-extrabold flex items-center justify-center animate-pulse">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 bg-varistor-surface border border-varistor-border rounded-varistor shadow-[0_8px_24px_rgba(0,0,0,0.10)] z-50 animate-[fadeIn_150ms_ease-out] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-varistor-border">
            <h4 className="text-xs font-bold text-varistor-dark uppercase tracking-wider">Notifications</h4>
            {totalUnread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[10px] font-bold text-varistor-limeText hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck size={12} />
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {pendingTaskRequests.length > 0 && (
              <div className="px-4 pt-3 pb-1">
                <span className="text-[9px] font-bold text-varistor-muted uppercase tracking-wider">Tasks</span>
              </div>
            )}
            {pendingTaskRequests.map(task => {
              const isUnread = !readTaskRequestIds.has(task.id);
              return (
                <button
                  key={task.id}
                  onClick={() => handleTaskRequestClick(task.id)}
                  className={`w-full flex items-start gap-3 px-4 py-2.5 hover:bg-varistor-surfaceMuted transition-colors text-left cursor-pointer ${
                    isUnread ? 'bg-varistor-limeLight/40' : ''
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-varistor-limeLight flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ClipboardList size={13} className="text-varistor-limeText" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-varistor-dark leading-snug truncate">
                      Task request: {task.title}
                    </p>
                    <p className="text-[10px] text-varistor-muted mt-0.5">{task.assignee.name} · awaiting your review</p>
                  </div>
                  {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-varistor-lime flex-shrink-0 mt-1.5" />}
                </button>
              );
            })}

            {unreadChannels.length > 0 && (
              <div className="px-4 pt-3 pb-1">
                <span className="text-[9px] font-bold text-varistor-muted uppercase tracking-wider">Chat</span>
              </div>
            )}
            {unreadChannels.map(channel => (
              <button
                key={channel.id}
                onClick={() => handleChatItemClick(channel.id)}
                className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-varistor-surfaceMuted transition-colors text-left cursor-pointer"
              >
                <div className="w-7 h-7 rounded-full bg-varistor-limeLight flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MessageSquare size={13} className="text-varistor-limeText" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-varistor-dark">
                    {chatUnread.byChannel[channel.id]} new message{chatUnread.byChannel[channel.id] > 1 ? 's' : ''} in #{channel.name}
                  </p>
                  <p className="text-[10px] text-varistor-muted mt-0.5">Click to open channel</p>
                </div>
              </button>
            ))}

            <div className="px-4 pt-3 pb-1">
              <span className="text-[9px] font-bold text-varistor-muted uppercase tracking-wider">Vari Points</span>
            </div>
            {recentLedger.length === 0 ? (
              <p className="px-4 py-4 text-xs text-varistor-muted text-center">No points activity yet.</p>
            ) : (
              recentLedger.map(entry => {
                const isUnread = !readLedgerIds.has(entry.id);
                const isCredit = entry.type === 'credit';
                return (
                  <button
                    key={entry.id}
                    onClick={() => handleLedgerItemClick(entry.id)}
                    className={`w-full flex items-start gap-3 px-4 py-2.5 hover:bg-varistor-surfaceMuted transition-colors text-left cursor-pointer ${
                      isUnread ? 'bg-varistor-limeLight/40' : ''
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      isCredit ? 'bg-varistor-limeLight text-varistor-limeText' : 'bg-varistor-dangerBg text-varistor-dangerText'
                    }`}>
                      <Award size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-varistor-dark leading-snug truncate">
                        {isCredit ? '+' : '-'}{entry.points} VP · {entry.taskTitle}
                      </p>
                      <span className="text-[9px] text-varistor-muted">{formatRelativeTime(entry.timestamp)}</span>
                    </div>
                    {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-varistor-lime flex-shrink-0 mt-1.5" />}
                  </button>
                );
              })
            )}

            <div className="px-4 pt-3 pb-1">
              <span className="text-[9px] font-bold text-varistor-muted uppercase tracking-wider">Announcements</span>
            </div>
            {recentAnnouncements.length === 0 ? (
              <p className="px-4 py-6 text-xs text-varistor-muted text-center">No announcements yet.</p>
            ) : (
              recentAnnouncements.map(ann => {
                const isBirthday = ann.type === 'Birthday';
                return (
                  <button
                    key={ann.id}
                    onClick={() => {
                      readAnnouncement(ann.id);
                      if (isBirthday) reactToAnnouncement(ann.id, '🎉');
                    }}
                    className={`w-full flex items-start gap-3 px-4 py-2.5 hover:bg-varistor-surfaceMuted transition-colors text-left cursor-pointer ${
                      !ann.isRead ? 'bg-varistor-limeLight/40' : ''
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-varistor-surfaceMuted flex items-center justify-center flex-shrink-0 mt-0.5">
                      {isBirthday ? (
                        <Cake size={13} className="text-varistor-dark" />
                      ) : (
                        <Megaphone size={13} className="text-varistor-dark" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-varistor-dark leading-snug truncate">{ann.title}</p>
                      <span className="text-[9px] text-varistor-muted">{formatRelativeTime(ann.created_at)}</span>
                    </div>
                    {!ann.isRead && <span className="w-1.5 h-1.5 rounded-full bg-varistor-lime flex-shrink-0 mt-1.5" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
