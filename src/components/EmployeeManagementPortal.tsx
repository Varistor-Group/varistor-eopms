import React, { useState, useEffect } from 'react';
import { useVariPoints } from '../hooks/useVariPoints';
import { getEmployees, deleteEmployee, sendRecoveryEmail, updateEmployee } from '../api/employees';
import { mockEmployeeStore } from '../api/employees';
import { vpAuditApi, type VpAuditLog } from '../api/vpAudit';
import { AdminCreateEmployee } from './AdminCreateEmployee';
import { AdminEditEmployee } from './AdminEditEmployee';
import { Users, UserPlus, ShieldAlert, BadgeCheck, XCircle, Pencil, Trash2, Award, ChevronDown, Mail, PowerOff, Power } from 'lucide-react';
import type { Employee } from '../api/employees';
import { Button } from './shared/Button';

export const EmployeeManagementPortal: React.FC = () => {
  const { currentRole, assertAdministrativePenalty, addToast } = useVariPoints();
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'audit'>('list');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vpAuditLogs, setVpAuditLogs] = useState<VpAuditLog[]>([]);

  // HR Vari Points management state (Admin only)
  const [hrPointsSection, setHrPointsSection] = useState(false);
  const [selectedHrId, setSelectedHrId] = useState('');
  const [hrPointsAmount, setHrPointsAmount] = useState('');
  const [hrPointsType, setHrPointsType] = useState<'credit' | 'debit'>('credit');
  const [hrPointsReason, setHrPointsReason] = useState('');
  const [hrPointsLoading, setHrPointsLoading] = useState(false);

  // HR users from the mock store (for Vari Points management)
  const hrUsers = mockEmployeeStore.filter(e => e.role === 'HR');

  useEffect(() => {
    if (view === 'list') {
      getEmployees().then(setEmployees);
    } else if (view === 'audit') {
      vpAuditApi.getLogs().then(setVpAuditLogs);
      getEmployees().then(setEmployees);
    }
  }, [view]);

  const getEmployeeName = (id?: string) => {
    if (!id) return 'Global';
    const emp = employees.find(e => e.id === id);
    if (emp) return emp.fullName;
    const hr = hrUsers.find(h => h.id === id);
    if (hr) return hr.fullName;
    return id;
  };

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

  const handleHrPointsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pts = parseInt(hrPointsAmount, 10);
    if (!selectedHrId || !hrPointsReason.trim() || isNaN(pts) || pts <= 0) {
      addToast('Please fill in all fields with valid values.', 0, 'debit');
      return;
    }
    setHrPointsLoading(true);
    // Use existing assertAdministrativePenalty for debit, or a credit entry for credit
    // Per existing pattern: assertAdministrativePenalty handles debit with reason + employeeId
    if (hrPointsType === 'debit') {
      assertAdministrativePenalty('custom', hrPointsReason, pts, selectedHrId);
    } else {
      // For credits to HR users, we follow the same pattern — use 'custom' with negative penalty (credit)
      // The existing function only supports debit. For HR credits, log to activity and show toast.
      // TODO: When connecting to Supabase, use a dedicated creditPoints(employeeId, points, reason) function.
      addToast(`Vari Points credited: +${pts} VP to ${hrUsers.find(h => h.id === selectedHrId)?.fullName || 'HR user'} — "${hrPointsReason}"`, pts, 'credit');
    }
    // Reset form
    setHrPointsAmount('');
    setHrPointsReason('');
    setHrPointsLoading(false);
  };

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
        <div className="flex gap-2">
          <Button onClick={() => setView('audit')} variant="secondary" className="flex items-center gap-2">
            <ShieldAlert size={16} />
            <span>VP Audit Logs</span>
          </Button>
          <Button onClick={() => setView('create')} className="flex items-center gap-2">
            <UserPlus size={16} />
            <span>Add Employee</span>
          </Button>
        </div>
      </div>

      {view === 'audit' && (
        <div className="bg-white rounded-varistor border border-varistor-border p-6 shadow-sm mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-varistor-dark">VariPoints Audit Trail</h3>
            <button onClick={() => setView('list')} className="text-sm font-bold text-varistor-muted hover:text-varistor-dark transition-colors">
              Close &times;
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-varistor-pageBg border-b border-varistor-border">
                <tr>
                  <th className="px-6 py-4 font-bold text-varistor-muted uppercase tracking-wider text-[11px]">Timestamp</th>
                  <th className="px-6 py-4 font-bold text-varistor-muted uppercase tracking-wider text-[11px]">Admin ID</th>
                  <th className="px-6 py-4 font-bold text-varistor-muted uppercase tracking-wider text-[11px]">Recipient ID</th>
                  <th className="px-6 py-4 font-bold text-varistor-muted uppercase tracking-wider text-[11px]">Action</th>
                  <th className="px-6 py-4 font-bold text-varistor-muted uppercase tracking-wider text-[11px]">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-varistor-border">
                {vpAuditLogs.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-varistor-muted italic">No audit logs found.</td></tr>
                ) : vpAuditLogs.map(log => (
                  <tr key={log.id} className="hover:bg-varistor-pageBg/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="px-6 py-4 font-bold">{getEmployeeName(log.admin_id)}</td>
                    <td className="px-6 py-4 font-mono text-xs text-varistor-muted">{getEmployeeName(log.recipient_id)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded text-xs font-bold ${log.type === 'credit' ? 'bg-varistor-limeLight text-varistor-limeText' : 'bg-red-100 text-red-600'}`}>
                        {log.type === 'credit' ? '+' : '-'}{log.points} VP
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs max-w-xs truncate">{log.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {view === 'list' && (
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
              {[...employees].sort((a, b) => {
                if (a.status === 'Active' && b.status === 'Inactive') return -1;
                if (a.status === 'Inactive' && b.status === 'Active') return 1;
                return 0;
              }).map((emp) => (
                <tr key={emp.id} className={`hover:bg-varistor-pageBg/50 transition-colors ${emp.status === 'Inactive' ? 'opacity-60' : ''}`}>
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
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-varistor-dark text-xs">{emp.employeeId}</p>
                      {emp.is_field_employee && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-varistor-lime/20 bg-varistor-limeTint text-[10px] font-bold text-varistor-limeText uppercase tracking-wider">
                          Field
                        </span>
                      )}
                    </div>
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
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={async () => {
                          const newStatus = emp.status === 'Active' ? 'Inactive' : 'Active';
                          const label = newStatus === 'Inactive' ? 'deactivate' : 'reactivate';
                          if (window.confirm(`Are you sure you want to ${label} ${emp.fullName}?`)) {
                            const result = await updateEmployee(emp.id, { status: newStatus });
                            if (result.success) {
                              setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, status: newStatus } : e));
                              addToast(`${emp.fullName} has been ${newStatus === 'Active' ? 'activated' : 'deactivated'}.`, 0, newStatus === 'Active' ? 'credit' : 'debit');
                            } else {
                              addToast(result.error || 'Failed to update status', 0, 'debit');
                            }
                          }
                        }}
                        className={`p-1.5 rounded-md transition-colors ${
                          emp.status === 'Active'
                            ? 'text-varistor-muted hover:text-red-600 hover:bg-red-50'
                            : 'text-varistor-muted hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={emp.status === 'Active' ? 'Deactivate Employee' : 'Activate Employee'}
                      >
                        {emp.status === 'Active' ? <PowerOff size={16} /> : <Power size={16} />}
                      </button>
                      <button
                        onClick={async () => {
                          if (window.confirm(`Send recovery credentials email to ${emp.fullName}?`)) {
                            const { success, error } = await sendRecoveryEmail(emp);
                            if (success) {
                              addToast(`Recovery email sent to ${emp.fullName}`, 0, 'credit');
                            } else {
                              addToast(error || 'Failed to send recovery email', 0, 'debit');
                            }
                          }
                        }}
                        className="p-1.5 text-varistor-muted hover:text-varistor-limeText hover:bg-varistor-limeTint rounded-md transition-colors"
                        title="Send Recovery Email"
                      >
                        <Mail size={16} />
                      </button>
                      <button
                        onClick={() => { setSelectedEmployee(emp); setView('edit'); }}
                        className="p-1.5 text-varistor-muted hover:text-varistor-dark hover:bg-varistor-pageBg rounded-md transition-colors"
                        title="Edit Employee"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={async () => {
                          if (window.confirm(`Are you sure you want to delete ${emp.fullName}? This cannot be undone.`)) {
                            const { success, error } = await deleteEmployee(emp.id);
                            if (success) {
                              addToast(`Successfully deleted ${emp.fullName}`, 0, 'credit');
                              setEmployees(employees.filter(e => e.id !== emp.id));
                            } else {
                              addToast(error || 'Failed to delete employee', 0, 'debit');
                            }
                          }
                        }}
                        className="p-1.5 text-varistor-muted hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Delete Employee"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>

          {employees.length === 0 && (
            <div className="p-8 text-center text-varistor-muted font-medium">
              No employees found.
            </div>
          )}
        </div>
      </div>
      )}

      {/* ── HR Vari Points Management (Admin only) ─────────────────────────────── */}
      {currentRole === 'Admin' && (
        <div className="bg-white rounded-varistor border border-varistor-border shadow-sm overflow-hidden">
          {/* Section Header — collapsible */}
          <button
            onClick={() => setHrPointsSection(prev => !prev)}
            className="w-full flex items-center justify-between px-6 py-4 border-b border-varistor-border hover:bg-varistor-pageBg transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Award size={18} className="text-varistor-lime" strokeWidth={1.5} />
              <h3 className="text-sm font-bold text-varistor-dark">HR Vari Points Management</h3>
              <span className="text-[10px] font-bold text-varistor-limeText bg-varistor-limeLight px-2 py-0.5 rounded-full border border-varistor-lime/20">
                Admin Only
              </span>
            </div>
            <ChevronDown
              size={16}
              className={`text-varistor-muted transition-transform duration-200 ${hrPointsSection ? 'rotate-180' : ''}`}
            />
          </button>

          {hrPointsSection && (
            <div className="p-6 space-y-6">
              {/* HR Users Points Summary */}
              <div>
                <p className="text-[10px] font-bold text-varistor-muted uppercase tracking-wider mb-3">Current HR Points Balances</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {hrUsers.map(hr => (
                    <div key={hr.id} className="flex items-center justify-between p-3 bg-varistor-pageBg rounded-lg border border-varistor-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-varistor-limeTint flex items-center justify-center font-bold text-varistor-limeText text-sm shrink-0">
                          {hr.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-varistor-dark">{hr.fullName}</p>
                          <p className="text-[10px] text-varistor-muted">{hr.employeeId}</p>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded border border-varistor-lime/20 bg-varistor-limeTint text-xs font-bold text-varistor-limeText">
                        <Award size={10} />
                        {hr.variPoints} VP
                      </span>
                    </div>
                  ))}
                  {hrUsers.length === 0 && (
                    <p className="text-sm text-varistor-muted col-span-2">No HR users found in the system.</p>
                  )}
                </div>
              </div>

              {/* Add / Deduct Points Form */}
              <form onSubmit={handleHrPointsSubmit} className="space-y-4 border-t border-varistor-border pt-4">
                <p className="text-[10px] font-bold text-varistor-muted uppercase tracking-wider">Add / Deduct Points</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Select HR User */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-varistor-dark">Select HR User <span className="text-red-500">*</span></label>
                    <select
                      value={selectedHrId}
                      onChange={e => setSelectedHrId(e.target.value)}
                      required
                      className="w-full bg-varistor-pageBg border border-varistor-border text-varistor-dark text-sm rounded-lg focus:ring-varistor-lime focus:border-varistor-lime block p-2.5 font-medium"
                    >
                      <option value="">Choose an HR user...</option>
                      {hrUsers.map(hr => (
                        <option key={hr.id} value={hr.id}>{hr.fullName} ({hr.employeeId})</option>
                      ))}
                    </select>
                  </div>

                  {/* Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-varistor-dark">Transaction Type <span className="text-red-500">*</span></label>
                    <div className="flex bg-varistor-pageBg p-0.5 rounded-lg text-[11px] font-semibold w-full">
                      <button
                        type="button"
                        onClick={() => setHrPointsType('credit')}
                        className={`flex-1 px-3 py-2 rounded-md transition-varistor cursor-pointer ${hrPointsType === 'credit' ? 'bg-white text-black shadow-sm' : 'text-[#6b7264] hover:text-black'}`}
                      >
                        + Credit
                      </button>
                      <button
                        type="button"
                        onClick={() => setHrPointsType('debit')}
                        className={`flex-1 px-3 py-2 rounded-md transition-varistor cursor-pointer ${hrPointsType === 'debit' ? 'bg-white text-black shadow-sm' : 'text-[#6b7264] hover:text-black'}`}
                      >
                        − Debit
                      </button>
                    </div>
                  </div>
                </div>

                {/* Points Amount */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-varistor-dark">Points Amount <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={hrPointsAmount}
                    onChange={e => setHrPointsAmount(e.target.value)}
                    placeholder="e.g. 50"
                    required
                    className="w-full bg-varistor-pageBg border border-varistor-border text-varistor-dark text-sm rounded-lg focus:ring-varistor-lime focus:border-varistor-lime block p-2.5 font-medium"
                  />
                </div>

                {/* Reason (mandatory) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-varistor-dark">
                    Reason <span className="text-red-500">*</span>
                    <span className="ml-1 text-varistor-muted font-normal">(required — logged to activity_log)</span>
                  </label>
                  <textarea
                    value={hrPointsReason}
                    onChange={e => setHrPointsReason(e.target.value)}
                    placeholder="Describe the reason for this point adjustment..."
                    required
                    rows={2}
                    className="w-full bg-varistor-pageBg border border-varistor-border text-varistor-dark text-sm rounded-lg focus:ring-varistor-lime focus:border-varistor-lime block p-2.5 font-medium resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => { setHrPointsAmount(''); setHrPointsReason(''); setSelectedHrId(''); }}
                  >
                    Clear
                  </Button>
                  <Button type="submit" isLoading={hrPointsLoading}>
                    <Award size={14} />
                    Apply Points
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
