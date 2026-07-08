import React from 'react';
import { useVariPoints } from '../hooks/useVariPoints';
import { AdminDashboardView } from './dashboards/AdminDashboardView';
import { HRDashboardView } from './dashboards/HRDashboardView';
import { ManagerDashboardView } from './dashboards/ManagerDashboardView';
import { EmployeeDashboardView } from './dashboards/EmployeeDashboardView';

import { Leaderboard } from './Leaderboard';

export const Dashboard: React.FC = () => {
  const { currentRole } = useVariPoints();

  const renderDashboard = () => {
    if (currentRole === 'Admin') {
      return <AdminDashboardView />;
    } else if (currentRole === 'HR') {
      return <HRDashboardView />;
    } else if (currentRole === 'Reporting Manager') {
      return <ManagerDashboardView />;
    }
    return <EmployeeDashboardView />;
  };

  return (
    <div className="space-y-10 md:space-y-8">
      {renderDashboard()}
      
      <div className="px-2 md:px-0">
        <h3 className="text-xl font-bold text-varistor-dark mb-6 md:mb-4">Organization Leaderboard</h3>
        <Leaderboard />
      </div>
    </div>
  );
};
