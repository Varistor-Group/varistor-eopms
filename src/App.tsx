import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { KanbanBoard } from './components/KanbanBoard';
import { PointsLedger } from './components/PointsLedger';
import { AnnouncementsFeed } from './components/AnnouncementsFeed';
import { Chat } from './components/Chat';
import { NotificationBell } from './components/NotificationBell';

import { Toast } from './components/Toast';
import { EopmsProvider } from './context/EopmsContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { Menu, X, LogOut, Sun, Moon } from 'lucide-react';
import { useVariPoints } from './hooks/useVariPoints';
import { Login } from './components/Login';
import { DocumentVault } from './components/DocumentVault';
import { EmployeeManagementPortal } from './components/EmployeeManagementPortal';
import { EngineSimulationConsole } from './components/EngineSimulationConsole';
import { TaskManagement } from './components/TaskManagement';
import { ResetPassword } from './components/ResetPassword';
import TrainingLibrary from './components/TrainingLibrary';
import { FieldTracker } from './components/FieldTracker';
import { PolicyPage } from './components/PolicyPage';
import Payroll from './components/Payroll';
import { Attendance } from './components/Attendance';
import Leaves from './components/Leaves';
import { ProfilePictureEditor } from './components/ProfilePictureEditor';
import { useFieldTracking } from './hooks/useFieldTracking';
import { mockEmployeeStore } from './api/employees';

const FieldTrackerBackground: React.FC = () => {
  const { currentRole, currentUser } = useVariPoints();
  const mockCurrentUserId = currentRole === 'Reporting Manager' ? '2131' : '2';
  const mockStoreUser = mockEmployeeStore.find(e => e.id === mockCurrentUserId) || mockEmployeeStore[0];

  useFieldTracking(currentUser?.id || mockStoreUser?.employeeId || null, !!mockStoreUser?.is_field_employee);
  return null;
};

const AppContent: React.FC = () => {
  const { currentRole, currentUser, setCurrentUser, setCurrentRole } = useVariPoints();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [taskNotification, setTaskNotification] = useState<{ title: string; show: boolean } | null>(null);

  // Profile dropdown state
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

  // Refs for back button handler to avoid stale closures
  const activeTabRef = useRef(activeTab);
  const isOpenMobileRef = useRef(isOpenMobile);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { isOpenMobileRef.current = isOpenMobile; }, [isOpenMobile]);

  // Handle hardware back button globally
  useEffect(() => {
    // We must dynamically import to avoid breaking the web build if Capacitor is missing
    let listener: any = null;
    
    // Hide native status bar if on mobile
    import('@capacitor/status-bar').then(({ StatusBar }) => {
      StatusBar.hide().catch(console.warn);
    }).catch(console.warn);

    import('@capacitor/app').then(({ App: CapApp }) => {
      listener = CapApp.addListener('backButton', () => {
        // First check if any inner component (like Chat sidebar) wants to consume this
        const event = new CustomEvent('app_back_button', { cancelable: true });
        window.dispatchEvent(event);
        if (event.defaultPrevented) return;

        if (isOpenMobileRef.current) {
          setIsOpenMobile(false);
        } else if (activeTabRef.current === 'dashboard') {
          CapApp.exitApp();
        } else {
          setIsOpenMobile(true);
        }
      });
    }).catch(console.warn);

    return () => {
      if (listener && typeof listener.remove === 'function') {
        listener.remove();
      }
    };
  }, []);

  // ── Fix #7: Auto-restore session from localStorage on app mount ──────
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('eopms_current_user');
      const savedRole = localStorage.getItem('eopms_role');
      if (savedUser && savedRole) {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setCurrentRole(savedRole as any);
        setIsLoggedIn(true);
      }
    } catch {
      // Corrupted data – clear and force re-login
      localStorage.removeItem('eopms_current_user');
      localStorage.removeItem('eopms_role');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogin = (isFirstLogin: boolean) => {
    setIsLoggedIn(true);
    if (isFirstLogin) {
      setActiveTab('training');
    }
  };

  const handleLogout = () => {
    // Clear all session data
    localStorage.removeItem('eopms_current_user');
    localStorage.removeItem('eopms_role');
    localStorage.removeItem('eopms_first_login_done');
    setCurrentUser(null);
    setActiveTab('dashboard');
    setIsLoggedIn(false);
  };

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
        const MOCK_CURRENT_USER_ID = currentRole === 'Reporting Manager' ? '2131' : '2';
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
      case 'field-tracker': return 'Field Tracker';
      case 'training': return 'Training Library';
      case 'policy': return 'Company Policy';
      case 'leaves': return 'Leave Management';
      case 'payroll': return 'Payroll — Salary Engine';
      case 'attendance': return 'Attendance';
      default: return 'EOPMS';
    }
  };

  if (window.location.pathname === '/reset' || window.location.pathname === '/reset-password' || window.location.hash.includes('type=recovery')) {
    return <ResetPassword />;
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className={`min-h-[100dvh] bg-varistor-pageBg text-varistor-dark flex font-sans w-full max-w-[100vw] overflow-x-hidden ${isLandscape && window.innerWidth < 768 ? 'landscape-mobile' : ''}`}>
      <FieldTrackerBackground />
      {/* Sidebar navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpenMobile={isOpenMobile}
        setIsOpenMobile={setIsOpenMobile}
      />

      {/* Main Panel Content Area */}
      <div className="flex-1 flex flex-col lg:pl-[220px] min-w-0">

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

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full border border-varistor-border bg-varistor-surfaceMuted hover:bg-varistor-surface transition-colors cursor-pointer text-varistor-dark"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
            </button>
            {/* Notification Bell */}
            <NotificationBell onNavigateToChat={() => setActiveTab('chat')} />

            {/* User Profile */}
            {/* User Profile + Logout */}
            <div className="relative flex items-center gap-2 border-l border-varistor-border pl-4">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 focus:outline-none text-left hover:opacity-80 transition-opacity"
              >
                <img
                  src={currentUser?.avatarUrl ?? 'https://ui-avatars.com/api/?name=User&background=84cc16&color=fff'}
                  alt={currentUser?.name ?? 'User'}
                  className="w-8 h-8 rounded-full object-cover border border-varistor-border"
                />
                <div className="hidden sm:flex flex-col">
                  <span className="text-xs font-semibold text-varistor-dark leading-tight">{currentUser?.name ?? 'User'}</span>
                  <span className="text-[10px] text-varistor-muted leading-tight">{currentUser?.department ?? ''}</span>
                </div>
              </button>

              <button
                onClick={handleLogout}
                title="Logout"
                className="ml-1 p-1.5 rounded-lg text-varistor-muted hover:text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut size={15} strokeWidth={1.8} />
              </button>

              {/* Profile Dropdown */}
              {isProfileMenuOpen && (
                <ProfilePictureEditor onClose={() => setIsProfileMenuOpen(false)} />
              )}
            </div>
          </div>
        </header>

        {/* Dynamic Inner Page Content */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto animate-[fadeInPage_250ms_ease-out]">
          {(() => {
            const getAllowedTabs = () => {
              if (currentRole === 'Admin') {
                // Admin has access to everything
                return ['dashboard', 'admin', 'task-management', 'kanban', 'attendance', 'field-tracker', 'ledger', 'vault', 'announcements', 'policy', 'payroll', 'leaves', 'chat', 'engine-simulation', 'training'];
              } else if (currentRole === 'HR') {
                // HR does not have Vari Points (ledger)
                return ['dashboard', 'admin', 'attendance', 'field-tracker', 'vault', 'announcements', 'policy', 'payroll', 'leaves', 'chat', 'engine-simulation', 'training'];
              } else if (currentRole === 'Reporting Manager') {
                // All employee tabs (minus vault & attendance) + task-management
                return ['dashboard', 'task-management', 'kanban', 'ledger', 'announcements', 'policy', 'leaves', 'payroll', 'chat', 'training'];
              } else {
                // Employee and Field Employee
                return ['dashboard', 'kanban', 'attendance', 'ledger', 'announcements', 'policy', 'vault', 'leaves', 'payroll', 'chat', 'training'];
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
                {activeTab === 'field-tracker' && <FieldTracker />}
                {activeTab === 'engine-simulation' && <EngineSimulationConsole />}
                {activeTab === 'training' && <TrainingLibrary />}
                {activeTab === 'policy' && <PolicyPage />}
                {activeTab === 'payroll' && <Payroll />}
                {activeTab === 'attendance' && <Attendance />}
                {activeTab === 'leaves' && <Leaves />}
              </>
            );
          })()}
        </main>
      </div>

      {/* Floating Bottom-Right Points Toast notifications */}
      <Toast />

      {/* Real-time Task Notification Pop-up */}
      {taskNotification && taskNotification.show && (
        <div className="fixed top-[calc(1rem+env(safe-area-inset-top))] left-4 right-4 z-50 max-w-sm mx-auto bg-varistor-surface border-l-4 border-varistor-lime shadow-lg rounded-r-lg p-4 animate-[slideInRight_0.3s_ease-out]">
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