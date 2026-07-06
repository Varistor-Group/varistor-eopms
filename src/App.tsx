import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { KanbanBoard } from './components/KanbanBoard';
import { PointsLedger } from './components/PointsLedger';
import { AnnouncementsFeed } from './components/AnnouncementsFeed';
import { Chat } from './components/Chat';
import { NotificationBell } from './components/NotificationBell';
import { Toast } from './components/Toast';
import { EopmsProvider } from './context/EopmsContext';
import { Menu, X } from 'lucide-react';
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
import { useOrientation } from './hooks/useOrientation';

const AppContent: React.FC = () => {
  const { currentRole, setCurrentRole } = useVariPoints();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [taskNotification, setTaskNotification] = useState<{ title: string; show: boolean } | null>(null);
  const { isLandscape } = useOrientation();

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

  if (window.location.pathname === '/reset') {
    return <ResetPassword />;
  }

  if (!isLoggedIn) {
    return <Login onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className={`min-h-[100dvh] bg-varistor-pageBg text-varistor-dark flex font-sans w-full max-w-[100vw] overflow-x-hidden ${isLandscape && window.innerWidth < 768 ? 'landscape-mobile' : ''}`}>

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
            {/* Live Role Switcher */}
            <div className="flex items-center gap-1.5 bg-[#f1f3f0] px-2.5 py-1.5 rounded-full border border-varistor-border">
              <span className="text-[9px] text-[#555a52] font-bold uppercase tracking-wider hidden md:inline">Role:</span>
              <select
                value={currentRole}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onChange={(e) => setCurrentRole(e.target.value as any)}
                className="bg-transparent text-xs font-bold text-varistor-dark focus:outline-none cursor-pointer pr-1"
                title="Switch active role for permission testing"
              >
                <option value="Employee">Employee</option>
                <option value="Field Employee">Field Employee</option>
                <option value="Reporting Manager">Reporting Manager</option>
                <option value="HR">HR</option>
                <option value="Admin">Admin</option>
              </select>
            </div>

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
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto animate-[fadeInPage_250ms_ease-out]">
          {(() => {
            const getAllowedTabs = () => {
              if (currentRole === 'Admin') {
                return ['dashboard', 'admin', 'attendance', 'field-tracker', 'vault', 'announcements', 'policy', 'payroll', 'leaves', 'chat', 'engine-simulation', 'training'];
              } else if (currentRole === 'HR') {
                return ['dashboard', 'admin', 'attendance', 'field-tracker', 'ledger', 'vault', 'announcements', 'policy', 'payroll', 'leaves', 'chat', 'engine-simulation', 'training'];
              } else if (currentRole === 'Reporting Manager') {
                return ['dashboard', 'attendance', 'task-management', 'leaves', 'announcements', 'policy', 'chat', 'training'];
              } else {
                // Employee and Field Employee
                return ['dashboard', 'kanban', 'attendance', 'ledger', 'announcements', 'policy', 'vault', 'leaves', 'payroll', 'chat', 'training'];
              }
            };

            const allowedTabs = getAllowedTabs();
            if (!allowedTabs.includes(activeTab)) {
              return (
                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-varistor border border-red-200 shadow-sm animate-[fadeInPage_250ms_ease-out]">
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
        <div className="fixed top-6 right-6 z-50 bg-white border-l-4 border-varistor-lime shadow-lg rounded-r-lg p-4 w-80 animate-[slideInRight_0.3s_ease-out]">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-sm text-varistor-dark">New Task Assigned!</h3>
              <p className="text-xs text-varistor-muted mt-1">You have been assigned: <span className="font-semibold text-varistor-dark">{taskNotification.title}</span></p>
            </div>
            <button onClick={() => setTaskNotification({ ...taskNotification, show: false })} className="text-gray-400 hover:text-gray-600 transition-colors">
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
    <EopmsProvider>
      <AppContent />
    </EopmsProvider>
  );
};

export default App;