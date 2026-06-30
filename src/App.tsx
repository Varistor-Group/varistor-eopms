import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { KanbanBoard } from './components/KanbanBoard';
import { PointsLedger } from './components/PointsLedger';
import { AnnouncementsFeed } from './components/AnnouncementsFeed';
import { Toast } from './components/Toast';
import { EopmsProvider } from './context/EopmsContext';
import { Menu, Bell, Search } from 'lucide-react';
import { useVariPoints } from './hooks/useVariPoints';
import { Login } from './components/Login';
import { DocumentVault } from './components/DocumentVault';
import { AdminCreateEmployee } from './components/AdminCreateEmployee';

const AppContent: React.FC = () => {
  const { currentRole, setCurrentRole } = useVariPoints();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard';
      case 'kanban': return 'Task Board';
      case 'ledger': return 'Points Ledger';
      case 'announcements': return 'Announcements Feed';
      case 'vault': return 'Document Vault';
      case 'admin': return 'Create Employee';
      default: return 'EOPMS';
    }
  };

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="min-h-screen bg-varistor-pageBg text-varistor-dark flex font-sans w-full">
      
      {/* Sidebar navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpenMobile={isOpenMobile} 
        setIsOpenMobile={setIsOpenMobile} 
      />

      {/* Main Panel Content Area */}
      <div className="flex-1 flex flex-col lg:pl-[220px]">
        
        {/* Top Header bar */}
        <header className="h-16 bg-white border-b border-varistor-border flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            {/* Mobile Sidebar Toggle Button */}
            <button 
              onClick={() => setIsOpenMobile(true)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-varistor-dark"
              title="Open menu"
            >
              <Menu size={20} />
            </button>
            <h2 className="font-bold text-[#111] text-base lg:text-lg">{getPageTitle()}</h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Mock Search */}
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-2.5 text-varistor-muted" size={15} />
              <input 
                type="text" 
                placeholder="Search everything..."
                className="bg-[#f1f3f0] border border-transparent rounded-full pl-9 pr-4 py-1.5 text-xs w-[180px] focus:outline-none focus:bg-white focus:border-varistor-lime transition-all"
              />
            </div>

            {/* Live Role Switcher */}
            <div className="flex items-center gap-1.5 bg-[#f1f3f0] px-2.5 py-1.5 rounded-full border border-varistor-border">
              <span className="text-[9px] text-[#555a52] font-bold uppercase tracking-wider hidden md:inline">Role:</span>
              <select
                value={currentRole}
                onChange={(e) => setCurrentRole(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-varistor-dark focus:outline-none cursor-pointer pr-1"
                title="Switch active role for permission testing"
              >
                <option value="Employee">Employee</option>
                <option value="Reporting Manager">Reporting Manager</option>
                <option value="HR">HR</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

            {/* Notification Bell */}
            <button 
              className="p-2 rounded-full hover:bg-[#f1f3f0] transition-colors relative"
              title="Notifications"
            >
              <Bell size={18} strokeWidth={1.5} className="text-varistor-dark" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-varistor-lime animate-pulse" />
            </button>

            {/* User Profile */}
            <div className="flex items-center gap-2 border-l border-varistor-border pl-4">
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=60" 
                alt="User Profile" 
                className="w-8 h-8 rounded-full object-cover border border-varistor-border"
              />
              <span className="text-xs font-semibold text-varistor-dark hidden sm:inline">Aarav Patel</span>
            </div>
          </div>
        </header>

        {/* Dynamic Inner Page Content */}
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto animate-[fadeInPage_250ms_ease-out]">
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'kanban' && <KanbanBoard />}
          {activeTab === 'ledger' && <PointsLedger />}
          {activeTab === 'announcements' && <AnnouncementsFeed />}
          {activeTab === 'vault' && <DocumentVault />}
          {activeTab === 'admin' && <AdminCreateEmployee />}
        </main>
      </div>

      {/* Floating Bottom-Right Points Toast notifications */}
      <Toast />

      {/* Page Fade-in Keyframe */}
      <style>{`
        @keyframes fadeInPage {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <EopmsProvider>
      <AppContent />
    </EopmsProvider>
  );
};

export default App;
