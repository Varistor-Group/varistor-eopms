<?php
/**
 * GET    /api/policies          — list all (any authenticated user)
 * POST   /api/policies          — create (HR/Admin only)
 * PUT    /api/policies/:id      — update (HR/Admin only)
 * DELETE /api/policies/:id      — delete (HR/Admin only)
 */

$db = get_db();

// eslint-disable-next-line
function rowToPolicyPhp($row) { return $row; } // pass-through, mapping handled by frontend

if ($method === 'GET') {
    if (currentEmployeeId() === null) json_error('Unauthorized', 401);
    $rows = $db->query('SELECT * FROM policies ORDER BY effective_date DESC')->fetchAll();
    json_ok($rows);
}

if ($method === 'POST') {
    requireRole(['HR', 'Admin']);
    $input = request_body();

    $title = trim($input['title'] ?? '');
    if ($title === '') json_error('Title is required.', 422);

    $id = bin2hex(random_bytes(16));
    $stmt = $db->prepare('INSERT INTO policies (id, title, target, content, effective_date) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([
        $id,
        $title,
        $input['target'] ?? 'Both',
        $input['content'] ?? '',
        $input['effectiveDate'] ?? date('Y-m-d'),
    ]);

    $fetch = $db->prepare('SELECT * FROM policies WHERE id = ? LIMIT 1');
    $fetch->execute([$id]);
    json_ok(['success' => true, 'policy' => $fetch->fetch()]);
}

if ($method === 'PUT') {
    requireRole(['HR', 'Admin']);
    $id = $params['id'] ?? '';
    $input = request_body();

    $setClauses = [];
    $values = [];
    $fieldMap = ['title' => 'title', 'target' => 'target', 'content' => 'content', 'effectiveDate' => 'effective_date'];
    foreach ($fieldMap as $jsKey => $col) {
        if (array_key_exists($jsKey, $input)) {
            $setClauses[] = "$col = ?";
            $values[] = $input[$jsKey];
        }
    }

    if (!empty($setClauses)) {
        $values[] = $id;
        $sql = 'UPDATE policies SET ' . implode(', ', $setClauses) . ' WHERE id = ?';
        $db->prepare($sql)->execute($values);
    }

    json_ok(['success' => true]);
}

if ($method === 'DELETE') {
    requireRole(['HR', 'Admin']);
    $id = $params['id'] ?? '';
    $db->prepare('DELETE FROM policies WHERE id = ?')->execute([$id]);
    json_ok(['success' => true]);
}

json_error("Method not allowed: {$method}", 405);