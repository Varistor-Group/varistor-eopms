import React, { useState } from 'react';
import { Megaphone, Camera } from 'lucide-react';
import confetti from 'canvas-confetti';
import { PerformanceMeter } from '../PerformanceMeter';
import { PointsBalance } from '../PointsBalance';
import { TaskSummary } from '../TaskSummary';
import { BirthdayCard } from '../BirthdayCard';

import { MapPin, AlertCircle } from 'lucide-react';
import { useKanbanTasks } from '../../hooks/useKanbanTasks';
import { useVariPoints } from '../../hooks/useVariPoints';
import { useFieldTracking } from '../../hooks/useFieldTracking';
import { mockEmployeeStore } from '../../api/employees';
import { ProfilePictureEditor } from '../ProfilePictureEditor';

export const EmployeeDashboardView: React.FC = () => {
  const { tasks } = useKanbanTasks();
  const { currentRole, currentUser, announcements, reactToAnnouncement, readAnnouncement } = useVariPoints();

  // Profile picture editing
  const [editingAvatar, setEditingAvatar] = useState(false);

  // Find the mocked current user based on role (for field tracking only)
  const mockCurrentUserId = currentRole === 'Reporting Manager' ? '2131' : '2';
  const mockStoreUser = mockEmployeeStore.find(e => e.id === mockCurrentUserId) || mockEmployeeStore[0];

  const { isTracking } = useFieldTracking(currentUser?.id || mockStoreUser?.employeeId || null, !!mockStoreUser?.is_field_employee);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const performanceScore = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const formatRelativeTime = (dateString: string) => {
  // eslint-disable-next-line react-hooks/purity
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const isBirthday = () => {
    const dob = currentUser?.dob;
    if (!dob) return false;
    const today = new Date();
    const dobDate = new Date(dob);
    return today.getMonth() === dobDate.getMonth() && today.getDate() === dobDate.getDate();
  };

  useEffect(() => {
    if (isBirthday()) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#84CC16', '#3b82f6', '#f59e0b', '#ec4899', '#a855f7'],
        zIndex: 9999
      });
    }
  }, [currentUser?.dob]);

  const getGreeting = () => {
    if (isBirthday()) {
      return "Happy Birthday, ";
    }
    const currentHour = new Date().getHours();
    if (currentHour >= 5 && currentHour < 12) return "Good morning, ";
    if (currentHour >= 12 && currentHour < 17) return "Good afternoon, ";
    return "Good evening, ";
  };

  return (
    <div className="space-y-8 md:space-y-6 px-2 md:px-0">
      {/* Welcome Row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 sm:gap-4 mb-4 md:mb-0">
        <div className="flex items-center gap-4">
          {/* Avatar with camera overlay */}
          <div className="relative group flex-shrink-0">
            <img
              src={currentUser?.avatarUrl ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name || mockStoreUser?.fullName || 'Employee')}&background=84CC16&color=fff&size=64&bold=true`}
              alt={currentUser?.name ?? mockStoreUser?.fullName ?? 'Employee'}
              className="w-16 h-16 rounded-full border-2 border-varistor-lime/20 shadow-sm object-cover"
            />
            <button
              onClick={() => setEditingAvatar(v => !v)}
              className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Change profile photo"
            >
              <Camera size={18} className="text-white" strokeWidth={1.8} />
            </button>
          </div>
          <div>
            <h1 className="text-xl font-bold text-varistor-dark">{getGreeting()} {currentUser?.name ?? mockStoreUser?.fullName ?? 'Employee'}{isBirthday() ? '! 🎉' : ''}</h1>
            <p className="text-xs text-varistor-muted mt-0.5">{currentUser?.department ?? mockStoreUser?.department ?? 'General'} Team · {currentUser?.role ?? mockStoreUser?.role ?? 'Employee'}</p>
            <div className="mt-2 flex items-center">
            {isTracking ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-varistor-limeTint border border-varistor-lime/20 text-[10px] font-bold text-varistor-limeText uppercase tracking-wider">
                <MapPin size={12} />
                Location sharing active
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-gray-100 border border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                <AlertCircle size={12} />
                Location sharing unavailable
              </span>
            )}
            </div>
            {/* Inline avatar URL editor */}
            {editingAvatar && (
              <ProfilePictureEditor 
                onClose={() => setEditingAvatar(false)} 
                className="absolute top-16 left-0 mt-2" 
              />
            )}
          </div>
        </div>
        <div className="text-[11px] text-varistor-muted bg-white border border-varistor-border px-3 py-1.5 rounded-full shadow-sm font-semibold">
          Today: {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {/* Birthday Card Popover (appears if birthday match) */}
      <BirthdayCard />

      {/* 3-Column Layout Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-6 mt-4 md:mt-0">
        
        {/* Column 1: Performance Meter & Today's Tasks */}
        <div className="space-y-6">
          <PerformanceMeter score={performanceScore} />
          <TaskSummary />
        </div>

        {/* Column 2: Points Balance & Announcements */}
        <div className="space-y-6">
          <PointsBalance />

          {/* Announcements Card */}
          <div 
            onClick={() => window.dispatchEvent(new CustomEvent('navigateTab', { detail: 'announcements' }))}
            className="bg-white rounded-varistor border border-varistor-border p-5 shadow-varistor flex flex-col h-[280px] justify-between transition-varistor hover:shadow-md cursor-pointer"
          >
            <div className="flex justify-between items-center pb-2 border-b border-varistor-border">
              <h3 className="text-sm font-semibold text-varistor-dark flex items-center gap-1.5">
                <Megaphone size={16} className="text-varistor-lime" />
                Announcements
              </h3>
              <span className="text-[9px] font-bold text-white bg-black px-1.5 py-0.5 rounded uppercase">Feed</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 mt-3 pr-1">
              {announcements.length === 0 ? (
                <p className="text-xs text-varistor-muted italic text-center py-8">No announcements yet.</p>
              ) : (
                announcements.map((ann) => {
                  const isBirthday = ann.type === 'Birthday';
                  
                  if (isBirthday) {
                    return (
                      <div 
                        key={ann.id} 
                        onClick={() => readAnnouncement(ann.id)}
                        className={`p-3 border rounded-lg transition-varistor cursor-pointer relative ${
                          ann.isRead 
                            ? 'border-varistor-border bg-varistor-surfaceMuted hover:bg-varistor-surface'
                            : 'border-varistor-lime bg-varistor-limeLight hover:bg-varistor-surface'
                        }`}
                      >
                        {!ann.isRead && (
                          <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-varistor-lime animate-pulse" />
                        )}
                        <div>
                          <p className="text-xs font-bold text-varistor-dark">{ann.title}</p>
                          <p className="text-[10px] text-varistor-muted mt-0.5 leading-relaxed truncate">{ann.content}</p>
                          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-varistor-border border-dashed">
                            <span className="text-[9px] text-varistor-muted font-semibold uppercase">{ann.author_role} · {formatRelativeTime(ann.created_at)}</span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                reactToAnnouncement(ann.id, '🎉');
                                readAnnouncement(ann.id);
                              }}
                              className="text-[10px] font-bold text-varistor-limeText hover:underline flex items-center gap-0.5 cursor-pointer"
                            >
                              React wishes 🎉
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div 
                      key={ann.id}
                      onClick={() => readAnnouncement(ann.id)}
                      className={`p-3 border rounded-lg transition-varistor cursor-pointer relative ${
                        ann.isRead 
                          ? 'border-varistor-border bg-varistor-surfaceMuted hover:bg-varistor-surface'
                          : 'border-varistor-border bg-varistor-surface hover:bg-varistor-surfaceMuted'
                      }`}
                    >
                      {!ann.isRead && (
                        <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-varistor-lime animate-pulse" />
                      )}
                      <div className="flex justify-between items-start gap-1">
                        <p className="text-xs font-bold text-varistor-dark leading-snug">{ann.title}</p>
                        <span className="text-[9px] font-bold text-varistor-muted flex-shrink-0">
                          {formatRelativeTime(ann.created_at)}
                        </span>
                      </div>
                      <p className="text-[10px] text-varistor-muted mt-1 leading-normal truncate">{ann.content}</p>
                      
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {ann.reactions.map((r) => {
                          if (r.count === 0 && !['👍', '❤️', '🎉'].includes(r.emoji)) return null;
                          return (
                            <button
                              key={r.emoji}
                              onClick={(e) => {
                                e.stopPropagation();
                                reactToAnnouncement(ann.id, r.emoji);
                                readAnnouncement(ann.id);
                              }}
                              className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                                r.reactedByUser 
                                  ? 'bg-varistor-limeLight border-varistor-lime text-varistor-limeText font-bold' 
                                  : 'bg-varistor-surfaceMuted border-varistor-border text-varistor-muted hover:bg-varistor-surface hover:border-varistor-muted'
                              }`}
                            >
                              <span>{r.emoji}</span>
                              {r.count > 0 && <span className="font-bold">{r.count}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Column 3: Leave Balance (Mocked for complete shell structure) */}
        <div className="space-y-6">
          {/* Leaves Tracker */}
          <div 
            onClick={() => window.dispatchEvent(new CustomEvent('navigateTab', { detail: 'leaves' }))}
            className="bg-white rounded-varistor border border-varistor-border p-5 shadow-varistor flex flex-col h-[210px] justify-between transition-varistor hover:shadow-md cursor-pointer"
          >
            <div className="flex justify-between items-center pb-2 border-b border-varistor-border">
              <h3 className="text-sm font-semibold text-varistor-dark">Casual leaves</h3>
              <span className="text-xs font-extrabold text-varistor-dark">7 / 12</span>
            </div>

            <div className="space-y-4 my-2">
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-varistor-muted">
                  <span>Casual Leaves taken</span>
                  <span className="font-semibold text-varistor-dark">5 left</span>
                </div>
                <div className="w-full bg-varistor-surfaceMuted h-1.5 rounded-full overflow-hidden">
                  <div className="bg-varistor-lime h-full w-[58%]" /> {/* 7 / 12 = 58% */}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] text-varistor-muted">
                  <span>Sick Leaves taken</span>
                  <span className="font-semibold text-varistor-dark">2 left (4/6 taken)</span>
                </div>
                <div className="w-full bg-varistor-surfaceMuted h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full w-[66%]" />
                </div>
              </div>
            </div>

            <div className="text-[10px] text-varistor-muted mt-2 pt-2 border-t border-varistor-border flex justify-between">
              <span>Next company holiday:</span>
              <span className="font-semibold text-varistor-dark">26 Jan (Republic Day)</span>
            </div>
          </div>

          {/* HR Document Vault Info Box */}
          <div 
            onClick={() => window.dispatchEvent(new CustomEvent('navigateTab', { detail: 'vault' }))}
            className="bg-gradient-to-tr from-varistor-surface to-varistor-surfaceMuted rounded-varistor border border-varistor-border p-5 shadow-varistor flex flex-col h-[280px] justify-between transition-varistor hover:shadow-md cursor-pointer"
          >
            <div>
              <span className="text-[10px] text-varistor-muted font-bold uppercase tracking-wider block">Security Center</span>
              <h3 className="text-sm font-bold text-varistor-dark mt-2">Document Vault Verified</h3>
              <p className="text-[11px] text-varistor-muted leading-relaxed mt-2">
                All employee compliance records (PAN, Aadhar card, and graduation certificates) are encrypted at rest. Document download URLs expire automatically within 5 minutes.
              </p>
            </div>
            <div className="bg-varistor-surfaceMuted border border-varistor-border rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-varistor-lime" />
                <span className="text-xs font-bold text-varistor-dark">All Files Secure</span>
              </div>
              <span className="text-[10px] text-varistor-muted">Role: Admin</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
