<?php
/**
 * GET    /api/employee-document-slots/:employeeId              — list slots for an employee (joined with document filename/storage_path)
 * POST   /api/employee-document-slots/:employeeId/seed         — seed slots from active templates for a new/existing employee
 * POST   /api/employee-document-slots                          — add a custom slot (HR/Admin)
 * PUT    /api/employee-document-slots/:id/link                 — link an uploaded document to a slot
 * ... (status/notes/sync/remove/pending-summary — Part 2)
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

$id = $params['id'] ?? null;
$employeeId = $params['employeeId'] ?? null;
$action = $params['action'] ?? null;

function generateUuidV4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function rowToSlot($row) {
    return [
        'id' => $row['id'],
        'employeeId' => $row['employee_id'],
        'templateId' => $row['template_id'],
        'documentName' => $row['document_name'],
        'isRequired' => (bool)$row['is_required'],
        'isCustom' => (bool)$row['is_custom'],
        'documentId' => $row['document_id'],
        'filename' => $row['doc_filename'] ?? null,
        'storagePath' => $row['doc_storage_path'] ?? null,
        'status' => $row['status'] ?? 'Pending',
        'notes' => $row['notes'] ?? '',
        'createdAt' => $row['created_at'],
    ];
}

// GET /api/employee-document-slots/:employeeId
if ($method === 'GET' && $employeeId !== null && $action === null) {
    $stmt = $db->prepare(
        'SELECT s.*, d.filename AS doc_filename, d.storage_path AS doc_storage_path
         FROM employee_document_slots s
         LEFT JOIN documents d ON d.id = s.document_id
         WHERE s.employee_id = ?
         ORDER BY s.created_at ASC'
    );
    $stmt->execute([$employeeId]);
    json_ok(array_map('rowToSlot', $stmt->fetchAll()));
}

// POST /api/employee-document-slots/:employeeId/seed
// Replaces Supabase RPC seed_employee_document_slots — creates a slot for every
// active template the employee doesn't already have a slot for. Idempotent:
// safe to call on an employee who already has some/all slots seeded.
if ($method === 'POST' && $employeeId !== null && $action === 'seed') {
    $templates = $db->query('SELECT * FROM document_templates WHERE is_active = 1')->fetchAll();

    $existingStmt = $db->prepare('SELECT template_id FROM employee_document_slots WHERE employee_id = ? AND template_id IS NOT NULL');
    $existingStmt->execute([$employeeId]);
    $existingTemplateIds = array_column($existingStmt->fetchAll(), 'template_id');

    $insert = $db->prepare(
        'INSERT INTO employee_document_slots (id, employee_id, template_id, document_name, is_required, is_custom)
         VALUES (?, ?, ?, ?, ?, 0)'
    );

    foreach ($templates as $t) {
        if (in_array($t['id'], $existingTemplateIds)) continue;
        $insert->execute([generateUuidV4(), $employeeId, $t['id'], $t['name'], (int)$t['is_required']]);
    }

    json_ok(['success' => true]);
}
// POST /api/employee-document-slots/:employeeId/request/:templateId
// Adds a single template as a slot for one employee — for HR requesting
// one specific document, as opposed to seed (which adds every active template).
if ($method === 'POST' && $employeeId !== null && isset($params['templateId'])) {
    $templateId = $params['templateId'];

    $existing = $db->prepare('SELECT id FROM employee_document_slots WHERE employee_id = ? AND template_id = ? LIMIT 1');
    $existing->execute([$employeeId, $templateId]);
    if ($existing->fetch()) {
        json_error('This document has already been requested for this employee.', 422);
    }

    $tmplStmt = $db->prepare('SELECT name, is_required FROM document_templates WHERE id = ? LIMIT 1');
    $tmplStmt->execute([$templateId]);
    $tmpl = $tmplStmt->fetch();
    if (!$tmpl) json_error('Template not found.', 404);

    $newId = generateUuidV4();
    $db->prepare(
        'INSERT INTO employee_document_slots (id, employee_id, template_id, document_name, is_required, is_custom)
         VALUES (?, ?, ?, ?, ?, 0)'
    )->execute([$newId, $employeeId, $templateId, $tmpl['name'], (int)$tmpl['is_required']]);

    $fetch = $db->prepare(
        'SELECT s.*, d.filename AS doc_filename, d.storage_path AS doc_storage_path
         FROM employee_document_slots s LEFT JOIN documents d ON d.id = s.document_id WHERE s.id = ?'
    );
    $fetch->execute([$newId]);
    json_ok(rowToSlot($fetch->fetch()));
}
// POST /api/employee-document-slots  — add custom slot
if ($method === 'POST' && $employeeId === null && $id === null) {
    $input = request_body();
    $empId = $input['employeeId'] ?? '';
    $documentName = trim($input['documentName'] ?? '');
    $isRequired = (bool)($input['isRequired'] ?? true);
    $notes = trim($input['notes'] ?? '');
    if ($empId === '' || $documentName === '') json_error('employeeId and documentName are required.', 422);

    $newId = generateUuidV4();
    $db->prepare(
        'INSERT INTO employee_document_slots (id, employee_id, template_id, document_name, is_required, is_custom, notes)
         VALUES (?, ?, NULL, ?, ?, 1, ?)'
    )->execute([$newId, $empId, $documentName, (int)$isRequired, $notes]);

    $fetch = $db->prepare(
        'SELECT s.*, d.filename AS doc_filename, d.storage_path AS doc_storage_path
         FROM employee_document_slots s LEFT JOIN documents d ON d.id = s.document_id WHERE s.id = ?'
    );
    $fetch->execute([$newId]);
    json_ok(rowToSlot($fetch->fetch()));
}

// PUT /api/employee-document-slots/:id/link
if ($method === 'PUT' && $id !== null && $action === 'link') {
    $input = request_body();
    $documentId = $input['documentId'] ?? '';
    if ($documentId === '') json_error('documentId is required.', 422);

    $db->prepare('UPDATE employee_document_slots SET document_id = ?, status = ? WHERE id = ?')
       ->execute([$documentId, 'Pending', $id]);
    json_ok(['success' => true]);
}
function logSlotActivity($db, $action, $performedBy, $details, $metadata) {
    $db->prepare('INSERT INTO activity_log (id, action, performed_by, details, metadata) VALUES (?, ?, ?, ?, ?)')
       ->execute([generateUuidV4(), $action, $performedBy, $details, json_encode($metadata)]);
}

// PUT /api/employee-document-slots/:id  — update requirement / status / notes (any subset)
if ($method === 'PUT' && $id !== null && $action === null) {
    $input = request_body();

    $fields = [];
    $values = [];
    if (array_key_exists('isRequired', $input)) { $fields[] = 'is_required = ?'; $values[] = (int)(bool)$input['isRequired']; }
    if (array_key_exists('notes', $input))      { $fields[] = 'notes = ?';       $values[] = $input['notes']; }

    $statusChanged = array_key_exists('status', $input);
    if ($statusChanged) { $fields[] = 'status = ?'; $values[] = $input['status']; }

    if (!empty($fields)) {
        $values[] = $id;
        $db->prepare('UPDATE employee_document_slots SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    }

    if ($statusChanged) {
        requireRole(['HR', 'Admin']);
        logSlotActivity($db, 'slot_status_changed', $myId, "Document slot $id status changed to {$input['status']}", ['slotId' => $id, 'status' => $input['status']]);
    }

    json_ok(['success' => true]);
}

// DELETE /api/employee-document-slots/:id  — custom slots only
if ($method === 'DELETE' && $id !== null) {
    $db->prepare('DELETE FROM employee_document_slots WHERE id = ? AND is_custom = 1')->execute([$id]);
    json_ok(['success' => true]);
}

// PUT /api/employee-document-slots/sync/:templateId
// Propagates a template's is_required change to all non-custom slots derived from it.
if ($method === 'PUT' && $params['templateId'] ?? null) {
    requireRole(['HR', 'Admin']);
    $templateId = $params['templateId'];
    $input = request_body();
    $isRequired = (bool)($input['isRequired'] ?? true);

    $db->prepare('UPDATE employee_document_slots SET is_required = ? WHERE template_id = ? AND is_custom = 0')
       ->execute([(int)$isRequired, $templateId]);
    json_ok(['success' => true]);
}

// GET /api/employee-document-slots-pending-summary
// Returns { pending: [employeeIds...], seeded: [employeeIds...] }
if ($method === 'GET' && ($params['summary'] ?? null) === 'pending') {
    $rows = $db->query('SELECT employee_id, document_id, status, is_required FROM employee_document_slots')->fetchAll();

    $seeded = [];
    $unverifiedCounts = [];

    foreach ($rows as $row) {
        $seeded[$row['employee_id']] = true;
        if ((bool)$row['is_required'] && (!$row['document_id'] || $row['status'] !== 'Verified')) {
            $unverifiedCounts[$row['employee_id']] = ($unverifiedCounts[$row['employee_id']] ?? 0) + 1;
        }
    }

    $pending = array_keys(array_filter($unverifiedCounts, fn($c) => $c > 0));

    json_ok(['pending' => $pending, 'seeded' => array_keys($seeded)]);
}
json_error("Method not allowed: {$method}", 405);
