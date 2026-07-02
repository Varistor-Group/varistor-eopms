import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { KanbanBoard } from './components/KanbanBoard';
import { PointsLedger } from './components/PointsLedger';
import { AnnouncementsFeed } from './components/AnnouncementsFeed'; // eslint-disable-line import/no-unresolved
import { Chat } from './components/Chat';
import { NotificationBell } from './components/NotificationBell';
import { Toast } from './components/Toast';
import { EopmsProvider } from './context/EopmsContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { useVariPoints } from './hooks/useVariPoints';
import { Login } from './components/Login';
import { DocumentVault } from './components/DocumentVault';
import { EmployeeManagementPortal } from './components/EmployeeManagementPortal';
import { EngineSimulationConsole } from './components/EngineSimulationConsole';
import { TaskManagement } from './components/TaskManagement';
import { ResetPassword } from './components/ResetPassword';
import TrainingLibrary from './components/TrainingLibrary';

const AppContent: React.FC = () => {
  const { currentRole, setCurrentRole } = useVariPoints();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [taskNotification, setTaskNotification] = useState<{ title: string; show: boolean } | null>(null);

  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setActiveTab(customEvent.detail);
      }
    };
    window.addEventListener('navigateTab', handleNavigate);
    return () => window.removeEventListener('navigateTab', handleNavigate);
  }, []);

  useEffect(() => {
    const channel = new BroadcastChannel('eopms_notifications');
    channel.onmessage = (event) => {
      if (event.data.type === 'TASK_ASSIGNED') {
        const MOCK_CURRENT_USER_ID = currentRole === 'Reporting Manager' ? 'VAR-001' : 'VAR-024';
        // Simulating matching assignee to currently logged in user context
        if (event.data.assigneeId === MOCK_CURRENT_USER_ID) {
          setTaskNotification({ title: event.data.title, show: true });
          setTimeout(() => {
            setTaskNotification(prev => prev ? { ...prev, show: false } : null);
          }, 5000);
        }
      }
    };
    return () => channel.close();
  }, [currentRole]);

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Dashboard';
      case 'kanban': return 'Task Board';
      case 'ledger': return 'Points Ledger';
      case 'announcements': return 'Announcements Feed';
      case 'chat': return 'Team Chat';
      case 'vault': return 'Document Vault';
      case 'admin': return 'Employees';
      case 'task-management': return 'Task Management';
      case 'engine-simulation': return 'Engine Simulation Console';
      case 'training': return 'Training Library';
      default: return 'EOPMS';
    }
  };

  if (window.location.pathname === '/reset') {
    return <ResetPassword />;
  }

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
        <header className="h-16 bg-varistor-surface border-b border-varistor-border flex items-center justify-between px-6 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            {/* Mobile Sidebar Toggle Button */}
            <button
              onClick={() => setIsOpenMobile(true)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-varistor-surfaceMuted transition-colors text-varistor-dark"
              title="Open menu"
            >
              <Menu size={20} />
            </button>
            <h2 className="font-bold text-varistor-dark text-base lg:text-lg">{getPageTitle()}</h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Live Role Switcher */}
            <div className="flex items-center gap-1.5 bg-varistor-surfaceMuted px-2.5 py-1.5 rounded-full border border-varistor-border">
              <span className="text-[9px] text-varistor-muted font-bold uppercase tracking-wider hidden md:inline">Role:</span>
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

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-varistor-surfaceMuted transition-colors cursor-pointer text-varistor-dark"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
            </button>

            {/* Notification Bell */}
            <NotificationBell onNavigateToChat={() => setActiveTab('chat')} />

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
          {(() => {
            const getAllowedTabs = () => {
              if (currentRole === 'Admin' || currentRole === 'HR') {
                return ['dashboard', 'admin', 'vault', 'announcements', 'payroll', 'leaves', 'chat', 'engine-simulation', 'training'];
              } else if (currentRole === 'Reporting Manager') {
                return ['dashboard', 'task-management', 'announcements', 'chat', 'training'];
              } else {
                return ['dashboard', 'kanban', 'ledger', 'announcements', 'vault', 'leaves', 'payroll', 'chat', 'training'];
              }
            };

            const allowedTabs = getAllowedTabs();
            if (!allowedTabs.includes(activeTab)) {
              return (
                <div className="flex flex-col items-center justify-center h-64 bg-varistor-surface rounded-varistor border border-varistor-dangerBorder shadow-sm animate-[fadeInPage_250ms_ease-out]">
                  <div className="text-red-500 font-bold text-6xl mb-4">403</div>
                  <h2 className="text-xl font-bold text-varistor-dark">Forbidden Access</h2>
                  <p className="text-sm text-varistor-muted mt-2 text-center max-w-sm">You do not have the required permissions to view this page.</p>
                </div>
              );
            }

            return (
              <>
                {activeTab === 'dashboard' && <Dashboard />}
                {activeTab === 'kanban' && <KanbanBoard />}
                {activeTab === 'ledger' && <PointsLedger />}
                {activeTab === 'announcements' && <AnnouncementsFeed />}
                {activeTab === 'chat' && <Chat />}
                {activeTab === 'vault' && <DocumentVault />}
                {activeTab === 'task-management' && <TaskManagement />}
                {activeTab === 'admin' && <EmployeeManagementPortal />}
                {activeTab === 'engine-simulation' && <EngineSimulationConsole />}
                {activeTab === 'training' && <TrainingLibrary />}
              </>
            );
          })()}
        </main>
      </div>

      {/* Floating Bottom-Right Points Toast notifications */}
      <Toast />

      {/* Real-time Task Notification Pop-up */}
      {taskNotification && taskNotification.show && (
        <div className="fixed top-6 right-6 z-50 bg-varistor-surface border-l-4 border-varistor-lime shadow-lg rounded-r-lg p-4 w-80 animate-[slideInRight_0.3s_ease-out]">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-sm text-varistor-dark">New Task Assigned!</h3>
              <p className="text-xs text-varistor-muted mt-1">You have been assigned: <span className="font-semibold text-varistor-dark">{taskNotification.title}</span></p>
            </div>
            <button onClick={() => setTaskNotification({ ...taskNotification, show: false })} className="text-varistor-muted hover:text-varistor-dark transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Page Fade-in Keyframe */}
      <style>{`
        @keyframes fadeInPage {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <EopmsProvider>
        <AppContent />
      </EopmsProvider>
    </ThemeProvider>
  );
};

export default App;
