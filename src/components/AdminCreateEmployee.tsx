import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, ShieldAlert, UserPlus } from 'lucide-react';
import { createEmployee } from '../api/employees';
import type { CreateEmployeeInput, Department } from '../api/employees';
import { useVariPoints } from '../hooks/useVariPoints';

// ─── Inline shared field components ──────────────────────────────────────────

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

// ─── Departments ─────────────────────────────────────────────────────────────

const DEPARTMENTS: Department[] = [
  'Finance', 'Sales', 'Operations', 'Ops Heads', 'Tech', 'Digital Marketing',
];

// ─── Types ───────────────────────────────────────────────────────────────────

type FormErrors = Partial<Record<keyof CreateEmployeeInput, string>>;

const EMPTY_FORM: CreateEmployeeInput = {
  fullName: '',
  employeeId: '',
  username: '',
  personalEmail: '',
  phone: '',
  department: '' as Department,
  reportingManager: '',
};

// ─── Component ───────────────────────────────────────────────────────────────

export const AdminCreateEmployee: React.FC = () => {
  const { currentRole } = useVariPoints();

  const [form, setForm] = useState<CreateEmployeeInput>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
    sub?: string;
  }>({ show: false, type: 'success', message: '' });

  // Role gate — only Admin / HR can access
  const canAccess = currentRole === 'Admin' || currentRole === 'HR';

  // ── Helpers ────────────────────────────────────────────────────────────────

  const set = (field: keyof CreateEmployeeInput) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm(prev => ({ ...prev, [field]: e.target.value }));
      setErrors(prev => ({ ...prev, [field]: undefined }));
    };

  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (!form.fullName.trim()) errs.fullName = 'Full name is required.';
    if (!form.employeeId.trim()) errs.employeeId = 'Employee ID is required.';
    if (!form.username.trim()) errs.username = 'Username is required.';
    if (!form.personalEmail.trim()) errs.personalEmail = 'Email is required.';
    else if (!/\S+@\S+\.\S+/.test(form.personalEmail)) errs.personalEmail = 'Enter a valid email.';
    if (!form.phone.trim()) errs.phone = 'Phone number is required.';
    if (!form.department) errs.department = 'Please select a department.';
    if (!form.reportingManager.trim()) errs.reportingManager = 'Reporting manager is required.';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const showToast = (type: 'success' | 'error', message: string, sub?: string) => {
    setToast({ show: true, type, message, sub });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4500);
  };

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);

    const { success, employee, error } = await createEmployee(form);

    if (!success || error) {
      showToast('error', 'Failed to create employee', error ?? undefined);
    } else {
      showToast(
        'success',
        `${employee!.fullName} added successfully`,
        `Temp password: ${employee!.tempPassword}`
      );
      setForm(EMPTY_FORM);
      setErrors({});
    }

    setIsLoading(false);
  };

  // ── Role gate UI ──────────────────────────────────────────────────────────

  if (!canAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
          <ShieldAlert size={32} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-varistor-dark">Access Restricted</h2>
        <p className="text-sm text-varistor-muted max-w-xs">
          Only <strong>Admin</strong> and <strong>HR</strong> roles can create employee accounts.
          Switch your role in the top bar to continue.
        </p>
      </div>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto pb-20 animate-[fadeInPage_250ms_ease-out]">

      {/* Page header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <UserPlus size={20} strokeWidth={1.5} className="text-varistor-dark" />
            <h1 className="text-xl font-bold text-varistor-dark">Create Employee</h1>
          </div>
          <p className="text-sm text-varistor-muted">
            Onboard a new team member. A temporary password will be auto-generated and can be shared securely.
          </p>
        </div>

        {/* Admin-only badge */}
        <span className="flex-shrink-0 px-3 py-1 bg-[#1a1a1a] text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
          Admin / HR only
        </span>
      </div>

      {/* Form card */}
      <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-6 lg:p-8">
        <form onSubmit={handleSubmit} noValidate>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">

            {/* Full Name */}
            <Field label="Full name" required error={errors.fullName}>
              <input
                className={inputCls(!!errors.fullName)}
                placeholder="e.g. Priya Sharma"
                value={form.fullName}
                onChange={set('fullName')}
              />
            </Field>

            {/* Employee ID */}
            <Field label="Employee ID" required error={errors.employeeId}>
              <input
                className={inputCls(!!errors.employeeId)}
                placeholder="e.g. VAR-025"
                value={form.employeeId}
                onChange={set('employeeId')}
              />
            </Field>

            {/* Username */}
            <Field label="Username" required error={errors.username}>
              <input
                className={inputCls(!!errors.username)}
                placeholder="e.g. priya.sharma"
                value={form.username}
                onChange={set('username')}
              />
            </Field>

            {/* Temp password (read-only/auto-generated) */}
            <Field label="Temporary password">
              <input
                className={`${inputCls()} bg-varistor-pageBg text-varistor-muted cursor-not-allowed`}
                placeholder="Auto-generated on creation"
                disabled
                readOnly
              />
            </Field>

            {/* Personal Email */}
            <Field label="Personal email" required error={errors.personalEmail}>
              <input
                type="email"
                className={inputCls(!!errors.personalEmail)}
                placeholder="priya@gmail.com"
                value={form.personalEmail}
                onChange={set('personalEmail')}
              />
            </Field>

            {/* Phone */}
            <Field label="Phone" required error={errors.phone}>
              <input
                type="tel"
                className={inputCls(!!errors.phone)}
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={set('phone')}
              />
            </Field>

            {/* Department */}
            <Field label="Department" required error={errors.department}>
              <select
                className={inputCls(!!errors.department)}
                value={form.department}
                onChange={set('department')}
              >
                <option value="">Select department…</option>
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {/* Dept chips */}
              <div className="flex flex-wrap gap-1.5 mt-1">
                {DEPARTMENTS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => { setForm(p => ({ ...p, department: d })); setErrors(p => ({ ...p, department: undefined })); }}
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-all ${
                      form.department === d
                        ? 'bg-varistor-lime border-varistor-lime text-varistor-limeText'
                        : 'bg-varistor-limeLight border-varistor-border text-varistor-muted hover:border-varistor-lime'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>

            {/* Reporting Manager */}
            <Field label="Reporting manager" required error={errors.reportingManager}>
              <input
                className={inputCls(!!errors.reportingManager)}
                placeholder="e.g. Admin User"
                value={form.reportingManager}
                onChange={set('reportingManager')}
              />
            </Field>

          </div>

          {/* Actions */}
          <div className="mt-8 pt-6 border-t border-varistor-border flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-varistor-muted">
              <span className="text-red-500">*</span> Required fields
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setForm(EMPTY_FORM); setErrors({}); }}
                className="px-4 py-2.5 text-sm font-medium rounded-varistor border border-varistor-border text-varistor-dark bg-white hover:bg-varistor-pageBg transition-colors"
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-varistor bg-varistor-lime text-varistor-limeText hover:bg-[#92cc14] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating…
                  </>
                ) : (
                  <>
                    <UserPlus size={16} strokeWidth={2} />
                    Create & send credentials
                  </>
                )}
              </button>
            </div>
          </div>

        </form>
      </div>

      {/* ── Toast notification ── */}
      <div
        className={`fixed bottom-6 right-6 z-50 transition-all duration-300 transform ${
          toast.show ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
        }`}
      >
        <div className={`flex items-start gap-3 px-4 py-3.5 rounded-varistor shadow-lg border max-w-sm ${
          toast.type === 'success'
            ? 'bg-varistor-limeTint border-[#c3f0a0]'
            : 'bg-red-50 border-red-200'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle2 size={20} className="text-varistor-limeText flex-shrink-0 mt-0.5" />
            : <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          }
          <div>
            <p className={`text-sm font-semibold ${toast.type === 'success' ? 'text-varistor-dark' : 'text-red-700'}`}>
              {toast.message}
            </p>
            {toast.sub && (
              <p className="text-xs text-varistor-muted mt-0.5 font-mono">{toast.sub}</p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
