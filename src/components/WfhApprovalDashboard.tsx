import React, { useState, useEffect } from 'react';
import { Check, X, Loader2, Home, Eye } from 'lucide-react';
import { useVariPoints } from '../hooks/useVariPoints';
import { getFieldPendingVerifications, verifyFieldPhoto, type FieldPhotoEntry } from '../api/attendance';

export const WfhApprovalDashboard: React.FC = () => {
  const { leaveRequests, approveLeave, rejectLeave } = useVariPoints();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'success' | 'error'} | null>(null);

  // Derived from shared context state -- stays in sync automatically with
  // any other screen (Leaves.tsx, AdminDashboardView.tsx) that reads the
  // same leaveRequests array, instead of maintaining a separate local copy.
  const requests = leaveRequests.filter(r => r.type === 'WFH' && r.status === 'Pending');

  // Field employee punch-photo verifications -- merged into this same tab
  // alongside WFH leave approvals above.
  const [pendingPhotos, setPendingPhotos] = useState<FieldPhotoEntry[]>([]);
  const [verifyingPhotoId, setVerifyingPhotoId] = useState<string | null>(null);

  useEffect(() => {
    getFieldPendingVerifications().then(setPendingPhotos);
  }, []);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleApprove = (id: string) => {
    setProcessingId(id);
    try {
      approveLeave(id);
      showToast('Request approved successfully', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to approve', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      await rejectLeave(id, 'Rejected by admin');
      showToast('Request rejected', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to reject', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleVerifyPhoto = async (photoId: string, status: 'Verified' | 'Rejected') => {
    setVerifyingPhotoId(photoId);
    const result = await verifyFieldPhoto(photoId, status);
    setVerifyingPhotoId(null);
    if (result.success) {
      showToast(`Photo ${status.toLowerCase()} successfully.`, 'success');
      setPendingPhotos(prev => prev.filter(p => p.id !== photoId));
    } else {
      showToast(result.error || 'Action failed.', 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto pb-20 animate-[fadeInPage_250ms_ease-out] space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-varistor-border overflow-hidden">

        {/* Header */}
        <div className="bg-varistor-surface p-6 border-b border-varistor-border flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-brand-ink flex items-center gap-2">
              <Home className="text-varistor-lime" />
              WFH/Field Approvals
            </h2>
            <p className="text-sm text-varistor-muted mt-1">Review pending remote work requests and field photo verifications</p>
          </div>
          <div className="px-4 py-1.5 bg-yellow-100 text-yellow-800 rounded-full text-sm font-bold shadow-sm">
            {requests.length + pendingPhotos.length} Pending
          </div>
        </div>

        {/* WFH Leave Requests */}
        <div className="p-6">
          <h3 className="text-sm font-bold text-varistor-dark mb-3">WFH Leave Requests</h3>
          {requests.length === 0 ? (
            <div className="text-center py-8 text-varistor-muted bg-varistor-pageBg rounded-xl border border-dashed border-varistor-border">
              <Check className="mx-auto mb-2 text-emerald-400" size={32} />
              <p className="text-sm font-semibold text-varistor-dark">No pending WFH requests</p>
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

      {/* Field Photo Verifications */}
      <div className="bg-white rounded-2xl shadow-sm border border-varistor-border overflow-hidden">
        <div className="p-6 border-b border-varistor-border">
          <h3 className="text-sm font-bold text-varistor-dark">Field Punch Photo Verifications</h3>
          <p className="text-xs text-varistor-muted mt-0.5">Review and verify each field employee's punch photo</p>
        </div>
        <div className="p-6">
          {pendingPhotos.length === 0 ? (
            <div className="text-center py-8 text-varistor-muted bg-varistor-pageBg rounded-xl border border-dashed border-varistor-border">
              <Check className="mx-auto mb-2 text-emerald-400" size={32} />
              <p className="text-sm font-semibold text-varistor-dark">No pending verifications</p>
            </div>
          ) : (
            <div className="divide-y divide-varistor-border">
              {pendingPhotos.map(photo => (
                <div key={photo.id} className="py-4 flex flex-wrap items-center gap-4">
                  <button onClick={() => window.open(photo.photo_url, '_blank')} className="flex-shrink-0">
                    <img
                      src={photo.photo_url}
                      alt={photo.employeeName}
                      className="w-14 h-14 rounded-xl object-cover border border-varistor-border shadow-sm hover:shadow-md transition-varistor"
                    />
                  </button>
                  <div className="flex-1 min-w-[160px]">
                    <p className="text-sm font-bold text-varistor-dark">{photo.employeeName}</p>
                    <p className="text-xs text-varistor-muted">{photo.employee_id} · {photo.department}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] text-varistor-muted">{photo.date}</span>
                      <span className={`inline-block px-2 py-0.5 text-[11px] font-bold rounded-full border ${
                        photo.punch_type === 'in' ? 'bg-varistor-limeTint text-varistor-limeText border-varistor-lime/30' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {photo.punch_type.toUpperCase()}
                      </span>
                      {photo.confidence_score !== undefined && (
                        <span className="inline-block px-2 py-0.5 text-[11px] font-bold rounded-full border bg-gray-50 text-gray-700 border-gray-200">
                          {photo.confidence_score}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => window.open(photo.photo_url, '_blank')}
                      className="p-2 rounded-lg border border-varistor-border text-varistor-muted hover:text-varistor-dark hover:bg-varistor-pageBg transition-varistor"
                      title="View full photo"
                    >
                      <Eye size={14} strokeWidth={1.5} />
                    </button>
                    <button
                      onClick={() => handleVerifyPhoto(photo.id, 'Rejected')}
                      disabled={verifyingPhotoId !== null}
                      className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Reject"
                    >
                      <X size={18} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => handleVerifyPhoto(photo.id, 'Verified')}
                      disabled={verifyingPhotoId !== null}
                      className="p-2 rounded-lg text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                      title="Verify"
                    >
                      {verifyingPhotoId === photo.id ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} strokeWidth={2.5} />}
                    </button>
                  </div>
                </div>
              ))}
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
