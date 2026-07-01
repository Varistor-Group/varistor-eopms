/**
 * MOCK VAULT SERVICE
 * 
 * TODO: Replace with real Supabase Storage + Database queries.
 */

const MOCK_DOCUMENTS = [
  { id: 'doc-1', name: 'Aadhar card', type: 'PDF', size: '1.2 MB', status: 'Verified', url: '#' },
  { id: 'doc-2', name: 'PAN card', type: 'PDF', size: '480 KB', status: 'Verified', url: '#' },
  { id: 'doc-3', name: 'Photo', type: 'JPG', size: '220 KB', status: 'Verified', url: '#' },
  { id: 'doc-4', name: 'Experience letter', type: 'PDF', size: '980 KB', status: 'Pending', url: '#' },
  { id: 'doc-5', name: 'Educational certificates', type: 'ZIP', size: '4.1 MB', status: 'Verified', url: '#' },
  { id: 'doc-6', name: 'Offer letter (signed)', type: 'PDF', size: '1.0 MB', status: 'Verified', url: '#' },
];

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
      status: d.status,
      url: '#'
    }));
  } catch (err) {
    console.error('Failed to fetch documents', err);
    return [];
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
