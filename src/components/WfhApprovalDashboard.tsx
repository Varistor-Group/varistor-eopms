import React, { useEffect, useState } from 'react';
import { Check, X, Loader2, Home } from 'lucide-react';
import { getLeaveRequestsAsync, approveLeaveRequest, rejectLeaveRequest } from '../api/leaves';
import type { LeaveRequest } from '../types';
import { useVariPoints } from '../hooks/useVariPoints';

export const WfhApprovalDashboard: React.FC = () => {
  const { currentUser } = useVariPoints();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const allLeaves = await getLeaveRequestsAsync();
      // Filter for pending WFH requests
      const wfhPending = allLeaves.filter(r => r.type === 'WFH' && r.status === 'Pending');
      setRequests(wfhPending);
    } catch (e) {
      console.error(e);
      showToast('Failed to fetch WFH requests', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleApprove = async (id: string) => {
    if (!currentUser) return;
    setProcessingId(id);
    try {
      await approveLeaveRequest(id, currentUser.name);
      showToast('Request approved successfully', 'success');
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      showToast(e.message || 'Failed to approve', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!currentUser) return;
    setProcessingId(id);
    try {
      await rejectLeaveRequest(id, currentUser.name, 'Rejected by admin');
      showToast('Request rejected', 'success');
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      showToast(e.message || 'Failed to reject', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="animate-spin text-varistor-lime" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-[fadeInPage_250ms_ease-out]">
      <div className="bg-white rounded-2xl shadow-sm border border-varistor-border overflow-hidden">
        
        {/* Header */}
        <div className="bg-varistor-surface p-6 border-b border-varistor-border flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-brand-ink flex items-center gap-2">
              <Home className="text-varistor-lime" />
              WFH Approvals
            </h2>
            <p className="text-sm text-varistor-muted mt-1">Review and manage pending remote work requests</p>
          </div>
          <div className="px-4 py-1.5 bg-yellow-100 text-yellow-800 rounded-full text-sm font-bold shadow-sm">
            {requests.length} Pending
          </div>
        </div>

        {/* List */}
        <div className="p-6">
          {requests.length === 0 ? (
            <div className="text-center py-12 text-varistor-muted bg-varistor-pageBg rounded-xl border border-dashed border-varistor-border">
              <Check className="mx-auto mb-3 text-emerald-400" size={48} />
              <p className="font-semibold text-lg text-varistor-dark">All caught up!</p>
              <p className="text-sm">No pending WFH requests to review.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-varistor-surface text-varistor-muted text-sm border-b border-varistor-border">
                    <th className="py-3 px-4 font-semibold">Employee</th>
                    <th className="py-3 px-4 font-semibold">Date(s)</th>
                    <th className="py-3 px-4 font-semibold">Reason</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map(req => (
                    <tr key={req.id} className="border-b border-varistor-border hover:bg-varistor-surface/50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-varistor-dark">{req.employeeName}</div>
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-varistor-dark">
                        {req.from === req.to ? req.from : `${req.from} to ${req.to}`}
                      </td>
                      <td className="py-3 px-4">
                        <p className="text-sm text-varistor-muted truncate max-w-[250px]" title={req.reason}>
                          {req.reason}
                        </p>
                      </td>
                      <td className="py-3 px-4 flex justify-end gap-2">
                        <button
                          onClick={() => handleReject(req.id)}
                          disabled={processingId !== null}
                          className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Reject"
                        >
                          <X size={18} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => handleApprove(req.id)}
                          disabled={processingId !== null}
                          className="p-2 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                          title="Approve"
                        >
                          {processingId === req.id ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} strokeWidth={2.5} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-[slideUp_200ms_ease-out]">
          <div className={`px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 ${
            toast.type === 'success' ? 'bg-varistor-lime text-white' : 'bg-red-600 text-white'
          }`}>
            {toast.type === 'error' && <X size={18} />}
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
};
