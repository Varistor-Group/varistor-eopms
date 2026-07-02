import React, { useMemo, useState } from 'react';
import { CalendarDays, Plus, X, Check, AlertCircle } from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';
import { mockEmployeeStore } from '../api/employees';
import { calcWorkingDays, isWeekend, isHoliday } from '../api/leaves';
import type { LeaveRequest, LeaveStatus, LeaveType } from '../types';

// ─── Status pill ──────────────────────────────────────────────────────────────

const StatusPill: React.FC<{ status: LeaveStatus }> = ({ status }) => {
  const cls =
    status === 'Approved'
      ? 'bg-varistor-limeTint text-varistor-limeText border-varistor-lime/30'
      : status === 'Pending'
        ? 'bg-gray-100 text-gray-500 border-gray-200'
        : 'bg-red-50 text-red-600 border-red-200';
  return (
    <span className={`inline-block px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${cls}`}>
      {status}
    </span>
  );
};

// ─── Leave type dot ───────────────────────────────────────────────────────────

const TYPE_META: Record<LeaveType, { dot: string; short: string }> = {
  Casual: { dot: 'bg-blue-500', short: 'CL' },
  Sick: { dot: 'bg-amber-500', short: 'SL' },
  Earned: { dot: 'bg-green-600', short: 'EL' },
  Unpaid: { dot: 'bg-gray-400', short: 'UPL' },
};

const TypeLabel: React.FC<{ type: LeaveType }> = ({ type }) => (
  <span className="flex items-center gap-1.5 text-xs font-medium text-varistor-dark whitespace-nowrap">
    <span className={`w-2 h-2 rounded-full ${TYPE_META[type].dot}`} />
    {type} ({TYPE_META[type].short})
  </span>
);

// ─── Balance card ─────────────────────────────────────────────────────────────

const BalanceCard: React.FC<{ label: string; used?: number; total?: number; unpaidDays?: number }> = ({
  label,
  used,
  total,
  unpaidDays,
}) => {
  const isUnpaid = unpaidDays !== undefined;
  const left = !isUnpaid ? (total ?? 0) - (used ?? 0) : 0;
  const pct = !isUnpaid && total ? Math.min(100, Math.round(((used ?? 0) / total) * 100)) : 0;

  return (
    <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor p-5">
      <p className="text-xs font-semibold text-varistor-muted uppercase tracking-wide">{label}</p>
      {isUnpaid ? (
        <>
          <p className="text-2xl font-bold text-varistor-dark mt-2">{unpaidDays}</p>
          <p className="text-xs text-varistor-muted mt-2">days taken this year</p>
        </>
      ) : (
        <>
          <p className="text-2xl font-bold text-varistor-dark mt-2">
            {used}<span className="text-varistor-muted text-base font-semibold">/{total}</span>
          </p>
          <div className="h-1.5 bg-varistor-limeLight rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-varistor-lime rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-varistor-muted mt-2">{used} used · {left} left</p>
        </>
      )}
    </div>
  );
};

// ─── History / console table helpers ─────────────────────────────────────────

const thCls = 'text-left text-[11px] font-bold text-varistor-muted uppercase tracking-wide px-4 py-3 whitespace-nowrap';
const tdCls = 'px-4 py-3 text-xs text-varistor-dark whitespace-nowrap align-top';

const truncateReason = (reason: string) =>
  reason.length > 40 ? `${reason.slice(0, 40)}…` : reason;

// ─── Approval console (HR/Admin: all requests; RM: direct reports) ───────────

const ApprovalConsole: React.FC<{
  title: string;
  badge?: string;
  requests: LeaveRequest[];
}> = ({ title, badge, requests }) => {
  const { approveLeave, rejectLeave } = useVariPoints();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  const confirmReject = (leaveId: string) => {
    if (!comment.trim()) return;
    rejectLeave(leaveId, comment.trim());
    setRejectingId(null);
    setComment('');
  };

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-varistor-dark">{title}</h2>
        {badge && (
          <span className="px-3 py-1 bg-varistor-lime text-varistor-limeText text-[10px] font-bold uppercase tracking-wider rounded-full">
            {badge}
          </span>
        )}
      </div>

      <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-varistor-border">
            <tr>
              <th className={thCls}>Employee</th>
              <th className={thCls}>Type</th>
              <th className={thCls}>From</th>
              <th className={thCls}>To</th>
              <th className={thCls}>Days</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-varistor-muted">
                  No leave requests to review.
                </td>
              </tr>
            )}
            {requests.map(req => (
              <React.Fragment key={req.id}>
                <tr className="border-b border-varistor-border/60 last:border-0 hover:bg-varistor-pageBg/50 transition-colors">
                  <td className={tdCls}>
                    <span className="font-semibold">{req.employeeName}</span>
                    <span className="block font-mono text-[10px] text-varistor-muted">{req.id}</span>
                  </td>
                  <td className={tdCls}><TypeLabel type={req.type} /></td>
                  <td className={tdCls}>{req.from}</td>
                  <td className={tdCls}>{req.to}</td>
                  <td className={tdCls}>{req.days}</td>
                  <td className={tdCls}><StatusPill status={req.status} /></td>
                  <td className={tdCls}>
                    {req.status === 'Pending' ? (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => approveLeave(req.id)}
                          className="bg-varistor-lime text-varistor-limeText text-xs px-3 py-1 rounded-full font-semibold hover:bg-[#92cc14] transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => { setRejectingId(rejectingId === req.id ? null : req.id); setComment(''); }}
                          className="text-red-500 text-xs font-semibold hover:underline"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-varistor-muted text-xs">—</span>
                    )}
                  </td>
                </tr>

                {/* Inline rejection comment row */}
                {rejectingId === req.id && (
                  <tr className="bg-red-50/50">
                    <td colSpan={7} className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        <textarea
                          value={comment}
                          onChange={e => setComment(e.target.value)}
                          rows={2}
                          autoFocus
                          placeholder="Reason for rejection (required)…"
                          className="flex-1 px-3 py-2 border border-red-200 rounded-varistor text-xs outline-none bg-white focus:ring-2 focus:ring-red-200 resize-none"
                        />
                        <div className="flex flex-col gap-1.5">
                          <button
                            onClick={() => confirmReject(req.id)}
                            disabled={!comment.trim()}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Check size={12} /> Confirm
                          </button>
                          <button
                            onClick={() => { setRejectingId(null); setComment(''); }}
                            className="px-3 py-1.5 text-xs font-medium rounded-full text-varistor-muted hover:text-varistor-dark transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ─── Apply for Leave modal ────────────────────────────────────────────────────

const LEAVE_TYPES: LeaveType[] = ['Casual', 'Sick', 'Earned', 'Unpaid'];

const ApplyLeaveModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { leaveBalance, submitLeave } = useVariPoints();
  const [type, setType] = useState<LeaveType>('Casual');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  const [dateError, setDateError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const days = useMemo(() => calcWorkingDays(from, to), [from, to]);

  const remainingFor = (t: LeaveType): number | null => {
    if (!leaveBalance) return null;
    switch (t) {
      case 'Casual': return leaveBalance.casual.total - leaveBalance.casual.used;
      case 'Sick': return leaveBalance.sick.total - leaveBalance.sick.used;
      case 'Earned': return leaveBalance.earned.total - leaveBalance.earned.used;
      case 'Unpaid': return null; // uncapped
    }
  };
  const remaining = remainingFor(type);

  const validateDate = (value: string, which: 'from' | 'to'): boolean => {
    if (!value) return true;
    if (isWeekend(value)) {
      setDateError('That date falls on a weekend — please pick a working day.');
      return false;
    }
    if (isHoliday(value)) {
      setDateError('That date is a public holiday — please pick a working day.');
      return false;
    }
    if (which === 'to' && from && value < from) {
      setDateError('"To" date must be on or after the "From" date.');
      return false;
    }
    setDateError('');
    return true;
  };

  const handleFromChange = (value: string) => {
    if (validateDate(value, 'from')) {
      setFrom(value);
      if (to && to < value) setTo('');
    } else {
      setFrom('');
    }
  };

  const handleToChange = (value: string) => {
    if (validateDate(value, 'to')) {
      setTo(value);
    } else {
      setTo('');
    }
  };

  const handleSubmit = () => {
    setSubmitError('');
    if (!from || !to || !reason.trim()) {
      setSubmitError('Please fill in all fields.');
      return;
    }
    if (days <= 0) {
      setSubmitError('Selected range contains no working days.');
      return;
    }
    if (remaining !== null && days > remaining) {
      setSubmitError(`Insufficient ${type} leave balance (${remaining} day${remaining === 1 ? '' : 's'} remaining)`);
      return;
    }

    submitLeave({
      employeeId: '2',
      employeeName: 'sathvik',
      type,
      from,
      to,
      days,
      reason: reason.trim(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white max-w-lg w-full rounded-varistor shadow-2xl p-6 animate-[fadeInPage_250ms_ease-out]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-varistor-dark">Apply for Leave</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-varistor-pageBg transition-colors" title="Close">
            <X size={18} className="text-varistor-muted" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Leave Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-varistor-dark">Leave Type</label>
            <select
              value={type}
              onChange={e => { setType(e.target.value as LeaveType); setSubmitError(''); }}
              className="px-3 py-2 border border-varistor-border rounded-varistor text-sm outline-none bg-white focus:ring-2 focus:ring-varistor-lime/40 focus:border-varistor-lime"
            >
              {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <p className="text-xs text-varistor-muted">
              {remaining !== null
                ? `You have ${remaining} ${type} leave day${remaining === 1 ? '' : 's'} remaining`
                : 'Unpaid leave is uncapped — it does not deduct from any balance'}
            </p>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-varistor-dark">From</label>
              <input
                type="date"
                value={from}
                min="2026-01-01"
                max="2026-12-31"
                onChange={e => handleFromChange(e.target.value)}
                className="px-3 py-2 border border-varistor-border rounded-varistor text-sm outline-none bg-white focus:ring-2 focus:ring-varistor-lime/40 focus:border-varistor-lime"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-varistor-dark">To</label>
              <input
                type="date"
                value={to}
                min={from || '2026-01-01'}
                max="2026-12-31"
                onChange={e => handleToChange(e.target.value)}
                className="px-3 py-2 border border-varistor-border rounded-varistor text-sm outline-none bg-white focus:ring-2 focus:ring-varistor-lime/40 focus:border-varistor-lime"
              />
            </div>
          </div>
          <p className="text-[11px] text-varistor-muted -mt-2">Note: Weekends and public holidays are disabled.</p>
          {dateError && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium -mt-2">
              <AlertCircle size={13} /> {dateError}
            </p>
          )}

          {/* Days (auto-calculated) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-varistor-dark">Working days</label>
            <input
              readOnly
              value={days > 0 ? `${days} day${days === 1 ? '' : 's'}` : '—'}
              className="px-3 py-2 border border-varistor-border rounded-varistor text-sm bg-varistor-pageBg text-varistor-muted cursor-not-allowed outline-none"
            />
          </div>

          {/* Reason */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-varistor-dark">Reason</label>
            <textarea
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Brief reason for leave..."
              className="px-3 py-2 border border-varistor-border rounded-varistor text-sm outline-none bg-white focus:ring-2 focus:ring-varistor-lime/40 focus:border-varistor-lime resize-none"
            />
          </div>

          {submitError && (
            <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium">
              <AlertCircle size={13} /> {submitError}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-varistor-border">
            <button
              onClick={onClose}
              className="px-4 py-2 mt-3 text-sm font-medium rounded-varistor text-varistor-muted hover:text-varistor-dark hover:bg-varistor-pageBg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-5 py-2 mt-3 text-sm font-semibold rounded-varistor bg-varistor-lime text-varistor-limeText hover:bg-[#92cc14] active:scale-[0.98] transition-all"
            >
              Submit request
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Employee history section (own balance + own requests) ───────────────────

const OwnLeaveSection: React.FC<{ requests: LeaveRequest[] }> = ({ requests }) => {
  const { leaveBalance } = useVariPoints();

  return (
    <>
      {/* Balance cards */}
      <h2 className="text-base font-bold text-varistor-dark mb-3">Your leave balance</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <BalanceCard label="Casual Leave" used={leaveBalance?.casual.used ?? 0} total={leaveBalance?.casual.total ?? 0} />
        <BalanceCard label="Sick Leave" used={leaveBalance?.sick.used ?? 0} total={leaveBalance?.sick.total ?? 0} />
        <BalanceCard label="Earned Leave" used={leaveBalance?.earned.used ?? 0} total={leaveBalance?.earned.total ?? 0} />
        <BalanceCard label="Unpaid Leave" unpaidDays={leaveBalance?.unpaidTaken ?? 0} />
      </div>

      {/* History */}
      <h2 className="text-base font-bold text-varistor-dark mb-1">Leave history</h2>
      <p className="text-xs text-varistor-muted mb-3">All your previous and pending leave requests</p>
      <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead className="border-b border-varistor-border">
            <tr>
              <th className={thCls}>Request ID</th>
              <th className={thCls}>Type</th>
              <th className={thCls}>From</th>
              <th className={thCls}>To</th>
              <th className={thCls}>Days</th>
              <th className={thCls}>Reason</th>
              <th className={thCls}>Status</th>
              <th className={thCls}>Reviewer</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-varistor-muted">
                  No leave requests yet — click “Apply for Leave” to submit one.
                </td>
              </tr>
            )}
            {requests.map(req => (
              <tr key={req.id} className="border-b border-varistor-border/60 last:border-0 hover:bg-varistor-pageBg/50 transition-colors">
                <td className={`${tdCls} font-mono text-xs text-varistor-muted`}>{req.id}</td>
                <td className={tdCls}><TypeLabel type={req.type} /></td>
                <td className={tdCls}>{req.from}</td>
                <td className={tdCls}>{req.to}</td>
                <td className={tdCls}>{req.days}</td>
                <td className={`${tdCls} max-w-[220px]`} title={req.reason}>
                  <span className="block truncate">{truncateReason(req.reason)}</span>
                  {req.status === 'Rejected' && req.rejectionComment && (
                    <span className="block text-[11px] text-red-500 italic mt-0.5 whitespace-normal">
                      “{req.rejectionComment}”
                    </span>
                  )}
                </td>
                <td className={tdCls}><StatusPill status={req.status} /></td>
                <td className={tdCls}>{req.reviewerName ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

export const LeaveManagement: React.FC = () => {
  const { currentRole, leaveRequests } = useVariPoints();
  const [showApplyModal, setShowApplyModal] = useState(false);

  const isApproverHR = currentRole === 'HR' || currentRole === 'Admin';
  const isManager = currentRole === 'Reporting Manager';

  // Mock logged-in user is always id '2' (sathvik) for own balance/history
  const ownRequests = leaveRequests.filter(r => r.employeeId === '2');

  // Reporting Manager: direct reports = employees reporting to the mock manager ('2131' / akash)
  const directReportIds = useMemo(
    () => new Set(mockEmployeeStore.filter(e => e.reportingManager === '2131' || e.reportingManager === 'Admin User').map(e => e.id)),
    []
  );
  const teamRequests = leaveRequests.filter(r => directReportIds.has(r.employeeId));

  return (
    <div className="animate-[fadeInPage_250ms_ease-out]">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays size={20} strokeWidth={1.5} className="text-varistor-dark" />
            <h1 className="text-xl font-bold text-varistor-dark">Leave Management</h1>
          </div>
          <p className="text-sm text-varistor-muted">Calendar year 2026 – resets every 1st January</p>
        </div>
        <button
          onClick={() => setShowApplyModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-varistor bg-varistor-lime text-varistor-limeText hover:bg-[#92cc14] active:scale-[0.98] transition-all"
        >
          <Plus size={16} strokeWidth={2} />
          Apply for Leave
        </button>
      </div>

      {/* HR / Admin approval console — all employees' requests */}
      {isApproverHR && (
        <ApprovalConsole title="HR Adjustment Console" badge="HR only" requests={leaveRequests} />
      )}

      {/* Reporting Manager — direct reports' requests only */}
      {isManager && (
        <ApprovalConsole title="Team Leave Requests" requests={teamRequests} />
      )}

      {/* Own balance + history (all roles) */}
      <OwnLeaveSection requests={ownRequests} />

      {/* Apply modal */}
      {showApplyModal && <ApplyLeaveModal onClose={() => setShowApplyModal(false)} />}
    </div>
  );
};
