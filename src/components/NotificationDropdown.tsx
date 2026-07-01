import React, { useState, useEffect, useRef } from 'react';
import { Bell, Award, Megaphone, Check } from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';
export const NotificationDropdown: React.FC = () => {
  const { ledger, announcements } = useVariPoints();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'points' | 'announcements'>('points');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [readLedgerIds, setReadLedgerIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('eopms_read_ledger');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  const [readAnnouncementIds, setReadAnnouncementIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('eopms_read_announcements');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadLedger = ledger.filter(l => !readLedgerIds.has(l.id));
  const unreadAnnouncements = announcements.filter(a => !a.isRead && !readAnnouncementIds.has(a.id));
  const totalUnread = unreadLedger.length + unreadAnnouncements.length;

  const handleMarkLedgerRead = (id: string) => {
    const newSet = new Set(readLedgerIds).add(id);
    setReadLedgerIds(newSet);
    localStorage.setItem('eopms_read_ledger', JSON.stringify(Array.from(newSet)));
  };

  const handleMarkAnnouncementRead = (id: string) => {
    const newSet = new Set(readAnnouncementIds).add(id);
    setReadAnnouncementIds(newSet);
    localStorage.setItem('eopms_read_announcements', JSON.stringify(Array.from(newSet)));
  };

  const handleMarkAllRead = () => {
    if (activeTab === 'points') {
      const newSet = new Set([...readLedgerIds, ...ledger.map(l => l.id)]);
      setReadLedgerIds(newSet);
      localStorage.setItem('eopms_read_ledger', JSON.stringify(Array.from(newSet)));
    } else {
      const newSet = new Set([...readAnnouncementIds, ...announcements.map(a => a.id)]);
      setReadAnnouncementIds(newSet);
      localStorage.setItem('eopms_read_announcements', JSON.stringify(Array.from(newSet)));
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-full hover:bg-[#f1f3f0] transition-colors relative"
        title="Notifications"
      >
        <Bell size={18} strokeWidth={1.5} className="text-varistor-dark" />
        {totalUnread > 0 && (
          <span className="absolute top-1 right-1 w-3.5 h-3.5 flex items-center justify-center text-[8px] font-bold text-white rounded-full bg-varistor-lime animate-pulse border border-white">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-varistor border border-varistor-border shadow-varistor z-50 overflow-hidden animate-[fadeInPage_250ms_ease-out]">
          <div className="p-3 border-b border-[#f1f3f0] flex items-center justify-between bg-[#fafbfa]">
            <h3 className="text-sm font-bold text-varistor-dark">Notifications</h3>
            <button 
              onClick={handleMarkAllRead}
              className="text-[10px] text-varistor-limeText font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Check size={12} />
              Mark all as read
            </button>
          </div>

          <div className="flex border-b border-[#f1f3f0]">
            <button
              onClick={() => setActiveTab('points')}
              className={`flex-1 py-2 text-xs font-bold transition-colors cursor-pointer ${activeTab === 'points' ? 'text-varistor-dark border-b-2 border-varistor-lime' : 'text-varistor-muted hover:text-varistor-dark'}`}
            >
              Vari Points
              {unreadLedger.length > 0 && <span className="ml-1.5 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{unreadLedger.length}</span>}
            </button>
            <button
              onClick={() => setActiveTab('announcements')}
              className={`flex-1 py-2 text-xs font-bold transition-colors cursor-pointer ${activeTab === 'announcements' ? 'text-varistor-dark border-b-2 border-varistor-lime' : 'text-varistor-muted hover:text-varistor-dark'}`}
            >
              Announcements
              {unreadAnnouncements.length > 0 && <span className="ml-1.5 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{unreadAnnouncements.length}</span>}
            </button>
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {activeTab === 'points' && (
              ledger.length === 0 ? (
                <div className="p-6 text-center text-xs text-varistor-muted font-medium">No new notifications</div>
              ) : (
                <div className="divide-y divide-[#f1f3f0]">
                  {ledger.map(entry => (
                    <div 
                      key={entry.id}
                      onClick={() => handleMarkLedgerRead(entry.id)}
                      className={`p-3 hover:bg-[#f9faf9] cursor-pointer transition-colors flex gap-3 ${!readLedgerIds.has(entry.id) ? 'bg-[#f4f7f4]' : ''}`}
                    >
                      <div className={`mt-0.5 p-1.5 rounded-full h-fit ${entry.type === 'credit' ? 'bg-varistor-limeLight text-varistor-limeText' : 'bg-red-50 text-red-600'}`}>
                        <Award size={14} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-varistor-dark font-medium leading-snug">
                          {entry.type === 'credit' ? 'Points Awarded' : 'Points Deducted'}: <span className="font-bold">{entry.taskTitle}</span>
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-[10px] font-bold ${entry.type === 'credit' ? 'text-varistor-limeText' : 'text-red-600'}`}>
                            {entry.type === 'credit' ? '+' : '-'}{entry.points} VP
                          </span>
                          <span className="text-[9px] text-varistor-muted">
                            {new Date(entry.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      {!readLedgerIds.has(entry.id) && (
                        <div className="w-2 h-2 rounded-full bg-varistor-lime self-center" />
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'announcements' && (
              announcements.length === 0 ? (
                <div className="p-6 text-center text-xs text-varistor-muted font-medium">No new announcements</div>
              ) : (
                <div className="divide-y divide-[#f1f3f0]">
                  {announcements.map(announcement => (
                    <div 
                      key={announcement.id}
                      onClick={() => handleMarkAnnouncementRead(announcement.id)}
                      className={`p-3 hover:bg-[#f9faf9] cursor-pointer transition-colors flex gap-3 ${(!announcement.isRead && !readAnnouncementIds.has(announcement.id)) ? 'bg-[#f4f7f4]' : ''}`}
                    >
                      <div className="mt-0.5 p-1.5 rounded-full h-fit bg-blue-50 text-blue-600">
                        <Megaphone size={14} />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs text-varistor-dark font-semibold leading-snug">
                          {announcement.title}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] font-medium text-varistor-muted">
                            By {announcement.author_role}
                          </span>
                          <span className="text-[9px] text-varistor-muted">
                            {new Date(announcement.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      {(!announcement.isRead && !readAnnouncementIds.has(announcement.id)) && (
                        <div className="w-2 h-2 rounded-full bg-varistor-lime self-center" />
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};
