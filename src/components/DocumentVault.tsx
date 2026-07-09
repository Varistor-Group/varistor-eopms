import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock, FileText, ShieldCheck, Users, CheckCircle, Clock, XCircle, Eye,
  Settings2, Plus, Trash2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  AlertCircle, Upload, Download, Star, Sparkles, X, FileCheck2, Save, StickyNote
} from 'lucide-react';
import {
  getEmployeeDocumentSlots,
  getDocumentTemplates,
  createDocumentTemplate,
  updateDocumentTemplate,
  deleteDocumentTemplate,
  addCustomSlotForEmployee,
  updateSlotRequirement,
  updateSlotStatus,
  updateSlotNotes,
  removeCustomSlot,
  trackDocumentAction,
  downloadDecryptedDocument,
  uploadDocument,
  linkDocumentToSlot,
  seedEmployeeSlots,
} from '../api/vault';
import { useVariPoints } from '../hooks/useVariPoints';
import { getEmployees } from '../api/employees';
import type { Employee } from '../api/employees';
import type { DocumentStatus, DocumentTemplate, EmployeeDocumentSlot } from '../types';

interface StatusConfig { icon: React.ElementType; className: string; label: string; }
const STATUS_CONFIG: Record<DocumentStatus, StatusConfig> = {
  Verified:      { icon: CheckCircle, className: 'bg-emerald-50 text-emerald-700 border-emerald-200',  label: 'Verified' },
  Pending:       { icon: Clock,       className: 'bg-amber-50 text-amber-700 border-amber-200',        label: 'Pending' },
  Rejected:      { icon: XCircle,     className: 'bg-red-50 text-red-600 border-red-200',              label: 'Rejected' },
  'Under Review':{ icon: Eye,         className: 'bg-blue-50 text-blue-700 border-blue-200',           label: 'Under Review' },
};
const ALL_STATUSES: DocumentStatus[] = ['Verified', 'Pending', 'Rejected', 'Under Review'];

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

interface TemplateManagerProps {
  templates: DocumentTemplate[];
  onTemplateUpdate: (t: DocumentTemplate) => void;
  onTemplateCreate: (t: DocumentTemplate) => void;
  onTemplateDelete: (id: string) => void;
  addToast: (msg: string, pts: number, type: 'credit' | 'debit') => void;
}

const TemplateManager: React.FC<TemplateManagerProps> = ({
  templates, onTemplateUpdate, onTemplateCreate, onTemplateDelete, addToast
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newRequired, setNewRequired] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const handleToggleRequired = async (tmpl: DocumentTemplate) => {
    setActionId(tmpl.id);
    const res = await updateDocumentTemplate(tmpl.id, { isRequired: !tmpl.isRequired });
    setActionId(null);
    if (res.success && res.template) { onTemplateUpdate(res.template); addToast(`"${tmpl.name}" marked as ${!tmpl.isRequired ? 'Required' : 'Optional'}`, 0, 'credit'); }
    else { addToast(res.error ?? 'Update failed', 0, 'debit'); }
  };

  const handleToggleActive = async (tmpl: DocumentTemplate) => {
    setActionId(tmpl.id);
    const res = await updateDocumentTemplate(tmpl.id, { isActive: !tmpl.isActive });
    setActionId(null);
    if (res.success && res.template) { onTemplateUpdate(res.template); addToast(`"${tmpl.name}" ${!tmpl.isActive ? 'activated' : 'hidden'}`, 0, 'credit'); }
    else { addToast(res.error ?? 'Update failed', 0, 'debit'); }
  };

  const handleDelete = async (tmpl: DocumentTemplate) => {
    if (!window.confirm(`Delete "${tmpl.name}" from template?`)) return;
    setActionId(tmpl.id);
    const res = await deleteDocumentTemplate(tmpl.id);
    setActionId(null);
    if (res.success) { onTemplateDelete(tmpl.id); addToast(`"${tmpl.name}" removed`, 0, 'debit'); }
    else { addToast(res.error ?? 'Delete failed', 0, 'debit'); }
  };

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await createDocumentTemplate(newName, newDesc, newRequired);
    setSaving(false);
    if (res.success && res.template) { onTemplateCreate(res.template); setNewName(''); setNewDesc(''); setNewRequired(true); addToast(`"${res.template.name}" added`, 0, 'credit'); }
    else { addToast(res.error ?? 'Failed', 0, 'debit'); }
  };

  return (
    <div className="bg-white rounded-[14px] border border-varistor-border shadow-sm mb-6 overflow-hidden">
      <button onClick={() => setIsOpen(o => !o)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-varistor-lime/10 flex items-center justify-center">
            <Settings2 size={16} className="text-varistor-lime" />
          </div>
          <div className="text-left">
            <h2 className="text-sm font-bold text-brand-ink">Document Requirements Template</h2>
            <p className="text-xs text-gray-400 mt-0.5">Manage the global document checklist applied to all employees</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-varistor-lime/10 text-varistor-lime font-semibold px-2.5 py-1 rounded-full">{templates.filter(t => t.isActive).length} active</span>
          {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>
      {isOpen && (
        <div className="border-t border-varistor-border">
          <div className="flex gap-4 px-6 pt-4 pb-2 text-[11px] text-gray-400 font-medium">
            <span className="w-2/5">Document Name</span>
            <span className="w-1/5 text-center">Required</span>
            <span className="w-1/5 text-center">Visible</span>
            <span className="w-1/5 text-right">Actions</span>
          </div>
          <div className="px-4 pb-2 space-y-1.5">
            {templates.map(tmpl => (
              <div key={tmpl.id} className={`flex items-center gap-4 px-3 py-2.5 rounded-xl border transition-all ${tmpl.isActive ? 'bg-gray-50 border-gray-100' : 'bg-gray-50/50 border-dashed border-gray-200 opacity-60'}`}>
                <div className="w-2/5 flex items-center gap-2 min-w-0">
                  <FileCheck2 size={14} className={tmpl.isActive ? 'text-varistor-lime shrink-0' : 'text-gray-300 shrink-0'} />
                  <span className="text-sm font-medium text-brand-ink truncate">{tmpl.name}</span>
                  {tmpl.isRequired && tmpl.isActive && <span className="shrink-0 text-[9px] font-bold uppercase bg-red-50 text-red-500 border border-red-200 rounded-full px-1.5 py-0.5">req</span>}
                  {!tmpl.isRequired && tmpl.isActive && <span className="shrink-0 text-[9px] font-bold uppercase bg-sky-50 text-sky-500 border border-sky-200 rounded-full px-1.5 py-0.5">opt</span>}
                </div>
                <div className="w-1/5 flex justify-center">
                  <button onClick={() => handleToggleRequired(tmpl)} disabled={actionId === tmpl.id} title={tmpl.isRequired ? 'Make Optional' : 'Make Required'}>
                    {tmpl.isRequired ? <ToggleRight size={20} className="text-varistor-lime" /> : <ToggleLeft size={20} className="text-gray-300" />}
                  </button>
                </div>
                <div className="w-1/5 flex justify-center">
                  <button onClick={() => handleToggleActive(tmpl)} disabled={actionId === tmpl.id} title={tmpl.isActive ? 'Hide' : 'Show'}>
                    {tmpl.isActive ? <ToggleRight size={20} className="text-blue-500" /> : <ToggleLeft size={20} className="text-gray-300" />}
                  </button>
                </div>
                <div className="w-1/5 flex justify-end">
                  <button onClick={() => handleDelete(tmpl)} disabled={actionId === tmpl.id} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Remove">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-4 border-t border-varistor-border bg-gray-50/60">
            <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1.5"><Plus size={12} /> Add new document type</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input type="text" placeholder="Document name" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} className="flex-1 text-sm border border-varistor-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-varistor-lime" />
              <input type="text" placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="flex-1 text-sm border border-varistor-border rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-varistor-lime" />
              <button onClick={() => setNewRequired(r => !r)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${newRequired ? 'bg-red-50 text-red-600 border-red-200' : 'bg-sky-50 text-sky-600 border-sky-200'}`}>
                <Star size={12} />{newRequired ? 'Required' : 'Optional'}
              </button>
              <button onClick={handleAdd} disabled={!newName.trim() || saving} className="flex items-center gap-1.5 px-4 py-2 bg-varistor-lime text-white rounded-lg text-xs font-bold hover:bg-lime-500 transition-colors disabled:opacity-50">
                <Plus size={13} />Add
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface AddSlotModalProps {
  employeeId: string;
  employeeName: string;
  onClose: () => void;
  onAdded: (slot: EmployeeDocumentSlot) => void;
  addToast: (msg: string, pts: number, type: 'credit' | 'debit') => void;
}

const AddSlotModal: React.FC<AddSlotModalProps> = ({ employeeId, employeeName, onClose, onAdded, addToast }) => {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [isRequired, setIsRequired] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const res = await addCustomSlotForEmployee(employeeId, name, isRequired, notes);
    setSaving(false);
    if (res.success && res.slot) { onAdded(res.slot); addToast(`Custom slot "${name}" added for ${employeeName}`, 0, 'credit'); onClose(); }
    else { addToast(res.error ?? 'Failed', 0, 'debit'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-[fadeInPage_150ms_ease-out]">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-varistor-border">
          <div>
            <h3 className="text-base font-bold text-brand-ink">Add Custom Document</h3>
            <p className="text-xs text-gray-400 mt-0.5">For {employeeName} only</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Document Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. NOC from Previous Employer" className="w-full text-sm border border-varistor-border rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-varistor-lime" onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Notes for Employee</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any specific instructions..." rows={2} className="w-full text-sm border border-varistor-border rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-varistor-lime resize-none" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsRequired(r => !r)} className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${isRequired ? 'bg-red-50 text-red-600 border-red-200' : 'bg-sky-50 text-sky-600 border-sky-200'}`}>
              {isRequired ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              {isRequired ? 'Required' : 'Optional'}
            </button>
            <span className="text-xs text-gray-400">Click to toggle</span>
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-varistor-border text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={!name.trim() || saving} className="flex-1 py-2.5 rounded-xl bg-varistor-lime text-white text-sm font-bold hover:bg-lime-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            <Plus size={14} />{saving ? 'Adding...' : 'Add Document'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface SlotCardProps {
  slot: EmployeeDocumentSlot;
  canManage: boolean;
  isOwnEmployee: boolean;
  onSlotUpdate: (s: EmployeeDocumentSlot) => void;
  onSlotRemove: (id: string) => void;
  addToast: (msg: string, pts: number, type: 'credit' | 'debit') => void;
  employeeId: string;
}

const SlotCard: React.FC<SlotCardProps> = ({
  slot, canManage, isOwnEmployee, onSlotUpdate, onSlotRemove, addToast, employeeId
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [editNotes, setEditNotes] = useState(slot.notes ?? '');
  const [savingNotes, setSavingNotes] = useState(false);

  const docStatus: DocumentStatus = slot.status in STATUS_CONFIG ? slot.status : 'Pending';

  const handleStatusChange = async (newStatus: DocumentStatus) => {
    setIsUpdating(true);
    const res = await updateSlotStatus(slot.id, newStatus);
    setIsUpdating(false);
    if (res.success) { onSlotUpdate({ ...slot, status: newStatus }); addToast(`Status updated to "${newStatus}"`, 0, 'credit'); }
    else { addToast(res.error ?? 'Failed', 0, 'debit'); }
  };

  const handleToggleRequired = async () => {
    setIsUpdating(true);
    const res = await updateSlotRequirement(slot.id, !slot.isRequired);
    setIsUpdating(false);
    if (res.success) { onSlotUpdate({ ...slot, isRequired: !slot.isRequired }); addToast(`Marked as ${!slot.isRequired ? 'Required' : 'Optional'}`, 0, 'credit'); }
    else { addToast(res.error ?? 'Failed', 0, 'debit'); }
  };

  const handleRemove = async () => {
    if (!window.confirm(`Remove custom slot "${slot.documentName}"?`)) return;
    setIsUpdating(true);
    const res = await removeCustomSlot(slot.id);
    setIsUpdating(false);
    if (res.success) { onSlotRemove(slot.id); addToast(`Slot removed`, 0, 'debit'); }
    else { addToast(res.error ?? 'Failed', 0, 'debit'); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUpdating(true);
    addToast('Encrypting and uploading...', 0, 'credit');
    const uploadRes = await uploadDocument(employeeId, file);
    if (!uploadRes.success || !uploadRes.document) {
      setIsUpdating(false); addToast(uploadRes.error ?? 'Upload failed', 0, 'debit'); e.target.value = ''; return;
    }
    const linkRes = await linkDocumentToSlot(slot.id, uploadRes.document.id);
    setIsUpdating(false); e.target.value = '';
    if (linkRes.success) { onSlotUpdate({ ...slot, documentId: uploadRes.document!.id, filename: file.name, status: 'Pending' }); addToast(`"${file.name}" uploaded`, 0, 'credit'); }
    else { addToast(linkRes.error ?? 'Link failed', 0, 'debit'); }
  };

  const handleView = async () => {
    if (!slot.documentId) return;
    trackDocumentAction('hr@varistor.in', 'View', slot.documentId);
    addToast('Decrypting...', 0, 'credit');
    const res = await downloadDecryptedDocument(slot.documentId);
    if (res.success && res.blob) { const url = URL.createObjectURL(res.blob); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 10000); }
    else { addToast(res.error ?? 'Failed', 0, 'debit'); }
  };

  const handleDownload = async () => {
    if (!slot.documentId) return;
    trackDocumentAction('hr@varistor.in', 'Download', slot.documentId);
    addToast('Decrypting...', 0, 'credit');
    const res = await downloadDecryptedDocument(slot.documentId);
    if (res.success && res.blob) { const url = URL.createObjectURL(res.blob); const a = document.createElement('a'); a.href = url; a.download = res.filename ?? 'document'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); }
    else { addToast(res.error ?? 'Failed', 0, 'debit'); }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    const res = await updateSlotNotes(slot.id, editNotes);
    setSavingNotes(false);
    if (res.success) { onSlotUpdate({ ...slot, notes: editNotes }); setShowNotes(false); addToast('Notes saved', 0, 'credit'); }
    else { addToast(res.error ?? 'Failed', 0, 'debit'); }
  };

  const hasFile = !!slot.filename;

  return (
    <div className={`bg-white rounded-[14px] border shadow-sm flex flex-col group transition-all hover:shadow-md ${isUpdating ? 'opacity-70' : ''} ${docStatus === 'Rejected' ? 'border-red-200' : 'border-varistor-border'}`}>
      <div className={`h-28 rounded-t-[13px] flex items-center justify-center relative ${hasFile ? 'bg-emerald-50' : 'bg-gray-50'}`}>
        {hasFile ? <FileCheck2 className="text-emerald-400" size={36} /> : <FileText className="text-gray-200" size={36} />}
        <span className={`absolute top-2 right-2 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${slot.isRequired ? 'bg-red-50 text-red-500 border-red-200' : 'bg-sky-50 text-sky-500 border-sky-200'}`}>
          {slot.isRequired ? '\u2605 Required' : 'Optional'}
        </span>
        {slot.isCustom && <span className="absolute top-2 left-2 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-50 text-purple-500 border border-purple-200">Custom</span>}
      </div>
      <div className="flex-1 p-4 flex flex-col gap-3">
        <div>
          <h3 className="font-semibold text-brand-ink text-sm leading-tight">{slot.documentName}</h3>
          {hasFile && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{slot.filename}</p>}
          {slot.notes && <p className="text-[11px] text-amber-600 mt-1 bg-amber-50 rounded-lg px-2 py-1 border border-amber-100">&#128206; {slot.notes}</p>}
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-gray-50">
          {canManage ? (
            <div className="relative">
              <select value={docStatus} onChange={e => handleStatusChange(e.target.value as DocumentStatus)} disabled={isUpdating} className={`appearance-none text-[10px] font-bold uppercase tracking-wide pr-6 pl-2 py-1 rounded-full border cursor-pointer focus:outline-none focus:ring-1 focus:ring-varistor-lime ${STATUS_CONFIG[docStatus]?.className ?? 'bg-gray-100 text-gray-500 border-gray-200'} ${isUpdating ? 'opacity-60 cursor-not-allowed' : ''}`} title="Change status">
                {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-current opacity-60">&#9660;</span>
            </div>
          ) : <StatusBadge status={docStatus} />}
          <div className="flex items-center gap-2">
            {canManage && (
              <button onClick={handleToggleRequired} disabled={isUpdating} title={slot.isRequired ? 'Make Optional' : 'Make Required'} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                {slot.isRequired ? <ToggleRight size={14} className="text-varistor-lime" /> : <ToggleLeft size={14} className="text-gray-300" />}
              </button>
            )}
            {canManage && (
              <button onClick={() => { setShowNotes(n => !n); setEditNotes(slot.notes ?? ''); }} title="Notes" className="p-1 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors">
                <StickyNote size={13} />
              </button>
            )}
            {canManage && slot.isCustom && (
              <button onClick={handleRemove} disabled={isUpdating} title="Remove custom slot" className="p-1 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
        {showNotes && canManage && (
          <div className="pt-2 border-t border-gray-50 space-y-2">
            <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Add HR notes..." rows={2} className="w-full text-xs border border-varistor-border rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-varistor-lime resize-none" />
            <div className="flex gap-2">
              <button onClick={handleSaveNotes} disabled={savingNotes} className="flex items-center gap-1 px-2.5 py-1 bg-varistor-lime text-white rounded-lg text-[11px] font-bold hover:bg-lime-500 transition-colors">
                <Save size={11} />{savingNotes ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setShowNotes(false)} className="px-2.5 py-1 border border-varistor-border rounded-lg text-[11px] text-gray-500 hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 text-[11px] font-semibold pt-1">
          {isOwnEmployee && (
            <label className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-varistor-border bg-gray-50 text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}>
              <Upload size={11} />{hasFile ? 'Replace' : 'Upload'}
              <input type="file" className="hidden" onChange={handleFileUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
            </label>
          )}
          {hasFile && slot.documentId && (
            <>
              <button onClick={handleView} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"><Eye size={11} />View</button>
              <button onClick={handleDownload} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-varistor-border bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"><Download size={11} />Download</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const DocumentVault: React.FC = () => {
  const { currentRole, addToast } = useVariPoints();
  const [slots, setSlots] = useState<EmployeeDocumentSlot[]>([]);
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddSlot, setShowAddSlot] = useState(false);

  const loggedInEmployeeId = 'VAR-024';
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(loggedInEmployeeId);

  const canManage = currentRole === 'Admin' || currentRole === 'HR';
  const canSelectEmployee = canManage;

  useEffect(() => {
    getEmployees().then(setEmployees);
    if (canManage) getDocumentTemplates().then(setTemplates);
  }, [canManage]);

  useEffect(() => {
    if (!canManage) setSelectedEmployeeId(loggedInEmployeeId);
  }, [currentRole, canManage]);

  const loadSlots = useCallback(async () => {
    setIsLoading(true);
    if (canManage) await seedEmployeeSlots(selectedEmployeeId).catch(() => {});
    const fetched = await getEmployeeDocumentSlots(selectedEmployeeId);
    setSlots(fetched);
    setIsLoading(false);
  }, [selectedEmployeeId, canManage]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || employees[0];
  const isOwnEmployee = selectedEmployeeId === loggedInEmployeeId || !canSelectEmployee;

  const totalRequired = slots.filter(s => s.isRequired).length;
  const uploadedRequired = slots.filter(s => s.isRequired && !!s.filename).length;
  const totalSlots = slots.length;
  const uploadedSlots = slots.filter(s => !!s.filename).length;
  const pct = totalSlots > 0 ? Math.round((uploadedSlots / totalSlots) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto pb-20 animate-[fadeInPage_250ms_ease-out]">
      <div className="bg-white rounded-[14px] p-6 lg:p-8 border border-varistor-border shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex-1">
            {canSelectEmployee ? (
              <div className="flex items-center gap-3 mb-3">
                <Users size={18} className="text-varistor-lime shrink-0" />
                <select value={selectedEmployeeId} onChange={e => setSelectedEmployeeId(e.target.value)} className="bg-varistor-pageBg border border-varistor-border text-brand-ink text-sm rounded-xl focus:ring-varistor-lime focus:border-varistor-lime block w-full max-w-xs p-2.5 font-semibold">
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.fullName} ({emp.employeeId})</option>)}
                </select>
              </div>
            ) : (
              <h1 className="text-xl font-bold text-brand-ink mb-1">{selectedEmployee?.fullName} &middot; {selectedEmployee?.employeeId}</h1>
            )}
            <p className="text-sm text-gray-400 font-medium">{selectedEmployee?.department} Department</p>
            {!isLoading && totalSlots > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs font-semibold text-gray-500 mb-1.5">
                  <span>{uploadedSlots} of {totalSlots} documents uploaded</span>
                  <span className={pct === 100 ? 'text-emerald-600' : 'text-amber-600'}>{pct}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : 'bg-varistor-lime'}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-gray-400">
                  <AlertCircle size={11} />{uploadedRequired}/{totalRequired} required documents uploaded
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 items-end shrink-0">
            <div className="flex gap-2 flex-wrap justify-end">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-full text-xs font-semibold border border-red-100"><Lock size={12} />Encrypted</div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a4d2e] text-white rounded-full text-xs font-semibold"><ShieldCheck size={12} />Audit log on</div>
            </div>
            {canManage && (
              <button onClick={() => setShowAddSlot(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-varistor-lime/10 text-varistor-lime rounded-full text-xs font-bold border border-varistor-lime/20 hover:bg-varistor-lime/20 transition-colors">
                <Plus size={12} />Add custom document
              </button>
            )}
          </div>
        </div>
      </div>

      {canManage && (
        <TemplateManager
          templates={templates}
          onTemplateUpdate={updated => setTemplates(prev => prev.map(t => t.id === updated.id ? updated : t))}
          onTemplateCreate={created => setTemplates(prev => [...prev, created])}
          onTemplateDelete={id => setTemplates(prev => prev.filter(t => t.id !== id))}
          addToast={addToast}
        />
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-64 bg-gray-100 rounded-[14px]" />)}
        </div>
      ) : slots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Sparkles size={40} className="text-gray-200 mb-4" />
          <p className="text-gray-400 font-semibold text-sm">No document slots found</p>
          <p className="text-gray-300 text-xs mt-1">Run the migration first, then seed slots for this employee.</p>
          {canManage && (
            <button onClick={loadSlots} className="mt-4 px-4 py-2 bg-varistor-lime text-white rounded-xl text-sm font-bold hover:bg-lime-500 transition-colors">
              Retry / Seed slots
            </button>
          )}
        </div>
      ) : (
        <>
          {slots.filter(s => s.isRequired).length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={14} className="text-red-500" />
                <h2 className="text-sm font-bold text-brand-ink">Required Documents</h2>
                <span className="text-xs text-gray-400">({slots.filter(s => s.isRequired && s.filename).length}/{slots.filter(s => s.isRequired).length} uploaded)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {slots.filter(s => s.isRequired).map(slot => (
                  <SlotCard key={slot.id} slot={slot} canManage={canManage} isOwnEmployee={isOwnEmployee}
                    onSlotUpdate={updated => setSlots(prev => prev.map(s => s.id === updated.id ? updated : s))}
                    onSlotRemove={id => setSlots(prev => prev.filter(s => s.id !== id))}
                    addToast={addToast} employeeId={selectedEmployeeId}
                  />
                ))}
              </div>
            </div>
          )}
          {slots.filter(s => !s.isRequired).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Star size={14} className="text-sky-400" />
                <h2 className="text-sm font-bold text-brand-ink">Optional Documents</h2>
                <span className="text-xs text-gray-400">({slots.filter(s => !s.isRequired && s.filename).length}/{slots.filter(s => !s.isRequired).length} uploaded)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {slots.filter(s => !s.isRequired).map(slot => (
                  <SlotCard key={slot.id} slot={slot} canManage={canManage} isOwnEmployee={isOwnEmployee}
                    onSlotUpdate={updated => setSlots(prev => prev.map(s => s.id === updated.id ? updated : s))}
                    onSlotRemove={id => setSlots(prev => prev.filter(s => s.id !== id))}
                    addToast={addToast} employeeId={selectedEmployeeId}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {showAddSlot && selectedEmployee && (
        <AddSlotModal
          employeeId={selectedEmployeeId}
          employeeName={selectedEmployee.fullName}
          onClose={() => setShowAddSlot(false)}
          onAdded={newSlot => setSlots(prev => [...prev, newSlot])}
          addToast={addToast}
        />
      )}
    </div>
  );
};
