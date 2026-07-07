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
    <div className="space-y-8">
      {renderDashboard()}
      
      <div>
        <h3 className="text-xl font-bold text-varistor-dark mb-4">Organization Leaderboard</h3>
        <Leaderboard />
      </div>
    </div>
  );
};
