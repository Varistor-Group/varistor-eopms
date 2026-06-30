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

export async function getVaultDocuments(_employeeId: string) {
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 600));
  
  // Return the mock array
  return MOCK_DOCUMENTS;
}

export async function trackDocumentAction(userEmail: string, action: string, documentId: string) {
  // Simulate writing to an audit log table
  console.log(`[Audit Log] ${new Date().toISOString()} | ${userEmail} | ${action} | ${documentId}`);
  return true;
}
