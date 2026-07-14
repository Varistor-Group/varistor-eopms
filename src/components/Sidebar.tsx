import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Kanban,
  Award,
  Megaphone,
  Calendar,
  CreditCard,
  MessageSquare,
  BookOpen,
  Lock,
  MapPin,
  X,
  UserPlus,
  ShieldAlert,
  ScrollText,
  ClipboardCheck,
  ListChecks,
  Download
} from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpenMobile: boolean;
  setIsOpenMobile: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpenMobile,
  setIsOpenMobile
}) => {
  const { currentRole, currentUser } = useVariPoints();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (isOpenMobile) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isOpenMobile]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let menuItems: any[] = [];

  if (currentRole === 'Admin') {
    menuItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, enabled: true },
      { id: 'admin', label: 'Create Employee', icon: UserPlus, enabled: true },
      { id: 'task-management', label: 'Task Management', icon: ListChecks, enabled: true },
      { id: 'kanban', label: 'My Tasks', icon: Kanban, enabled: true },
      { id: 'attendance', label: 'Attendance', icon: ClipboardCheck, enabled: true },
      { id: 'field-tracker', label: 'Field Tracking', icon: MapPin, enabled: true },
      { id: 'ledger', label: 'Vari Points', icon: Award, enabled: true },
      { id: 'vault', label: 'Document Vault', icon: Lock, enabled: true },
      { id: 'announcements', label: 'Announcements', icon: Megaphone, enabled: true },
      { id: 'policy', label: 'Policy', icon: ScrollText, enabled: true },
      { id: 'payroll', label: 'Payroll', icon: CreditCard, enabled: true },
      { id: 'leaves', label: 'Leaves', icon: Calendar, enabled: true },
      { id: 'chat', label: 'Chat', icon: MessageSquare, enabled: true },
      { id: 'engine-simulation', label: 'VP Management', icon: ShieldAlert, enabled: true },
      { id: 'training', label: 'Training', icon: BookOpen, enabled: true }
    ];
  } else if (currentRole === 'HR') {
    menuItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, enabled: true },
      { id: 'admin', label: 'Create Employee', icon: UserPlus, enabled: true },
      { id: 'attendance', label: 'Attendance', icon: ClipboardCheck, enabled: true },
      { id: 'field-tracker', label: 'Field Tracking', icon: MapPin, enabled: true },
      { id: 'vault', label: 'Document Vault', icon: Lock, enabled: true },
      { id: 'announcements', label: 'Announcements', icon: Megaphone, enabled: true },
      { id: 'policy', label: 'Policy', icon: ScrollText, enabled: true },
      { id: 'payroll', label: 'Payroll', icon: CreditCard, enabled: true },
      { id: 'leaves', label: 'Leaves', icon: Calendar, enabled: true },
      { id: 'chat', label: 'Chat', icon: MessageSquare, enabled: true },
      { id: 'engine-simulation', label: 'VP Management', icon: ShieldAlert, enabled: true },
      { id: 'training', label: 'Training', icon: BookOpen, enabled: true }
    ];
  } else if (currentRole === 'Reporting Manager') {
    menuItems = [
      { id: 'dashboard', label: 'Manager Dashboard', icon: LayoutDashboard, enabled: true },
      { id: 'task-management', label: 'Task Management', icon: ListChecks, enabled: true },
      { id: 'kanban', label: 'My Tasks', icon: Kanban, enabled: true },
      { id: 'ledger', label: 'Vari Points', icon: Award, enabled: true },
      { id: 'announcements', label: 'Announcements', icon: Megaphone, enabled: true },
      { id: 'policy', label: 'Policy', icon: ScrollText, enabled: true },
      { id: 'leaves', label: 'Leaves', icon: Calendar, enabled: true },
      { id: 'payroll', label: 'Payroll', icon: CreditCard, enabled: true },
      { id: 'chat', label: 'Chat', icon: MessageSquare, enabled: true },
      { id: 'training', label: 'Training', icon: BookOpen, enabled: true }
    ];
  } else {
    // Employee
    menuItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, enabled: true },
      { id: 'kanban', label: 'My Tasks', icon: Kanban, enabled: true },
      { id: 'attendance', label: 'Attendance', icon: ClipboardCheck, enabled: true },
      { id: 'ledger', label: 'Vari Points', icon: Award, enabled: true },
      { id: 'announcements', label: 'Announcements', icon: Megaphone, enabled: true },
      { id: 'policy', label: 'Policy', icon: ScrollText, enabled: true },
      { id: 'vault', label: 'Document Vault', icon: Lock, enabled: true },
      { id: 'leaves', label: 'Leaves', icon: Calendar, enabled: true },
      { id: 'payroll', label: 'Payroll', icon: CreditCard, enabled: true },
      { id: 'chat', label: 'Chat', icon: MessageSquare, enabled: true },
      { id: 'training', label: 'Training', icon: BookOpen, enabled: true }
    ];
  }

  const handleTabClick = (itemId: string, enabled: boolean) => {
    if (!enabled) return;
    setActiveTab(itemId);
    setIsOpenMobile(false);
  };

  const renderNavList = () => (
    <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
      {menuItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;

        return (
          <button
            key={item.id}
            onClick={() => handleTabClick(item.id, item.enabled)}
            className={`w-full flex items-center px-3 py-3 text-sm font-medium rounded-varistor border-l-[3px] transition-varistor group relative ${isActive
              ? 'bg-varistor-limeLight text-varistor-dark border-varistor-lime'
              : 'text-varistor-muted border-transparent hover:bg-varistor-surfaceMuted hover:text-varistor-dark'
              } ${!item.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Icon
              size={18}
              strokeWidth={1.5}
              className={`flex-shrink-0 transition-transform group-hover:scale-105 ${isActive ? 'text-varistor-dark' : 'text-varistor-muted'
                }`}
            />
            {/* Expanded Text */}
            <span className="ml-3 truncate lg:block hidden">{item.label}</span>
            {/* Mobile Drawer Text */}
            <span className="ml-3 truncate block lg:hidden">{item.label}</span>

            {/* Non-enabled Module Tooltip */}
            {!item.enabled && (
              <span className="absolute left-full ml-2 px-2 py-1 text-xs bg-varistor-dark text-varistor-pageBg rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none whitespace-nowrap">
                Owned by another intern
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop Sidebar Shell */}
      <aside className="fixed inset-y-0 left-0 hidden lg:flex flex-col bg-varistor-surface border-r border-varistor-border transition-all duration-300 z-30 lg:w-[220px] w-[70px] pt-safe pb-safe pl-safe">
        {/* Header/Logo */}
        <div className="h-16 flex items-center px-6 border-b border-varistor-border">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Varistor Logo" className="h-8 w-auto object-contain block" />
            <div className="lg:flex flex-col hidden">
              <span className="text-[10px] font-bold text-varistor-muted mt-0.5 tracking-widest uppercase">EOPMS v1.0</span>
            </div>
          </div>
        </div>

        {/* Navigation list */}
        {renderNavList()}

        {/* Install App Button */}
        {deferredPrompt && (
          <div className="p-4 border-t border-varistor-border lg:block hidden">
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Download size={18} />
              Install App
            </button>
          </div>
        )}

        {/* User Card (Bottom) */}
        <div className="p-4 border-t border-varistor-border lg:block hidden">
          <div className="flex items-center gap-3">
            <img
              src={currentUser?.avatarUrl ?? 'https://ui-avatars.com/api/?name=User&background=84cc16&color=fff'}
              alt={currentUser?.name ?? 'User'}
              className="w-9 h-9 rounded-full object-cover border border-varistor-border"
            />
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-varistor-dark truncate">{currentUser?.name ?? 'User'}</p>
              <p className="text-[10px] text-varistor-muted truncate">{currentUser?.department ?? ''}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-[rgba(0,0,0,0.4)] transition-opacity duration-300 z-[1000] lg:hidden"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      {/* Mobile Drawer Shell */}
      <aside className={`fixed inset-y-0 left-0 bg-varistor-surface w-64 max-w-xs flex flex-col z-[1000] transform transition-transform duration-200 lg:hidden pt-safe pb-safe pl-safe ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-varistor-border">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Varistor Logo" className="h-8 w-auto object-contain block" />
            <div>
              <span className="font-semibold text-varistor-dark">Varistor EOPMS</span>
            </div>
          </div>
          <button
            onClick={() => setIsOpenMobile(false)}
            className="p-1 rounded-full hover:bg-varistor-surfaceMuted"
          >
            <X size={20} className="text-varistor-dark" />
          </button>
        </div>

        {renderNavList()}

        {deferredPrompt && (
          <div className="p-4 border-t border-varistor-border">
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Download size={20} />
              Install App
            </button>
          </div>
        )}

        <div className="p-4 border-t border-varistor-border">
          <div className="flex items-center gap-3">
            <img
              src={currentUser?.avatarUrl ?? 'https://ui-avatars.com/api/?name=User&background=84cc16&color=fff'}
              alt={currentUser?.name ?? 'User'}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <p className="text-sm font-semibold text-varistor-dark">{currentUser?.name ?? 'User'}</p>
              <p className="text-xs text-varistor-muted">{currentUser?.department ?? ''}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
