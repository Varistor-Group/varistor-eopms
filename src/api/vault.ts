/**
 * MOCK VAULT SERVICE
 * 
 * TODO: Replace with real Supabase Storage + Database queries.
 */



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
