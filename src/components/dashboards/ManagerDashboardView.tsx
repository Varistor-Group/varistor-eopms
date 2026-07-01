import React, { useState } from 'react';
import { Megaphone, Users, Award, Calendar } from 'lucide-react';
import { mockEmployeeStore } from '../../api/employees';

export const ManagerDashboardView: React.FC = () => {
  const MOCK_MANAGER_ID = 'VAR-001';
  
  // Scoped to direct reports
  const teamMembers = mockEmployeeStore.filter(emp => emp.reportingManager === MOCK_MANAGER_ID);
  
  // Mock data generation for demo purposes
  const generateMockPerformance = () => {
    return teamMembers.map(emp => ({
      id: emp.id,
      name: emp.fullName,
      department: emp.department,
      rating: Math.floor(Math.random() * 40) + 60, // 60-99
      points: Math.floor(Math.random() * 1000) + 200,
      pendingLeaves: Math.random() > 0.7 ? Math.floor(Math.random() * 3) + 1 : 0
    })).sort((a, b) => b.points - a.points);
  };

  const [mockData] = useState(generateMockPerformance());

  return (
    <div className="space-y-6 animate-[fadeInPage_250ms_ease-out]">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <h1 className="text-2xl font-bold text-varistor-dark">My Team Overview</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Performance & Points Leaderboard */}
        <div className="lg:col-span-2 bg-white rounded-varistor border border-varistor-border shadow-varistor p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users size={20} className="text-varistor-limeText" />
            <h2 className="text-lg font-bold text-varistor-dark">Team Performance & Vari Points</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-varistor-muted uppercase bg-[#fafbfa] border-b border-[#f1f3f0]">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Task Performance</th>
                  <th className="px-4 py-3">Vari Points</th>
                </tr>
              </thead>
              <tbody>
                {mockData.map((data, idx) => (
                  <tr key={data.id} className="border-b border-[#f1f3f0] hover:bg-[#fafbfa]">
                    <td className="px-4 py-3 font-medium text-varistor-dark flex items-center gap-2">
                      <span className="text-varistor-muted text-xs">#{idx + 1}</span> {data.name}
                    </td>
                    <td className="px-4 py-3 text-varistor-muted">Employee</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-varistor-lime h-2 rounded-full" style={{ width: `${data.rating}%` }}></div>
                        </div>
                        <span className="text-xs font-semibold">{data.rating}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-bold text-varistor-limeText flex items-center gap-1">
                      <Award size={14} /> {data.points}
                    </td>
                  </tr>
                ))}
                {mockData.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-center text-sm text-varistor-muted">
                      No direct reports found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Sidebar widgets */}
        <div className="space-y-6">
          {/* Leaves Tracking */}
          <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={20} className="text-orange-500" />
              <h2 className="text-lg font-bold text-varistor-dark">Team Leaves</h2>
            </div>
            <div className="space-y-3">
              {mockData.filter(d => d.pendingLeaves > 0).map(d => (
                <div key={d.id} className="flex justify-between items-center p-3 border border-[#f1f3f0] rounded-lg bg-[#fafbfa]">
                  <div>
                    <p className="font-semibold text-sm text-varistor-dark">{d.name}</p>
                    <p className="text-xs text-varistor-muted">{d.pendingLeaves} days requested</p>
                  </div>
                  <button className="bg-orange-100 text-orange-600 px-3 py-1 rounded text-xs font-bold hover:bg-orange-200 transition-colors cursor-pointer">Review</button>
                </div>
              ))}
              {mockData.filter(d => d.pendingLeaves > 0).length === 0 && (
                <p className="text-sm text-varistor-muted">No pending leave requests in your team.</p>
              )}
            </div>
          </div>

          {/* Announcements Quick View */}
          <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-6">
            <div className="flex items-center gap-2 mb-4">
              <Megaphone size={20} className="text-blue-500" />
              <h2 className="text-lg font-bold text-varistor-dark">Recent Announcements</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="font-semibold text-blue-900">New Work From Home Policy</p>
                <p className="text-xs text-blue-700 mt-1">HR Dept - 2 hours ago</p>
              </div>
              <div className="p-3 bg-[#fafbfa] border border-[#f1f3f0] rounded-lg">
                <p className="font-semibold text-varistor-dark">System Maintenance</p>
                <p className="text-xs text-varistor-muted mt-1">IT Dept - 1 day ago</p>
              </div>
            </div>
            <button onClick={() => window.dispatchEvent(new CustomEvent('navigateTab', { detail: 'announcements' }))} className="w-full mt-4 bg-[#eef1ed] text-varistor-dark font-bold text-xs py-2 rounded hover:bg-[#e0e4de] transition-colors cursor-pointer">View All</button>
          </div>
        </div>
      </div>
    </div>
  );
};
