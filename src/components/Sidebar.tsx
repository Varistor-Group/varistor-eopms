import React from 'react';
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
  X,
  Users
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
  const { currentRole } = useVariPoints();
  const hasAdminAccess = currentRole === 'Admin' || currentRole === 'HR';
  const isEmployee = currentRole === 'Employee';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, enabled: true },
    { id: 'kanban', label: 'My tasks', icon: Kanban, enabled: true },
    { id: 'ledger', label: 'Vari Points', icon: Award, enabled: true },
    { id: 'announcements', label: 'Announcements', icon: Megaphone, enabled: true },
    { id: 'vault', label: 'Document Vault', icon: Lock, enabled: true },
    ...(hasAdminAccess ? [{ id: 'admin', label: 'Employees', icon: Users, enabled: true }] : []),
    { id: 'leaves', label: 'Leaves', icon: Calendar, enabled: false },
    ...(isEmployee ? [] : [{ id: 'payroll', label: 'Payroll', icon: CreditCard, enabled: hasAdminAccess }]),
    { id: 'chat', label: 'Chat', icon: MessageSquare, enabled: false },
    { id: 'training', label: 'Training', icon: BookOpen, enabled: true }
  ];

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
              : 'text-[#555a52] border-transparent hover:bg-[#eef1ed] hover:text-black'
              } ${!item.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Icon
              size={18}
              strokeWidth={1.5}
              className={`flex-shrink-0 transition-transform group-hover:scale-105 ${isActive ? 'text-varistor-dark' : 'text-[#6b7264]'
                }`}
            />
            {/* Expanded Text */}
            <span className="ml-3 truncate lg:block hidden">{item.label}</span>
            {/* Mobile Drawer Text */}
            <span className="ml-3 truncate block lg:hidden">{item.label}</span>

            {/* Non-enabled Module Tooltip */}
            {!item.enabled && (
              <span className="absolute left-full ml-2 px-2 py-1 text-xs bg-black text-white rounded opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none whitespace-nowrap">
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
      <aside className="fixed inset-y-0 left-0 hidden lg:flex flex-col bg-white border-r border-varistor-border transition-all duration-300 z-30 lg:w-[220px] w-[70px]">
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

        {/* User Card (Bottom) */}
        <div className="p-4 border-t border-varistor-border lg:block hidden">
          <div className="flex items-center gap-3">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60"
              alt="Aarav Patel"
              className="w-9 h-9 rounded-full object-cover border border-varistor-border"
            />
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-varistor-dark truncate">Aarav Patel</p>
              <p className="text-[10px] text-varistor-muted truncate">Operations Dept</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 z-50 lg:hidden"
          onClick={() => setIsOpenMobile(false)}
        />
      )}

      {/* Mobile Drawer Shell */}
      <aside className={`fixed inset-y-0 left-0 bg-white w-64 max-w-xs flex flex-col z-50 transform transition-transform duration-200 lg:hidden ${isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-varistor-border">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Varistor Logo" className="h-8 w-auto object-contain block" />
            <div>
              <span className="font-semibold text-[#111]">Varistor EOPMS</span>
            </div>
          </div>
          <button
            onClick={() => setIsOpenMobile(false)}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <X size={20} className="text-varistor-dark" />
          </button>
        </div>

        {renderNavList()}

        <div className="p-4 border-t border-varistor-border">
          <div className="flex items-center gap-3">
            <img
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60"
              alt="Aarav Patel"
              className="w-10 h-10 rounded-full object-cover"
            />
            <div>
              <p className="text-sm font-semibold text-varistor-dark">Aarav Patel</p>
              <p className="text-xs text-varistor-muted">Operations Dept</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
