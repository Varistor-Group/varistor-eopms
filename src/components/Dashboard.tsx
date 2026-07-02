import React from 'react';
import { useVariPoints } from '../hooks/useVariPoints';
import { AdminDashboardView } from './dashboards/AdminDashboardView';
import { ManagerDashboardView } from './dashboards/ManagerDashboardView';
import { EmployeeDashboardView } from './dashboards/EmployeeDashboardView';

export const Dashboard: React.FC = () => {
  const { currentRole } = useVariPoints();

  if (currentRole === 'Admin' || currentRole === 'HR') {
    return <AdminDashboardView />;
  } else if (currentRole === 'Reporting Manager') {
    return <ManagerDashboardView />;
  }
  
  return <EmployeeDashboardView />;
};
