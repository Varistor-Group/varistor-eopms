/**
 * VAULT SERVICE — Supabase Storage + Database
 * Replaces Express server + local file system.
 * Documents are encrypted client-side before upload, decrypted on download.
 */

import { supabase } from '../lib/supabase';
import type { DocumentStatus } from '../types';
import { encryptFile, decryptFile, getMasterKey } from '../utils/crypto';

const BUCKET = 'employee-documents';

export interface VaultDocument {
  id: string;
  name: string;
  type: string;
  size: string;
  status: DocumentStatus;
  url: string;
  storagePath: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToDoc(row: any): VaultDocument {
  return {
    id: row.id,
    name: row.filename,
    type: row.type,
    size: row.size,
    status: row.status as DocumentStatus,
    url: '#',
    storagePath: row.storage_path,
  };
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function getVaultDocuments(employeeId: string): Promise<VaultDocument[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('employee_id', employeeId)
    .order('created_at', { ascending: false });
  if (error) { console.error('[getVaultDocuments]', error.message); return []; }
  return (data ?? []).map(rowToDoc);
}

// ─── Upload ───────────────────────────────────────────────────────────────────

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

    // Activity log
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

// ─── Replace / Update file ────────────────────────────────────────────────────

export async function updateDocumentFile(
  documentId: string,
  file: File
): Promise<{ success: boolean; document?: VaultDocument; error: string | null }> {
  try {
    // Get current document to find storage_path
    const { data: existing } = await supabase
      .from('documents')
      .select('storage_path, employee_id')
      .eq('id', documentId)
      .single();
    if (!existing) return { success: false, error: 'Document not found.' };

    // Remove old file
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

// ─── Download (decrypt) ───────────────────────────────────────────────────────

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

    // fileData is a Blob from storage
    const encryptedPayload = await fileData.text();
    const decryptedBlob = await decryptFile(encryptedPayload, key, mimeType);
    return { success: true, blob: decryptedBlob, filename: doc.filename };
  } catch (err) {
    console.error('[downloadDecryptedDocument]', err);
    return { success: false, error: 'Decryption failed.' };
  }
}

// ─── Track activity ───────────────────────────────────────────────────────────

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

// ─── Update status (HR/Admin) ─────────────────────────────────────────────────

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

  // Log
  await supabase.from('activity_log').insert({
    action: 'document_status_changed',
    performed_by: performedBy,
    details: `Document ${documentId} status changed to ${newStatus}`,
    metadata: { documentId, newStatus },
  });

  return { success: true, error: null };
}
