import React, { useState, useEffect } from 'react';
import { Lock, FileText, ShieldCheck, Users, CheckCircle, Clock, XCircle, Eye, Upload } from 'lucide-react';
import { getVaultDocuments, trackDocumentAction, updateDocumentStatus, updateDocumentFile, downloadDecryptedDocument } from '../api/vault';
import { useVariPoints } from '../hooks/useVariPoints';
import { getEmployees } from '../api/employees';
import type { Employee } from '../api/employees';
import type { DocumentStatus } from '../types';

// ── Status Badge Config ───────────────────────────────────────────────────────
// Follows the exact badge pattern established in EmployeeManagementPortal:
// inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border
// Uses the design-system status colour tokens from tailwind.config.js
interface StatusConfig {
  icon: React.ElementType;
  className: string;
  label: string;
}

const STATUS_CONFIG: Record<DocumentStatus, StatusConfig> = {
  Verified: {
    icon: CheckCircle,
    className: 'bg-varistor-successBg text-varistor-successText border-varistor-successBorder',
    label: 'Verified',
  },
  Pending: {
    icon: Clock,
    className: 'bg-varistor-pendingBg text-varistor-pendingText border-varistor-pendingBorder',
    label: 'Pending',
  },
  Rejected: {
    icon: XCircle,
    className: 'bg-varistor-dangerBg text-varistor-dangerText border-varistor-dangerBorder',
    label: 'Rejected',
  },
  'Under Review': {
    icon: Eye,
    className: 'bg-amber-50 text-amber-700 border-amber-200',
    label: 'Under Review',
  },
};

const ALL_STATUSES: DocumentStatus[] = ['Verified', 'Pending', 'Rejected', 'Under Review'];

// ── Status Badge Component ────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: DocumentStatus }> = ({ status }) => {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG['Pending'];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${config.className}`}>
      <Icon size={11} strokeWidth={2} />
      {config.label}
    </span>
  );
};

// ── Document Vault ────────────────────────────────────────────────────────────
export const DocumentVault: React.FC = () => {
  const { currentRole, addToast } = useVariPoints();
  const [documents, setDocuments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [updatingDocId, setUpdatingDocId] = useState<string | null>(null);

  // Default to our mock logged-in user Aarav Patel (VAR-024)
  const loggedInEmployeeId = 'VAR-024';
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(loggedInEmployeeId);

  const canManageStatus = currentRole === 'Admin' || currentRole === 'HR';

  useEffect(() => {
    getEmployees().then(setEmployees);
  }, []);

  // Re-fetch documents when the selected employee changes
  useEffect(() => {
    setIsLoading(true);
    getVaultDocuments(selectedEmployeeId).then(docs => {
      setDocuments(docs);
      setIsLoading(false);
    });
  }, [selectedEmployeeId]);

  // Lock back to logged-in user when role switches away from Admin/HR
  useEffect(() => {
    if (currentRole !== 'Admin' && currentRole !== 'HR') {
      setSelectedEmployeeId(loggedInEmployeeId);
    }
  }, [currentRole]);

  const handleAction = async (docId: string, actionName: string) => {
    trackDocumentAction('admin@varistor.in', actionName, docId);
    console.log(`[Audit Log] admin@varistor.in performed ${actionName} on document ${docId} (Employee: ${selectedEmployeeId})`);
    
    if (actionName === 'Download' || actionName === 'View') {
      addToast(`Decrypting document...`, 3, 'credit');
      const result = await downloadDecryptedDocument(docId);
      
      if (result.success && result.blob) {
        const url = URL.createObjectURL(result.blob);
        
        if (actionName === 'Download') {
          const a = document.createElement('a');
          a.href = url;
          a.download = result.filename || 'document.pdf';
          document.body.appendChild(a);
          a.click();
          a.remove();
        } else {
          // View in new tab
          window.open(url, '_blank');
        }
        
        // Clean up URL object after a short delay
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      } else {
        addToast(result.error || 'Decryption failed. Ensure the document is uploaded properly.', 0, 'debit');
      }
    }
  };

  const handleStatusChange = async (docId: string, newStatus: DocumentStatus) => {
    setUpdatingDocId(docId);
    const result = await updateDocumentStatus(docId, newStatus, 'hr@varistor.in');
    setUpdatingDocId(null);

    if (result.success) {
      // Optimistically update local state
      setDocuments(prev =>
        prev.map(d => d.id === docId ? { ...d, status: newStatus } : d)
      );
      addToast(`Document status updated to "${newStatus}".`, 0, 'credit');
    } else {
      addToast(`Failed to update status: ${result.error}`, 0, 'debit');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, docId: string) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setUpdatingDocId(docId);
    const result = await updateDocumentFile(docId, file);
    setUpdatingDocId(null);
    
    // Reset file input
    e.target.value = '';

    if (result.success && result.document) {
      addToast(`Successfully updated document slot with ${file.name}`, 10, 'credit');
      setDocuments(prev => prev.map(d => d.id === docId ? result.document : d));
    } else {
      addToast(result.error || 'Failed to update document', 0, 'debit');
    }
  };

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || employees[0];
  const canSelectEmployee = currentRole === 'Admin' || currentRole === 'HR';

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-[fadeInPage_250ms_ease-out]">
      {/* Header Profile Summary */}
      <div className="bg-white rounded-[12px] p-6 lg:p-8 border border-varistor-border shadow-[0_4px_24px_rgba(0,0,0,0.02)] mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {canSelectEmployee ? (
            <div className="flex items-center gap-3 mb-2">
              <Users size={18} className="text-varistor-lime" />
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="bg-varistor-pageBg border border-varistor-border text-brand-ink text-sm rounded-lg focus:ring-varistor-lime focus:border-varistor-lime block w-full p-2 font-semibold"
              >
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.fullName} ({emp.employeeId})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <h1 className="text-2xl font-bold text-brand-ink mb-1">{selectedEmployee?.fullName} · {selectedEmployee?.employeeId}</h1>
          )}
          <p className="text-gray-500 font-medium text-sm">{selectedEmployee?.department} Department</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-semibold border border-red-100">
            <Lock size={12} />
            Encrypted
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a4d2e] text-white rounded-full text-xs font-semibold">
            <ShieldCheck size={12} />
            Audit log on
          </div>
        </div>
      </div>

      {/* Document Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-52 bg-gray-100 rounded-[12px]"></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc) => {
            const docStatus: DocumentStatus = doc.status in STATUS_CONFIG ? doc.status : 'Pending';
            const isUpdating = updatingDocId === doc.id;

            return (
              <div key={doc.id} className="bg-white rounded-[12px] p-5 border border-varistor-border shadow-sm flex flex-col group hover:shadow-md transition-shadow">
                <div className="h-32 bg-gray-50 rounded-lg flex items-center justify-center mb-4 border border-dashed border-gray-200">
                  <FileText className="text-gray-300" size={40} />
                </div>

                <div className="flex-1">
                  <h3 className="font-semibold text-brand-ink text-sm mb-1">{doc.name}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-2 font-medium">
                    {doc.type} · {doc.size}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-50 space-y-3">
                  {/* Status Row */}
                  <div className="flex items-center justify-between">
                    {/* HR/Admin: status dropdown; Employee: static colour badge */}
                    {canManageStatus ? (
                      <div className="relative">
                        <select
                          value={docStatus}
                          onChange={e => handleStatusChange(doc.id, e.target.value as DocumentStatus)}
                          disabled={isUpdating}
                          className={`
                            appearance-none text-[10px] font-bold uppercase tracking-wide pr-6 pl-2 py-1 rounded-full border cursor-pointer
                            transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-varistor-lime
                            ${STATUS_CONFIG[docStatus]?.className ?? 'bg-gray-100 text-gray-500 border-gray-200'}
                            ${isUpdating ? 'opacity-60 cursor-not-allowed' : ''}
                          `}
                          title="Change document status"
                        >
                          {ALL_STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        {/* Chevron indicator */}
                        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-current opacity-60">
                          ▾
                        </span>
                      </div>
                    ) : (
                      <StatusBadge status={docStatus} />
                    )}

                    {/* View / Download Actions */}
                    <div className="flex gap-3 text-xs font-semibold text-gray-500">
                      {(!canSelectEmployee || selectedEmployeeId === loggedInEmployeeId) && (
                        <>
                          <label className={`hover:text-brand-ink flex items-center gap-1 transition-colors cursor-pointer ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
                            Upload
                            <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, doc.id)} />
                          </label>
                          <span className="text-gray-300">·</span>
                        </>
                      )}
                      {doc.filename && (
                        <>
                          <button
                            onClick={() => handleAction(doc.id, 'View')}
                            className="hover:text-brand-ink flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            View
                          </button>
                          <span className="text-gray-300">·</span>
                          <button
                            onClick={() => handleAction(doc.id, 'Download')}
                            className="hover:text-brand-ink flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            Download
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
