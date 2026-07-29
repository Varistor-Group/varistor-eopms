<?php
/**
 * GET    /api/document-templates              — list all templates
 * POST   /api/document-templates              — create template (HR/Admin)
 * PUT    /api/document-templates/:id          — update template (HR/Admin)
 * DELETE /api/document-templates/:id          — delete template (HR/Admin)
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

$id = $params['id'] ?? null;

function generateUuidV4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function rowToTemplate($row) {
    return [
        'id' => $row['id'],
        'name' => $row['name'],
        'description' => $row['description'] ?? '',
        'isRequired' => (bool)$row['is_required'],
        'isActive' => (bool)$row['is_active'],
        'sortOrder' => (int)$row['sort_order'],
        'createdAt' => $row['created_at'],
    ];
}

// GET /api/document-templates
if ($method === 'GET' && $id === null) {
    $rows = $db->query('SELECT * FROM document_templates ORDER BY sort_order ASC')->fetchAll();
    json_ok(array_map('rowToTemplate', $rows));
}

// POST /api/document-templates
if ($method === 'POST' && $id === null) {
    requireRole(['HR', 'Admin']);
    $input = request_body();
    $name = trim($input['name'] ?? '');
    $description = trim($input['description'] ?? '');
    $isRequired = (bool)($input['isRequired'] ?? true);
    if ($name === '') json_error('name is required.', 422);

    $newId = generateUuidV4();
    $db->prepare(
        'INSERT INTO document_templates (id, name, description, is_required, is_active) VALUES (?, ?, ?, ?, 1)'
    )->execute([$newId, $name, $description, (int)$isRequired]);

    $fetch = $db->prepare('SELECT * FROM document_templates WHERE id = ?');
    $fetch->execute([$newId]);
    json_ok(rowToTemplate($fetch->fetch()));
}

// PUT /api/document-templates/:id
if ($method === 'PUT' && $id !== null) {
    requireRole(['HR', 'Admin']);
    $input = request_body();

    $fields = [];
    $values = [];
    if (array_key_exists('isRequired', $input)) { $fields[] = 'is_required = ?'; $values[] = (int)(bool)$input['isRequired']; }
    if (array_key_exists('isActive', $input))   { $fields[] = 'is_active = ?';   $values[] = (int)(bool)$input['isActive']; }
    if (array_key_exists('name', $input))       { $fields[] = 'name = ?';       $values[] = $input['name']; }
    if (array_key_exists('description', $input)) { $fields[] = 'description = ?'; $values[] = $input['description']; }

    if (!empty($fields)) {
        $values[] = $id;
        $db->prepare('UPDATE document_templates SET ' . implode(', ', $fields) . ' WHERE id = ?')->execute($values);
    }

    $fetch = $db->prepare('SELECT * FROM document_templates WHERE id = ?');
    $fetch->execute([$id]);
    $row = $fetch->fetch();
    if (!$row) json_error('Template not found.', 404);
    json_ok(rowToTemplate($row));
}

// DELETE /api/document-templates/:id
if ($method === 'DELETE' && $id !== null) {
    requireRole(['HR', 'Admin']);
    $db->prepare('DELETE FROM document_templates WHERE id = ?')->execute([$id]);
    json_ok(['success' => true]);
}

json_error("Method not allowed: {$method}", 405);