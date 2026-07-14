/**
 * VAULT SERVICE - Supabase Storage + Database
 * Replaces Express server + local file system.
 * Documents are encrypted client-side before upload, decrypted on download.
 */

import { supabase } from '../lib/supabase';
import type { DocumentStatus, DocumentTemplate, EmployeeDocumentSlot } from '../types';
import { encryptFile, decryptFile, getMasterKey } from '../utils/crypto';

const BUCKET = 'employee-documents';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const slotsDb = () => (supabase as any).from('employee_document_slots');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const templatesDb = () => (supabase as any).from('document_templates');

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToDoc(row: any): VaultDocument {
  return {
    id: row.id,
    name: row.filename,
    filename: row.filename,
    type: row.type,
    size: row.size,
    status: row.status as DocumentStatus,
    url: '#',
    storagePath: row.storage_path,
  };
}

// Fetch
export async function getVaultDocuments(employeeId: string): Promise<VaultDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });
  if (error) { console.error('[getVaultDocuments]', error.message); return []; }
  return (data ?? []).map(rowToDoc);
}

// Upload
export async function uploadDocument(
  employeeId: string,
  file: File
): Promise<{ success: boolean; document?: VaultDocument; error: string | null }> {
  try {
    const key = await getMasterKey();
    const encryptedBlob = await encryptFile(file, key);
    const storagePath = `${employeeId}/${Date.now()}_${file.name}.enc`;
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, encryptedBlob, { contentType: 'application/octet-stream', upsert: false });
    if (uploadErr) return { success: false, error: uploadErr.message };
    const { data: doc, error: dbErr } = await supabase
      .from('documents')
      .insert({
        employee_id: employeeId,
        filename: file.name,
        type: file.name.split('.').pop()?.toUpperCase() || 'DOCUMENT',
        size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
        status: 'Pending',
        storage_path: storagePath,
      })
      .select()
      .single();
    if (dbErr) return { success: false, error: dbErr.message };
    await supabase.from('activity_log').insert({
      action: 'document_uploaded',
      performed_by: employeeId,
      details: `Uploaded document ${file.name}`,
      metadata: { documentId: doc.id },
    });
    return { success: true, document: rowToDoc(doc), error: null };
  } catch (err) {
    console.error('[uploadDocument]', err);
    return { success: false, error: 'Upload failed.' };
  }
}

// Replace / Update file
export async function updateDocumentFile(
  documentId: string,
  file: File
): Promise<{ success: boolean; document?: VaultDocument; error: string | null }> {
  try {
    const { data: existing } = await supabase
      .from('documents')
      .select('storage_path, employee_id')
      .eq('id', documentId)
      .single();
    if (!existing) return { success: false, error: 'Document not found.' };
    if (existing.storage_path) {
      await supabase.storage.from(BUCKET).remove([existing.storage_path]);
    }
    const key = await getMasterKey();
    const encryptedBlob = await encryptFile(file, key);
    const newPath = `${existing.employee_id}/${Date.now()}_${file.name}.enc`;
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(newPath, encryptedBlob, { contentType: 'application/octet-stream', upsert: false });
    if (uploadErr) return { success: false, error: uploadErr.message };
    const { data: updated, error: dbErr } = await supabase
      .from('documents')
      .update({
        filename: file.name,
        type: file.name.split('.').pop()?.toUpperCase() || 'DOCUMENT',
        size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
        status: 'Pending',
        storage_path: newPath,
      })
      .eq('id', documentId)
      .select()
      .single();
    if (dbErr) return { success: false, error: dbErr.message };
    return { success: true, document: rowToDoc(updated), error: null };
  } catch (err) {
    console.error('[updateDocumentFile]', err);
    return { success: false, error: 'Update failed.' };
  }
}

// Download (decrypt)
export async function downloadDecryptedDocument(
  documentId: string
): Promise<{ success: boolean; blob?: Blob; filename?: string; error?: string }> {
  try {
    const { data: doc } = await supabase
      .from('documents')
      .select('storage_path, filename')
      .eq('id', documentId)
      .single();
    if (!doc) return { success: false, error: 'Document not found.' };
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from(BUCKET)
      .download(doc.storage_path ?? '');
    if (downloadErr || !fileData) return { success: false, error: 'Download failed.' };
    const key = await getMasterKey();
    const ext = doc.filename.split('.').pop()?.toLowerCase() ?? '';
    const mimeTypes: Record<string, string> = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
    const mimeType = mimeTypes[ext] ?? 'application/octet-stream';
    const encryptedPayload = await fileData.text();
    const decryptedBlob = await decryptFile(encryptedPayload, key, mimeType);
    return { success: true, blob: decryptedBlob, filename: doc.filename };
  } catch (err) {
    console.error('[downloadDecryptedDocument]', err);
    return { success: false, error: 'Decryption failed.' };
  }
}

// Track activity
export async function trackDocumentAction(
  userEmail: string,
  action: string,
  documentId: string
): Promise<boolean> {
  const { error } = await supabase.from('activity_log').insert({
    action,
    performed_by: userEmail,
    details: `Document action: ${action}`,
    metadata: { documentId },
  });
  return !error;
}

// Update status (HR/Admin)
export async function updateDocumentStatus(
  documentId: string,
  newStatus: DocumentStatus,
  performedBy: string = 'hr@varistor.in'
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await supabase
    .from('documents')
    .update({ status: newStatus })
    .eq('id', documentId);
  if (error) return { success: false, error: error.message };
  await supabase.from('activity_log').insert({
    action: 'document_status_changed',
    performed_by: performedBy,
    details: `Document ${documentId} status changed to ${newStatus}`,
    metadata: { documentId, newStatus },
  });
  return { success: true, error: null };
}

// ===========================================================================
// TEMPLATE MANAGEMENT (HR/Admin)
// ===========================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToTemplate(row: any): DocumentTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    isRequired: row.is_required,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export async function getDocumentTemplates(): Promise<DocumentTemplate[]> {
  const { data, error } = await templatesDb()
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) { console.error('[getDocumentTemplates]', error.message); return []; }
  return (data ?? []).map(rowToTemplate);
}

export async function createDocumentTemplate(
  name: string,
  description: string,
  isRequired: boolean
): Promise<{ success: boolean; template?: DocumentTemplate; error: string | null }> {
  const { data, error } = await templatesDb()
    .insert({ name: name.trim(), description: description.trim(), is_required: isRequired, is_active: true })
    .select()
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, template: rowToTemplate(data), error: null };
}

export async function updateDocumentTemplate(
  templateId: string,
  patch: Partial<{ isRequired: boolean; isActive: boolean; name: string; description: string }>
): Promise<{ success: boolean; template?: DocumentTemplate; error: string | null }> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.isRequired !== undefined) dbPatch.is_required = patch.isRequired;
  if (patch.isActive !== undefined)   dbPatch.is_active   = patch.isActive;
  if (patch.name !== undefined)       dbPatch.name        = patch.name;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  const { data, error } = await templatesDb()
    .update(dbPatch)
    .eq('id', templateId)
    .select()
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, template: rowToTemplate(data), error: null };
}

export async function deleteDocumentTemplate(
  templateId: string
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await templatesDb()
    .delete()
    .eq('id', templateId);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

// ===========================================================================
// EMPLOYEE DOCUMENT SLOTS
// ===========================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToSlot(row: any): EmployeeDocumentSlot {
  return {
    id: row.id,
    employeeId: row.employee_id,
    templateId: row.template_id ?? undefined,
    documentName: row.document_name,
    isRequired: row.is_required,
    isCustom: row.is_custom,
    documentId: row.document_id ?? undefined,
    filename: row.documents?.filename ?? undefined,
    storagePath: row.documents?.storage_path ?? undefined,
    status: (row.status ?? 'Pending') as DocumentStatus,
    notes: row.notes ?? '',
    createdAt: row.created_at,
  };
}

export async function getEmployeeDocumentSlots(
  employeeId: string
): Promise<EmployeeDocumentSlot[]> {
  const { data, error } = await slotsDb()
    .select('*, documents(filename, storage_path)')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: true });
  if (error) { console.error('[getEmployeeDocumentSlots]', error.message); return []; }
  return (data ?? []).map(rowToSlot);
}

export async function seedEmployeeSlots(
  employeeId: string
): Promise<{ success: boolean; error: string | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc('seed_employee_document_slots', { p_employee_id: employeeId });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function addCustomSlotForEmployee(
  employeeId: string,
  documentName: string,
  isRequired: boolean,
  notes?: string
): Promise<{ success: boolean; slot?: EmployeeDocumentSlot; error: string | null }> {
  const { data, error } = await slotsDb()
    .insert({
      employee_id: employeeId,
      template_id: null,
      document_name: documentName.trim(),
      is_required: isRequired,
      is_custom: true,
      notes: notes?.trim() ?? '',
    })
    .select('*, documents(filename, storage_path)')
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, slot: rowToSlot(data), error: null };
}

export async function updateSlotRequirement(
  slotId: string,
  isRequired: boolean
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await slotsDb()
    .update({ is_required: isRequired })
    .eq('id', slotId);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function updateSlotStatus(
  slotId: string,
  status: DocumentStatus,
  performedBy: string = 'hr@varistor.in'
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await slotsDb()
    .update({ status })
    .eq('id', slotId);
  if (error) return { success: false, error: error.message };
  await supabase.from('activity_log').insert({
    action: 'slot_status_changed',
    performed_by: performedBy,
    details: `Document slot ${slotId} status changed to ${status}`,
    metadata: { slotId, status },
  });
  return { success: true, error: null };
}

export async function updateSlotNotes(
  slotId: string,
  notes: string
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await slotsDb()
    .update({ notes })
    .eq('id', slotId);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function removeCustomSlot(
  slotId: string
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await slotsDb()
    .delete()
    .eq('id', slotId)
    .eq('is_custom', true);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function linkDocumentToSlot(
  slotId: string,
  documentId: string
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await slotsDb()
    .update({ document_id: documentId, status: 'Pending' })
    .eq('id', slotId);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/**
 * When HR changes is_required on a template, propagate to ALL slots derived
 * from that template (non-custom only, so per-employee overrides are kept).
 */
export async function syncTemplateSlotsRequirement(
  templateId: string,
  isRequired: boolean
): Promise<{ success: boolean; error: string | null }> {
  const { error } = await slotsDb()
    .update({ is_required: isRequired })
    .eq('template_id', templateId)
    .eq('is_custom', false);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}
