<?php
/**
 * GET    /api/documents/:employeeId       — list documents for an employee
 * POST   /api/documents                   — upload a new document (multipart: employeeId, file)
 * PUT    /api/documents/:id                — replace file for existing document (multipart: file)
 * GET    /api/documents/:id/download       — stream raw encrypted bytes for client-side decryption
 * PUT    /api/documents/:id/status         — update status (HR/Admin)
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

$id = $params['id'] ?? null;
$employeeId = $params['employeeId'] ?? null;
$action = $params['action'] ?? null;

const DOC_UPLOAD_BASE = __DIR__ . '/uploads/documents';
const MAX_DOC_BYTES = 20 * 1024 * 1024; // 20MB, encrypted blob is slightly larger than original

function generateUuidV4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function rowToDoc($row) {
    return [
        'id' => $row['id'],
        'name' => $row['filename'],
        'filename' => $row['filename'],
        'type' => $row['type'],
        'size' => $row['size'],
        'status' => $row['status'],
        'url' => '#',
        'storagePath' => $row['storage_path'],
    ];
}

function logActivity($db, $action, $performedBy, $details, $metadata) {
    $db->prepare('INSERT INTO activity_log (id, action, performed_by, details, metadata) VALUES (?, ?, ?, ?, ?)')
       ->execute([generateUuidV4Global(), $action, $performedBy, $details, json_encode($metadata)]);
}
function generateUuidV4Global(): string { return generateUuidV4(); }

function saveEncryptedUpload($file, $employeeId) {
    if ($file['error'] !== UPLOAD_ERR_OK) throw new Exception('Upload failed (code ' . $file['error'] . ').');
    if ($file['size'] > MAX_DOC_BYTES) throw new Exception('File exceeds the 20MB limit.');

    $dir = DOC_UPLOAD_BASE . '/' . $employeeId;
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $safeName = time() . '_' . bin2hex(random_bytes(6)) . '.enc';
    $dest = $dir . '/' . $safeName;

    if (!move_uploaded_file($file['tmp_name'], $dest)) throw new Exception('Failed to save uploaded file.');

    return $employeeId . '/' . $safeName; // storage_path, matches Supabase convention
}

// GET /api/documents/:employeeId
if ($method === 'GET' && $employeeId !== null && $action === null) {
    $stmt = $db->prepare('SELECT * FROM documents WHERE employee_id = ? ORDER BY created_at DESC');
    $stmt->execute([$employeeId]);
    json_ok(array_map('rowToDoc', $stmt->fetchAll()));
}
// GET /api/documents/single/:id  — fetch one document's metadata
if ($method === 'GET' && $id !== null && $action === null) {
    $stmt = $db->prepare('SELECT * FROM documents WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $doc = $stmt->fetch();
    if (!$doc) json_error('Document not found.', 404);
    json_ok(rowToDoc($doc));
}
// GET /api/documents/:id/download
if ($method === 'GET' && $id !== null && $action === 'download') {
    $stmt = $db->prepare('SELECT storage_path, filename FROM documents WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $doc = $stmt->fetch();
    if (!$doc || !$doc['storage_path']) json_error('Document not found.', 404);

    $filePath = DOC_UPLOAD_BASE . '/' . $doc['storage_path'];
    if (!file_exists($filePath)) json_error('File missing on server.', 404);

    header('Content-Type: application/octet-stream');
    header('Content-Disposition: attachment; filename="' . basename($doc['storage_path']) . '"');
    header('Content-Length: ' . filesize($filePath));
    readfile($filePath);
    exit;
}

// POST /api/documents  (multipart: employeeId, file)
if ($method === 'POST' && $id === null && $employeeId === null) {
    $empId = $_POST['employeeId'] ?? '';
    if ($empId === '') json_error('employeeId is required.', 422);
    if (empty($_FILES['file']['name'])) json_error('file is required.', 422);

    $originalName = $_FILES['file']['name'];

    try {
        $storagePath = saveEncryptedUpload($_FILES['file'], $empId);
    } catch (Exception $e) {
        json_error($e->getMessage(), 422);
    }

    $newId = generateUuidV4();
    $type = strtoupper(pathinfo($originalName, PATHINFO_EXTENSION)) ?: 'DOCUMENT';
    $size = round($_FILES['file']['size'] / 1024 / 1024, 1) . ' MB';

    $db->prepare(
        'INSERT INTO documents (id, employee_id, filename, type, size, status, storage_path)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    )->execute([$newId, $empId, $originalName, $type, $size, 'Pending', $storagePath]);

    logActivity($db, 'document_uploaded', $myId, "Uploaded document $originalName", ['documentId' => $newId]);

    $fetch = $db->prepare('SELECT * FROM documents WHERE id = ?');
    $fetch->execute([$newId]);
    json_ok(rowToDoc($fetch->fetch()));
}

// PUT /api/documents/:id  (multipart: file) — replace
if ($method === 'PUT' && $id !== null && $action === null) {
    $existStmt = $db->prepare('SELECT employee_id, storage_path FROM documents WHERE id = ? LIMIT 1');
    $existStmt->execute([$id]);
    $existing = $existStmt->fetch();
    if (!$existing) json_error('Document not found.', 404);

    if (empty($_FILES['file']['name'])) json_error('file is required.', 422);
    $originalName = $_FILES['file']['name'];

    // Remove old file (best-effort, matches Supabase .remove() behavior)
    if ($existing['storage_path']) {
        $oldPath = DOC_UPLOAD_BASE . '/' . $existing['storage_path'];
        if (file_exists($oldPath)) @unlink($oldPath);
    }

    try {
        $newPath = saveEncryptedUpload($_FILES['file'], $existing['employee_id']);
    } catch (Exception $e) {
        json_error($e->getMessage(), 422);
    }

    $type = strtoupper(pathinfo($originalName, PATHINFO_EXTENSION)) ?: 'DOCUMENT';
    $size = round($_FILES['file']['size'] / 1024 / 1024, 1) . ' MB';

    $db->prepare(
        'UPDATE documents SET filename = ?, type = ?, size = ?, status = ?, storage_path = ? WHERE id = ?'
    )->execute([$originalName, $type, $size, 'Pending', $newPath, $id]);

    $fetch = $db->prepare('SELECT * FROM documents WHERE id = ?');
    $fetch->execute([$id]);
    json_ok(rowToDoc($fetch->fetch()));
}

// PUT /api/documents/:id/status
if ($method === 'PUT' && $id !== null && $action === 'status') {
    requireRole(['HR', 'Admin']);
    $input = request_body();
    $newStatus = $input['status'] ?? '';
    if ($newStatus === '') json_error('status is required.', 422);

    $db->prepare('UPDATE documents SET status = ? WHERE id = ?')->execute([$newStatus, $id]);
    logActivity($db, 'document_status_changed', $myId, "Document $id status changed to $newStatus", ['documentId' => $id, 'newStatus' => $newStatus]);
    json_ok(['success' => true]);
}

json_error("Method not allowed: {$method}", 405);