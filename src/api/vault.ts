/**
 * MOCK VAULT SERVICE
 *
 * TODO: Replace with real Supabase Storage + Database queries.
 */

import type { DocumentStatus } from '../types';

export async function getVaultDocuments(employeeId: string) {
  try {
    const res = await fetch(`http://localhost:3001/api/documents/${employeeId}`);
    const docs = await res.json();

    // Map DB fields back to the UI expected fields
    return docs.map((d: any) => ({
      id: d.id,
      name: d.filename,
      type: d.type,
      size: d.size,
      status: d.status as DocumentStatus,
      url: '#'
    }));
} catch (err) {
    console.error('Failed to fetch documents', err);
    return [];
  }
}

import { encryptFile, decryptFile, getMasterKey } from '../utils/crypto';

export async function uploadDocument(employeeId: string, file: File) {
  try {
    const key = await getMasterKey();
    const encryptedPayload = await encryptFile(file, key);

    const res = await fetch('http://localhost:3001/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId,
        filename: file.name,
        type: file.name.split('.').pop()?.toUpperCase() || 'DOCUMENT',
        size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
        payload: encryptedPayload
      })
    });
    const result = await res.json();
    return { success: result.success, document: result.document, error: result.error };
  } catch (err) {
    console.error('Failed to upload document', err);
    return { success: false, error: 'Server unreachable.' };
  }
}

export async function updateDocumentFile(documentId: string, file: File) {
  try {
    const key = await getMasterKey();
    const encryptedPayload = await encryptFile(file, key);

    const res = await fetch(`http://localhost:3001/api/documents/${documentId}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        type: file.name.split('.').pop()?.toUpperCase() || 'DOCUMENT',
        size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
        payload: encryptedPayload
      })
    });
    const result = await res.json();
    return { success: result.success, document: result.document, error: result.error };
  } catch (err) {
    console.error('Failed to update document file', err);
    return { success: false, error: 'Server unreachable.' };
  }
}

export async function downloadDecryptedDocument(documentId: string) {
  try {
    const res = await fetch(`http://localhost:3001/api/documents/${documentId}/download`);
    const result = await res.json();
    if (!result.success) return { success: false, error: result.error };

    const key = await getMasterKey();
    
    // Attempt to figure out MIME type from filename (simplified)
    const ext = result.filename.split('.').pop()?.toLowerCase();
    let mimeType = 'application/octet-stream';
    if (ext === 'pdf') mimeType = 'application/pdf';
    else if (['png', 'jpg', 'jpeg'].includes(ext)) mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

    const decryptedBlob = await decryptFile(result.payload, key, mimeType);
    
    return { success: true, blob: decryptedBlob, filename: result.filename };
  } catch (err) {
    console.error('Failed to download/decrypt document', err);
    return { success: false, error: 'Decryption or download failed.' };
  }
}

export async function trackDocumentAction(userEmail: string, action: string, documentId: string) {
  try {
    await fetch('http://localhost:3001/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employeeId: userEmail, // using email as identifier for now
        action,
        performed_by: userEmail,
        metadata: { documentId }
      })
    });
    return true;
  } catch (err) {
    console.error('Failed to log activity', err);
    return false;
  }
}

/**
 * Update a document's verification status.
 * TODO: Replace with Supabase:
 *   supabase.from('documents').update({ status: newStatus }).eq('id', documentId)
 *   + log to supabase.from('activity_log').insert(...)
 */
export async function updateDocumentStatus(
  documentId: string,
  newStatus: DocumentStatus,
  performedBy: string = 'hr@varistor.in'
): Promise<{ success: boolean; error: string | null }> {
  try {
    const res = await fetch(`http://localhost:3001/api/documents/${documentId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus, performedBy })
    });
    const result = await res.json();
    return { success: result.success, error: result.error || null };
  } catch (err) {
    console.error('Failed to update document status', err);
    return { success: false, error: 'Server unreachable.' };
  }
}
