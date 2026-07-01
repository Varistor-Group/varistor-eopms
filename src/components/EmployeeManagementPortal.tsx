import React, { useState } from 'react';
import { useVariPoints } from '../hooks/useVariPoints';
import { mockEmployeeStore } from '../api/employees';
import { AdminCreateEmployee } from './AdminCreateEmployee';
import { AdminEditEmployee } from './AdminEditEmployee';
import { Users, UserPlus, ShieldAlert, BadgeCheck, XCircle, Pencil } from 'lucide-react';
import type { Employee } from '../api/employees';
import { Button } from './shared/Button';

export const EmployeeManagementPortal: React.FC = () => {
  const { currentRole } = useVariPoints();
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Role Gate
  if (currentRole !== 'Admin' && currentRole !== 'HR') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-varistor p-6 flex flex-col items-center justify-center text-center space-y-3 h-[400px]">
        <ShieldAlert className="text-red-500 w-12 h-12" />
        <h3 className="text-lg font-bold text-red-700">Access Denied</h3>
        <p className="text-red-600 font-medium max-w-sm">
          You do not have permission to view the Employee Management Portal. Only Admin or HR roles have access.
        </p>
      </div>
    );
  }

  if (view === 'create') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setView('list')}
            className="text-sm font-semibold text-varistor-muted hover:text-varistor-dark transition-colors"
          >
            &larr; Back to Employees
          </button>
        </div>
        <AdminCreateEmployee onCancel={() => setView('list')} />
      </div>
    );
  }

  if (view === 'edit' && selectedEmployee) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => { setView('list'); setSelectedEmployee(null); }}
            className="text-sm font-semibold text-varistor-muted hover:text-varistor-dark transition-colors"
          >
            &larr; Back to Employees
          </button>
        </div>
        <AdminEditEmployee 
          employee={selectedEmployee} 
          onCancel={() => { setView('list'); setSelectedEmployee(null); }} 
          onSuccess={() => { setView('list'); setSelectedEmployee(null); }} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-varistor-dark flex items-center gap-2">
            <Users size={24} className="text-varistor-lime" />
            Employee Portal
          </h2>
          <p className="text-sm text-varistor-muted mt-1 font-medium">
            Manage your team, roles, and onboarding.
          </p>
        </div>
        <Button onClick={() => setView('create')} className="flex items-center gap-2">
          <UserPlus size={16} />
          <span>Add Employee</span>
        </Button>
      </div>

      <div className="bg-white rounded-varistor border border-varistor-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-varistor-pageBg border-b border-varistor-border">
              <tr>
                <th className="px-6 py-4 font-bold text-varistor-muted uppercase tracking-wider text-[11px]">Employee</th>
                <th className="px-6 py-4 font-bold text-varistor-muted uppercase tracking-wider text-[11px]">ID / Role</th>
                <th className="px-6 py-4 font-bold text-varistor-muted uppercase tracking-wider text-[11px]">Department</th>
                <th className="px-6 py-4 font-bold text-varistor-muted uppercase tracking-wider text-[11px]">Points</th>
                <th className="px-6 py-4 font-bold text-varistor-muted uppercase tracking-wider text-[11px]">Status</th>
                <th className="px-6 py-4 font-bold text-varistor-muted uppercase tracking-wider text-[11px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-varistor-border">
              {mockEmployeeStore.map((emp) => (
                <tr key={emp.id} className="hover:bg-varistor-pageBg/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-varistor-limeTint flex items-center justify-center font-bold text-varistor-limeText shrink-0">
                        {emp.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-varistor-dark text-sm">{emp.fullName}</p>
                        <p className="text-xs text-varistor-muted mt-0.5">{emp.personalEmail}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-semibold text-varistor-dark text-xs">{emp.employeeId}</p>
                    <p className="text-xs text-varistor-muted mt-0.5">{emp.role}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700">
                      {emp.department}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-1 rounded border border-varistor-lime/20 bg-varistor-limeTint text-xs font-bold text-varistor-limeText">
                      {emp.variPoints} pts
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {emp.status === 'Active' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                        <BadgeCheck size={14} />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-full">
                        <XCircle size={14} />
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => { setSelectedEmployee(emp); setView('edit'); }}
                      className="p-1.5 text-varistor-muted hover:text-varistor-dark hover:bg-varistor-pageBg rounded-md transition-colors"
                      title="Edit Employee"
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {mockEmployeeStore.length === 0 && (
            <div className="p-8 text-center text-varistor-muted font-medium">
              No employees found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
