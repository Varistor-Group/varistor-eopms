import React, { useState, useEffect } from 'react';
import { Calendar, Clock, AlertTriangle, CheckCircle2, XCircle, ArrowRight, User } from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';
import { getEmployees, type Employee } from '../api/employees';
import { fetchAllClBalances, updateClBalance, type ClBalance } from '../api/payroll';

const Leaves: React.FC = () => {
  const { currentRole, leaveRequests, submitLeave, approveLeave, rejectLeave, currentUser, leaveBalance } = useVariPoints();
  
  const [leaveType, setLeaveType] = useState('Casual Leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const LOGGED_IN_EMP = currentUser?.id ?? 'VAR-003';
  const LOGGED_IN_NAME = currentUser?.name ?? 'Aarav Patel';
  const LOGGED_IN_DEPT = currentUser?.department ?? 'Operations';

  // State for HR/Admin managing leave balances
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clBalances, setClBalances] = useState<Record<string, ClBalance>>({});
  const [loadingBalances, setLoadingBalances] = useState(false);

  // State for Employee viewing live CL balance
  const [ownClBalance, setOwnClBalance] = useState<ClBalance | null>(null);

  useEffect(() => {
    if (currentRole === 'Admin' || currentRole === 'HR') {
      setLoadingBalances(true);
      Promise.all([getEmployees(), fetchAllClBalances()])
        .then(([emps, bals]) => {
          setEmployees(emps);
          setClBalances(bals);
          setLoadingBalances(false);
        })
        .catch(err => {
          console.error('Failed to load employee leave balances', err);
          setLoadingBalances(false);
        });
    }
  }, [currentRole]);

  useEffect(() => {
    if (currentRole === 'Employee' && LOGGED_IN_EMP) {
      fetch(`http://localhost:3001/api/cl-balances/${LOGGED_IN_EMP}`)
        .then(res => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then(setOwnClBalance)
        .catch(() => setOwnClBalance({ total: 12, used: 0 }));
    }
  }, [currentRole, LOGGED_IN_EMP, leaveRequests]);

  const handleCLBalanceChange = async (employeeId: string, value: string) => {
    const total = parseInt(value, 10);
    if (isNaN(total) || total < 0) return;
    try {
      const updated = await updateClBalance(employeeId, total);
      setClBalances(prev => ({ ...prev, [employeeId]: updated }));
    } catch (err) {
      console.error(err);
    }
  };

  // Minimum date selection: today + 2 days
  const getMinDateStr = () => {
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 2);
    return minDate.toISOString().split('T')[0];
  };

  // Data is loaded via context

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!startDate || !endDate || !reason.trim()) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      setErrorMsg('End date cannot be before start date.');
      return;
    }

    // Enforce 2-day advance notice for Employee
    const minAllowedDate = new Date();
    minAllowedDate.setHours(0, 0, 0, 0);
    minAllowedDate.setDate(minAllowedDate.getDate() + 2);

    if (currentRole === 'Employee' && start < minAllowedDate) {
      setErrorMsg('Leaves must be requested at least 2 days in advance. Dates prior to July 5th, 2026 are locked.');
      return;
    }

    setSubmitting(true);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    try {
      submitLeave({
        employeeId: LOGGED_IN_EMP,
        employeeName: LOGGED_IN_NAME,
        type: leaveType,
        from: startDate,
        to: endDate,
        days,
        reason,
        department: LOGGED_IN_DEPT
      } as any);

      setSuccessMsg('Leave request submitted successfully!');
      setStartDate('');
      setEndDate('');
      setReason('');
    } catch (err) {
      setErrorMsg('Failed to submit.');
    }
    setSubmitting(false);
  };

  const handleStatusUpdate = (id: string, status: 'Approved' | 'Rejected') => {
    try {
      if (status === 'Approved') {
        approveLeave(id);
      } else {
        rejectLeave(id, 'Rejected by ' + (currentUser?.name ?? 'Admin'));
      }
    } catch (err) {
      console.error('Failed to update leave status', err);
    }
  };



  const filteredLeaves = (currentRole === 'Admin' || currentRole === 'HR')
    ? leaveRequests
    : leaveRequests.filter(l => l.employeeId === LOGGED_IN_EMP);

  return (
    <div className="w-full pb-20 animate-[fadeInPage_250ms_ease-out]">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-varistor-dark flex items-center gap-2">
          <Calendar size={20} className="text-varistor-lime" /> Leaves Management
        </h1>
        <p className="text-sm text-varistor-muted mt-0.5">
          {currentRole === 'Admin' || currentRole === 'HR'
            ? 'Manage and approve employee leave requests'
            : 'Apply for leaves and track your requests'}
        </p>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form and Balances Column */}
        {currentRole === 'Employee' && (
          <div className="lg:col-span-1 space-y-6">
            {/* Leaves Balance Panel */}
            <div className="bg-white rounded-varistor border border-varistor-border p-5 shadow-varistor">
              <h3 className="text-sm font-bold text-varistor-dark border-b pb-2 mb-4">Leave Balances</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs text-varistor-muted mb-1">
                    <span>Casual Leave Balance</span>
                    <span className="font-bold text-varistor-dark">
                      {ownClBalance ? `${ownClBalance.used} / ${ownClBalance.total}` : `${leaveBalance?.casual?.used ?? 0} / ${leaveBalance?.casual?.total ?? 12}`} Taken
                    </span>
                  </div>
                  <div className="w-full bg-[#f1f3f0] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-varistor-lime h-full" style={{ width: `${Math.min(100, (((ownClBalance?.used ?? leaveBalance?.casual?.used ?? 0) / (ownClBalance?.total ?? leaveBalance?.casual?.total ?? 12)) * 100))}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs text-varistor-muted mb-1">
                    <span>Sick Leave Balance</span>
                    <span className="font-bold text-varistor-dark">{leaveBalance?.sick?.used ?? 0} / {leaveBalance?.sick?.total ?? 10} Taken</span>
                  </div>
                  <div className="w-full bg-[#f1f3f0] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-amber-400 h-full" style={{ width: `${Math.min(100, ((leaveBalance?.sick?.used ?? 0) / (leaveBalance?.sick?.total ?? 10)) * 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Apply Leave Form */}
            <div className="bg-white rounded-varistor border border-varistor-border p-5 shadow-varistor">
              <h3 className="text-sm font-bold text-varistor-dark border-b pb-2 mb-4">Apply for Leave</h3>
              
              {/* Warnings & Notices */}
              <div className="mb-4 flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Immediate Leaves Notice</span>
                  For immediate leave please contact HR/Admin directly. Dates prior to July 5th, 2026 are locked.
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-varistor-muted mb-1.5 uppercase">Leave Type</label>
                  <select
                    value={leaveType}
                    onChange={e => setLeaveType(e.target.value)}
                    className="w-full text-xs border border-varistor-border rounded px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-varistor-lime cursor-pointer"
                  >
                    <option value="Casual Leave">Casual Leave</option>
                    <option value="Sick Leave">Sick Leave</option>
                    <option value="Loss of Pay">Loss of Pay (LOP)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-varistor-muted mb-1.5 uppercase">Start Date</label>
                    <input
                      type="date"
                      min={getMinDateStr()}
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full text-xs border border-varistor-border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-varistor-lime font-mono cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-varistor-muted mb-1.5 uppercase">End Date</label>
                    <input
                      type="date"
                      min={startDate || getMinDateStr()}
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full text-xs border border-varistor-border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-varistor-lime font-mono cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-varistor-muted mb-1.5 uppercase">Reason</label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Enter reason for leave..."
                    className="w-full text-xs border border-varistor-border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-varistor-lime"
                  />
                </div>

                {errorMsg && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-xs font-semibold text-red-600">
                    {errorMsg}
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded text-xs font-semibold text-green-700">
                    {successMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2 bg-varistor-lime text-white rounded-lg hover:bg-[#65a30d] text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Submitting...' : 'Submit Leave Request'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* HR / Admin Manage CL Balances Column */}
        {(currentRole === 'Admin' || currentRole === 'HR') && (
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-varistor border border-varistor-border p-5 shadow-varistor">
              <h3 className="text-sm font-bold text-varistor-dark border-b pb-2 mb-4">Manage CL Balances</h3>
              {loadingBalances ? (
                <div className="text-xs text-varistor-muted py-4 text-center">Loading balances…</div>
              ) : (
                <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                  {employees.map(emp => {
                    const bal = clBalances[emp.employeeId] ?? { total: 12, used: 0 };
                    return (
                      <div key={emp.id} className="flex items-center justify-between py-2 border-b border-varistor-border last:border-b-0">
                        <div className="min-w-0 flex-1 pr-2">
                          <p className="text-xs font-bold text-varistor-dark truncate">{emp.fullName}</p>
                          <p className="text-[10px] text-varistor-muted font-mono">{emp.employeeId} · {bal.used} used</p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <label className="text-[10px] font-semibold text-varistor-muted">Total CL:</label>
                          <input
                            type="number"
                            defaultValue={bal.total}
                            onBlur={e => handleCLBalanceChange(emp.employeeId, e.target.value)}
                            min={0}
                            className="w-14 border border-varistor-border rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-varistor-lime"
                            title="Edit Casual Leave total balance"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Requests Table Column */}
        <div className={`${(currentRole === 'Employee' || currentRole === 'Admin' || currentRole === 'HR') ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-6`}>
          <div className="bg-white rounded-varistor border border-varistor-border shadow-varistor overflow-hidden">
            <div className="px-5 py-4 border-b border-varistor-border flex justify-between items-center">
              <h3 className="text-sm font-bold text-varistor-dark">
                {currentRole === 'Admin' || currentRole === 'HR' ? 'All Employee Leaves' : 'My Leave Requests'}
              </h3>
              <span className="text-xs text-varistor-muted">{filteredLeaves.length} request(s)</span>
            </div>

            {filteredLeaves.length === 0 ? (
              <div className="p-12 text-center text-xs text-varistor-muted italic">
                No leave requests found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-varistor-pageBg border-b border-varistor-border text-varistor-muted text-[10px] font-bold uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Employee</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-left">Duration</th>
                      <th className="px-4 py-3 text-center">Days</th>
                      <th className="px-4 py-3 text-left">Reason</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      {(currentRole === 'Admin' || currentRole === 'HR') && <th className="px-4 py-3 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-varistor-border">
                    {filteredLeaves.map((item) => (
                      <tr key={item.id} className="hover:bg-varistor-pageBg transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-varistor-dark">{item.employeeName}</div>
                          <div className="text-[10px] text-varistor-muted">{item.employeeId}</div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-varistor-dark">{item.type}</td>
                        <td className="px-4 py-3 font-mono text-varistor-dark">
                          <div className="flex items-center gap-1">
                            <span>{item.from}</span>
                            <ArrowRight size={10} className="text-gray-400" />
                            <span>{item.to}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-varistor-dark font-mono">{item.days}</td>
                        <td className="px-4 py-3 text-varistor-muted truncate max-w-[150px]" title={item.reason}>{item.reason}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            item.status === 'Approved'
                              ? 'bg-green-50 border-green-200 text-green-700'
                              : item.status === 'Rejected'
                              ? 'bg-red-50 border-red-200 text-red-700'
                              : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                          }`}>
                            {item.status === 'Approved' && <CheckCircle2 size={10} />}
                            {item.status === 'Rejected' && <XCircle size={10} />}
                            {item.status === 'Pending' && <Clock size={10} />}
                            {item.status}
                          </span>
                        </td>
                        {(currentRole === 'Admin' || currentRole === 'HR') && (
                          <td className="px-4 py-3 text-center">
                            {item.status === 'Pending' ? (
                              <div className="flex items-center justify-center gap-1.5 font-sans">
                                <button
                                  onClick={() => handleStatusUpdate(item.id, 'Approved')}
                                  className="px-2 py-1 bg-varistor-lime text-white rounded text-[10px] font-semibold hover:bg-[#65a30d] cursor-pointer"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleStatusUpdate(item.id, 'Rejected')}
                                  className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-semibold hover:bg-red-700 cursor-pointer"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-varistor-muted font-semibold">Locked</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Leaves;
