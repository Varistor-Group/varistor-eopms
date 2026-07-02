import React, { useState } from 'react';
import { ShieldAlert, UserCog } from 'lucide-react';
import { updateEmployee } from '../api/employees';
import type { Employee, Department } from '../api/employees';
import type { UserRole } from '../types';
import { useVariPoints } from '../hooks/useVariPoints';

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, required, error, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-medium text-varistor-dark">
      {label}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {error && <span className="text-xs text-red-500 font-medium">{error}</span>}
  </div>
);

const inputCls = (hasError?: boolean) =>
  `px-3 py-2 border rounded-varistor text-sm outline-none transition-all duration-150 bg-white
  focus:ring-2 focus:ring-varistor-lime/40
  ${hasError ? 'border-red-400 focus:border-red-400' : 'border-varistor-border focus:border-varistor-lime'}`;

const DEPARTMENTS: Department[] = [
  'Finance', 'Sales', 'Operations', 'Ops Heads', 'Tech', 'Digital Marketing',
];

const ROLES: UserRole[] = ['Employee', 'Reporting Manager', 'HR', 'Admin'];

export const AdminEditEmployee: React.FC<{ employee: Employee; onCancel: () => void; onSuccess: () => void }> = ({ employee, onCancel, onSuccess }) => {
  const { currentRole } = useVariPoints();

  const [form, setForm] = useState({
    fullName: employee.fullName,
    phone: employee.phone,
    department: employee.department,
    reportingManager: employee.reportingManager,
    role: employee.role,
    status: employee.status,
    variPoints: employee.variPoints.toString(),
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; type: 'success' | 'error'; message: string }>({ show: false, type: 'success', message: '' });

  const canAccess = currentRole === 'Admin' || currentRole === 'HR';

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [field]: e.target.value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.fullName.trim()) errs.fullName = 'Full name is required.';
    if (!form.phone.trim()) errs.phone = 'Phone number is required.';
    if (!form.department) errs.department = 'Please select a department.';
    if (!form.reportingManager.trim()) errs.reportingManager = 'Reporting manager is required.';
    if (!form.role) errs.role = 'System role is required.';
    if (isNaN(Number(form.variPoints)) || Number(form.variPoints) < 0) errs.variPoints = 'Points must be a positive number.';
    
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);

    const { success, error } = await updateEmployee(employee.id, {
      fullName: form.fullName,
      phone: form.phone,
      department: form.department,
      reportingManager: form.reportingManager,
      role: form.role,
      status: form.status,
      variPoints: Number(form.variPoints),
    });

    if (!success || error) {
      showToast('error', error || 'Failed to update employee');
      setIsLoading(false);
    } else {
      setIsLoading(false);
      onSuccess();
    }
  };

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
          <ShieldAlert size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-varistor-dark">Access Restricted</h2>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20 animate-[fadeInPage_250ms_ease-out]">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UserCog size={20} strokeWidth={1.5} className="text-varistor-dark" />
            <h1 className="text-xl font-bold text-varistor-dark">Edit Employee</h1>
          </div>
          <p className="text-sm text-varistor-muted">
            Update details for {employee.employeeId} ({employee.personalEmail}).
          </p>
        </div>
      </div>

      <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-6 lg:p-8">
        <form onSubmit={handleSubmit} noValidate>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            
            {/* Read Only Fields */}
            <Field label="Employee ID">
              <input className={`${inputCls()} bg-varistor-pageBg text-varistor-muted cursor-not-allowed`} value={employee.employeeId} disabled readOnly />
            </Field>
            <Field label="Personal email">
              <input className={`${inputCls()} bg-varistor-pageBg text-varistor-muted cursor-not-allowed`} value={employee.personalEmail} disabled readOnly />
            </Field>
            <Field label="Username">
              <input className={`${inputCls()} bg-varistor-pageBg text-varistor-muted cursor-not-allowed`} value={employee.username} disabled readOnly />
            </Field>

            <Field label="Full name" required error={errors.fullName}>
              <input className={inputCls(!!errors.fullName)} value={form.fullName} onChange={set('fullName')} />
            </Field>
            
            <Field label="Phone" required error={errors.phone}>
              <input className={inputCls(!!errors.phone)} value={form.phone} onChange={set('phone')} />
            </Field>

            <Field label="Department" required error={errors.department}>
              <select className={inputCls(!!errors.department)} value={form.department} onChange={set('department')}>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>

            <Field label="System Role" required error={errors.role}>
              <select className={inputCls(!!errors.role)} value={form.role} onChange={set('role')}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>

            <Field label="Status" required error={errors.status}>
              <select className={inputCls(!!errors.status)} value={form.status} onChange={set('status')}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </Field>

            <Field label="Vari Points" required error={errors.variPoints}>
              <input type="number" className={inputCls(!!errors.variPoints)} value={form.variPoints} onChange={set('variPoints')} min="0" />
            </Field>

            <Field label="Reporting Manager" required error={errors.reportingManager}>
              <input className={inputCls(!!errors.reportingManager)} value={form.reportingManager} onChange={set('reportingManager')} />
            </Field>
          </div>

          <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t border-varistor-border">
            {toast.show && (
              <span className={`text-sm font-medium mr-auto ${toast.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                {toast.message}
              </span>
            )}
            
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-bold text-varistor-muted hover:text-varistor-dark transition-colors"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-[#1a1a1a] text-[#ffffff] text-sm font-bold rounded-full hover:bg-black transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading && (
                <svg className="animate-spin h-4 w-4 text-[#ffffff]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
