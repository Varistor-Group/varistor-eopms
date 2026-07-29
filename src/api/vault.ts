/**
 * VAULT SERVICE — MySQL (via PHP backend) + real file storage
 * Converted from Supabase Storage + Database. Documents are still encrypted
 * client-side before upload / decrypted after download — that logic
 * (encryptFile/decryptFile/getMasterKey) is UNCHANGED. Only the storage
 * layer (where encrypted bytes and metadata live) changed.
 */

import { apiFetch } from './httpClient';
import type { DocumentStatus, DocumentTemplate, EmployeeDocumentSlot } from '../types';
import { encryptFile, decryptFile, getMasterKey } from '../utils/crypto';

export interface VaultDocument {
  id: string;
  name: string;
  type: string;
  size: string;
  status: DocumentStatus;
  url: string;
  storagePath: string;
  filename?: string;
}

// ─── Fetch ────────────────────────────────────────────────────────────────

export async function getVaultDocuments(employeeId: string): Promise<VaultDocument[]> {
  try {
    const res = await apiFetch(`/api/documents/${employeeId}`);
    if (!res.ok) { console.error('[getVaultDocuments]', res.statusText); return []; }
    return await res.json();
  } catch (err) {
    console.error('[getVaultDocuments]', err);
    return [];
  }
}

// ─── Upload ───────────────────────────────────────────────────────────────

export async function uploadDocument(
  employeeId: string,
  file: File
): Promise<{ success: boolean; document?: VaultDocument; error: string | null }> {
  try {
    const key = await getMasterKey();
      const encryptedBlob = await encryptFile(file, key);
      const blob = new Blob([encryptedBlob], { type: 'application/octet-stream' });

      const formData = new FormData();
      formData.append('employeeId', employeeId); // (only in uploadDocument, not updateDocumentFile)
      formData.append('file', blob, `${file.name}.enc`);
    const res = await apiFetch('/api/documents', {
      method: 'POST',
      body: formData,
      isMultipart: true,
    });
    const result = await res.json().catch(() => null);
    if (!res.ok || !result) return { success: false, error: result?.error || 'Upload failed.' };

    return { success: true, document: result, error: null };
  } catch (err) {
    console.error('[uploadDocument]', err);
    return { success: false, error: 'Upload failed.' };
  }
}

// ─── Replace / Update file ──────────────────────────────────────────────────

export async function updateDocumentFile(
  documentId: string,
  file: File
): Promise<{ success: boolean; document?: VaultDocument; error: string | null }> {
  try {
    const key = await getMasterKey();
      const encryptedBlob = await encryptFile(file, key);
      const blob = new Blob([encryptedBlob], { type: 'application/octet-stream' });

      const formData = new FormData();
      formData.append('file', blob, `${file.name}.enc`);

    const res = await apiFetch(`/api/documents/${documentId}`, {
      method: 'PUT',
      body: formData,
      isMultipart: true,
    });
    const result = await res.json().catch(() => null);
    if (!res.ok || !result) return { success: false, error: result?.error || 'Update failed.' };

    return { success: true, document: result, error: null };
  } catch (err) {
    console.error('[updateDocumentFile]', err);
    return { success: false, error: 'Update failed.' };
  }
}

// ─── Download (decrypt) ──────────────────────────────────────────────────────

export async function downloadDecryptedDocument(
  documentId: string
): Promise<{ success: boolean; blob?: Blob; filename?: string; error?: string }> {
  try {
    // Need the filename for the decrypted result — fetch metadata first.
    // NOTE: this costs one extra request vs. the original (which had the
    // filename from a single `.select('storage_path, filename')` call before
    // downloading). Acceptable trade-off since the backend now serves the
    // raw encrypted stream directly rather than a queryable row + blob.
   const metaRes = await apiFetch(`/api/documents/single/${documentId}`);
    // ^ NOTE: this endpoint doesn't exist as a single-document GET yet —
    // see flag below.

    const fileRes = await apiFetch(`/api/documents/${documentId}/download`);
    if (!fileRes.ok) return { success: false, error: 'Download failed.' };

    const key = await getMasterKey();
    const meta = await metaRes.json().catch(() => null);
    const filename = meta?.filename ?? meta?.name ?? 'document';
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const mimeTypes: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
    const mimeType = mimeTypes[ext] ?? 'application/octet-stream';

    const encryptedPayload = await fileRes.text();
    const decryptedBlob = await decryptFile(encryptedPayload, key, mimeType);
    return { success: true, blob: decryptedBlob, filename };
  } catch (err) {
    console.error('[downloadDecryptedDocument]', err);
    return { success: false, error: 'Decryption failed.' };
  }
}

// ─── Update status (HR/Admin) ────────────────────────────────────────────────

export async function updateDocumentStatus(
  documentId: string,
  newStatus: DocumentStatus
): Promise<{ success: boolean; error: string | null }> {
  const res = await apiFetch(`/api/documents/${documentId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status: newStatus }),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.success) return { success: false, error: result?.error || 'Failed to update status.' };
  return { success: true, error: null };
}
export async function trackDocumentAction(action: string, documentId: string): Promise<boolean> {
  try {
    const res = await apiFetch('/api/activity', {
      method: 'POST',
      body: JSON.stringify({ action, details: `Document action: ${action}`, metadata: { documentId } }),
    });
    const result = await res.json().catch(() => null);
    return !!result?.success;
  } catch {
    return false;
  }
}
// ===========================================================================
// TEMPLATE MANAGEMENT (HR/Admin)
// ===========================================================================

export async function getDocumentTemplates(): Promise<DocumentTemplate[]> {
  try {
    const res = await apiFetch('/api/document-templates');
    if (!res.ok) { console.error('[getDocumentTemplates]', res.statusText); return []; }
    return await res.json();
  } catch (err) {
    console.error('[getDocumentTemplates]', err);
    return [];
  }
}

export async function createDocumentTemplate(
  name: string,
  description: string,
  isRequired: boolean
): Promise<{ success: boolean; template?: DocumentTemplate; error: string | null }> {
  const res = await apiFetch('/api/document-templates', {
    method: 'POST',
    body: JSON.stringify({ name: name.trim(), description: description.trim(), isRequired }),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result) return { success: false, error: result?.error || 'Failed to create template.' };
  return { success: true, template: result, error: null };
}

export async function updateDocumentTemplate(
  templateId: string,
  patch: Partial<{ isRequired: boolean; isActive: boolean; name: string; description: string }>
): Promise<{ success: boolean; template?: DocumentTemplate; error: string | null }> {
  const res = await apiFetch(`/api/document-templates/${templateId}`, {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result) return { success: false, error: result?.error || 'Failed to update template.' };
  return { success: true, template: result, error: null };
}

export async function deleteDocumentTemplate(
  templateId: string
): Promise<{ success: boolean; error: string | null }> {
  const res = await apiFetch(`/api/document-templates/${templateId}`, { method: 'DELETE' });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.success) return { success: false, error: result?.error || 'Failed to delete template.' };
  return { success: true, error: null };
}

// ===========================================================================
// EMPLOYEE DOCUMENT SLOTS
// ===========================================================================

export async function getEmployeeDocumentSlots(employeeId: string): Promise<EmployeeDocumentSlot[]> {
  try {
    const res = await apiFetch(`/api/employee-document-slots/${employeeId}`);
    if (!res.ok) { console.error('[getEmployeeDocumentSlots]', res.statusText); return []; }
    return await res.json();
  } catch (err) {
    console.error('[getEmployeeDocumentSlots]', err);
    return [];
  }
}

export async function seedEmployeeSlots(
  employeeId: string
): Promise<{ success: boolean; error: string | null }> {
  const res = await apiFetch(`/api/employee-document-slots/${employeeId}/seed`, { method: 'POST' });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.success) return { success: false, error: result?.error || 'Failed to seed slots.' };
  return { success: true, error: null };
}

export async function addCustomSlotForEmployee(
  employeeId: string,
  documentName: string,
  isRequired: boolean,
  notes?: string
): Promise<{ success: boolean; slot?: EmployeeDocumentSlot; error: string | null }> {
  const res = await apiFetch('/api/employee-document-slots', {
    method: 'POST',
    body: JSON.stringify({ employeeId, documentName: documentName.trim(), isRequired, notes: notes?.trim() ?? '' }),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result) return { success: false, error: result?.error || 'Failed to add slot.' };
  return { success: true, slot: result, error: null };
}

export async function updateSlotRequirement(
  slotId: string,
  isRequired: boolean
): Promise<{ success: boolean; error: string | null }> {
  const res = await apiFetch(`/api/employee-document-slots/${slotId}`, {
    method: 'PUT',
    body: JSON.stringify({ isRequired }),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.success) return { success: false, error: result?.error || 'Failed to update requirement.' };
  return { success: true, error: null };
}

export async function updateSlotStatus(
  slotId: string,
  status: DocumentStatus
): Promise<{ success: boolean; error: string | null }> {
  const res = await apiFetch(`/api/employee-document-slots/${slotId}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.success) return { success: false, error: result?.error || 'Failed to update status.' };
  return { success: true, error: null };
}

export async function updateSlotNotes(
  slotId: string,
  notes: string
): Promise<{ success: boolean; error: string | null }> {
  const res = await apiFetch(`/api/employee-document-slots/${slotId}`, {
    method: 'PUT',
    body: JSON.stringify({ notes }),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.success) return { success: false, error: result?.error || 'Failed to update notes.' };
  return { success: true, error: null };
}

export async function removeCustomSlot(
  slotId: string
): Promise<{ success: boolean; error: string | null }> {
  const res = await apiFetch(`/api/employee-document-slots/${slotId}`, { method: 'DELETE' });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.success) return { success: false, error: result?.error || 'Failed to remove slot.' };
  return { success: true, error: null };
}

export async function linkDocumentToSlot(
  slotId: string,
  documentId: string
): Promise<{ success: boolean; error: string | null }> {
  const res = await apiFetch(`/api/employee-document-slots/${slotId}/link`, {
    method: 'PUT',
    body: JSON.stringify({ documentId }),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.success) return { success: false, error: result?.error || 'Failed to link document.' };
  return { success: true, error: null };
}

export async function syncTemplateSlotsRequirement(
  templateId: string,
  isRequired: boolean
): Promise<{ success: boolean; error: string | null }> {
  const res = await apiFetch(`/api/employee-document-slots/sync/${templateId}`, {
    method: 'PUT',
    body: JSON.stringify({ isRequired }),
  });
  const result = await res.json().catch(() => null);
  if (!res.ok || !result?.success) return { success: false, error: result?.error || 'Failed to sync requirement.' };
  return { success: true, error: null };
}

export async function getEmployeesWithPendingDocuments(): Promise<{ pending: Set<string>; seeded: Set<string> }> {
  try {
    const res = await apiFetch('/api/employee-document-slots-pending-summary');
    if (!res.ok) { console.error('[getEmployeesWithPendingDocuments]', res.statusText); return { pending: new Set(), seeded: new Set() }; }
    const data = await res.json();
    return { pending: new Set(data.pending ?? []), seeded: new Set(data.seeded ?? []) };
  } catch (err) {
    console.error('[getEmployeesWithPendingDocuments]', err);
    return { pending: new Set(), seeded: new Set() };
  }
}