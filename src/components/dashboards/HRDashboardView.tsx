import React, { useState } from 'react';
import { Users, Calendar, FileText, Megaphone, Camera, CheckCircle, Clock } from 'lucide-react';
import { useVariPoints } from '../../hooks/useVariPoints';
import { ProfilePictureEditor } from '../ProfilePictureEditor';
import { getEmployees, type Employee } from '../../api/employees';
import { getLeaveRequests } from '../../api/leaves';

export const HRDashboardView: React.FC = () => {
  const { currentUser } = useVariPoints();
  const [editingAvatar, setEditingAvatar] = useState(false);

  const [employees, setEmployees] = useState<Employee[]>([]);

  React.useEffect(() => {
    getEmployees().then(setEmployees);
  }, []);

  const allLeaves = getLeaveRequests();
  const pendingLeaves = allLeaves.filter(l => l.status === 'Pending');
  const approvedThisMonth = allLeaves.filter(l => {
    if (l.status !== 'Approved') return false;
    const month = new Date().getMonth();
    const year = new Date().getFullYear();
    const d = new Date(l.reviewedAt ?? l.submittedAt);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const totalHeadcount = employees.length;
  const activeCount = employees.filter(e => e.status === 'Active').length;

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'Good morning';
    if (h >= 12 && h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const statCards = [
    { label: 'Total Headcount', value: totalHeadcount, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50', tab: 'admin' },
    { label: 'Active Employees', value: activeCount, icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50', tab: 'admin' },
    { label: 'Pending Leaves', value: pendingLeaves.length, icon: Clock, color: 'text-orange-500', bg: 'bg-orange-50', tab: 'leaves' },
    { label: 'Approved This Month', value: approvedThisMonth.length, icon: Calendar, color: 'text-purple-500', bg: 'bg-purple-50', tab: 'leaves' },
  ];

  return (
    <div className="space-y-6 animate-[fadeInPage_250ms_ease-out]">

      {/* Welcome / Profile header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="relative group flex-shrink-0">
            <img
              src={currentUser?.avatarUrl ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser?.name ?? 'HR')}&background=6366F1&color=fff&size=64&bold=true`}
              alt={currentUser?.name ?? 'HR'}
              className="w-14 h-14 rounded-full border-2 border-indigo-200 shadow-sm object-cover"
            />
            <button
              onClick={() => setEditingAvatar(v => !v)}
              className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="Change profile photo"
            >
              <Camera size={16} className="text-white" strokeWidth={1.8} />
            </button>
            {editingAvatar && (
              <ProfilePictureEditor
                onClose={() => setEditingAvatar(false)}
                className="absolute top-16 left-0 mt-2"
              />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-varistor-dark">
              {getGreeting()}, {currentUser?.name ?? 'HR'}
            </h1>
            <p className="text-xs text-varistor-muted mt-0.5">
              {currentUser?.department ?? 'Human Resources'} · HR Portal
            </p>
          </div>
        </div>
        <div className="text-[11px] text-varistor-muted bg-white border border-varistor-border px-3 py-1.5 rounded-full shadow-sm font-semibold">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(card => (
          <div 
            key={card.label} 
            onClick={() => window.dispatchEvent(new CustomEvent('navigateTab', { detail: card.tab }))}
            className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-5 flex items-center gap-4 cursor-pointer hover:shadow-md transition-varistor"
          >
            <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center flex-shrink-0`}>
              <card.icon size={20} className={card.color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-varistor-dark">{card.value}</p>
              <p className="text-xs text-varistor-muted">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee List */}
        <div className="lg:col-span-2 bg-white rounded-varistor border border-varistor-border shadow-varistor p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-indigo-500" />
              <h2 className="text-lg font-bold text-varistor-dark">All Employees</h2>
            </div>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('navigateTab', { detail: 'admin' }))}
              className="text-xs text-indigo-500 font-bold hover:underline"
            >
              Manage →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-varistor-muted uppercase bg-varistor-surfaceMuted border-b border-varistor-border">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-varistor-muted">
                      No employees found. Create employees from the Admin panel.
                    </td>
                  </tr>
                ) : (
                  [...employees].sort((a, b) => {
                    if (a.status === 'Active' && b.status === 'Inactive') return -1;
                    if (a.status === 'Inactive' && b.status === 'Active') return 1;
                    return 0;
                  }).map(emp => (
                    <tr key={emp.id} className={`border-b border-varistor-border hover:bg-varistor-surfaceMuted ${emp.status === 'Inactive' ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 font-medium text-varistor-dark flex items-center gap-2">
                        <img
                          src={emp.avatarUrl ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.fullName)}&background=84CC16&color=fff&size=32&bold=true`}
                          alt={emp.fullName}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        {emp.fullName}
                      </td>
                      <td className="px-4 py-3 text-varistor-muted">{emp.department}</td>
                      <td className="px-4 py-3 text-varistor-muted">{emp.role}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          emp.status === 'Active'
                            ? 'bg-varistor-successBg text-varistor-successText'
                            : 'bg-varistor-dangerBg text-varistor-dangerText'
                        }`}>
                          {emp.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Pending Leaves + Quick Links */}
        <div className="space-y-6">
          {/* Pending Leaves */}
          <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-6">
            <div
              className="flex items-center justify-between gap-2 mb-4 cursor-pointer group"
              onClick={() => window.dispatchEvent(new CustomEvent('navigateTab', { detail: 'leaves' }))}
              title="Go to Leave Management"
            >
              <div className="flex items-center gap-2">
                <Calendar size={20} className="text-orange-500" />
                <h2 className="text-lg font-bold text-varistor-dark group-hover:text-orange-500 transition-colors">Pending Leaves</h2>
              </div>
              <span className="text-[10px] font-bold text-orange-400 uppercase tracking-wide group-hover:text-orange-600">View all →</span>
            </div>
            <div className="space-y-3">
              {pendingLeaves.length === 0 ? (
                <p className="text-sm text-varistor-muted">No pending leave requests.</p>
              ) : (
                pendingLeaves.slice(0, 4).map(l => (
                  <div key={l.id} className="flex justify-between items-center p-3 border border-varistor-border rounded-lg bg-varistor-surfaceMuted">
                    <div>
                      <p className="font-semibold text-sm text-varistor-dark">{l.employeeName}</p>
                      <p className="text-xs text-varistor-muted">{l.type} · {l.days} day{l.days !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('navigateTab', { detail: 'leaves' }))}
                      className="bg-orange-100 text-orange-600 px-3 py-1 rounded text-xs font-bold hover:bg-orange-200 transition-colors cursor-pointer"
                    >
                      Review
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={20} className="text-blue-500" />
              <h2 className="text-lg font-bold text-varistor-dark">Quick Actions</h2>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Manage Employees', tab: 'admin' },
                { label: 'Review Leaves', tab: 'leaves' },
                { label: 'Post Announcement', tab: 'announcements' },
                { label: 'Run Payroll', tab: 'payroll' },
              ].map(action => (
                <button
                  key={action.tab}
                  onClick={() => window.dispatchEvent(new CustomEvent('navigateTab', { detail: action.tab }))}
                  className="w-full text-left text-xs font-semibold text-varistor-dark bg-varistor-surfaceMuted hover:bg-varistor-border border border-varistor-border rounded-lg px-4 py-2.5 transition-colors flex items-center justify-between"
                >
                  {action.label}
                  <Megaphone size={12} className="text-varistor-muted" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
