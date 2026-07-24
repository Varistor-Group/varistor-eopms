<?php
/**
 * GET    /api/leave-types       — list all (any authenticated user)
 * POST   /api/leave-types       — create (HR/Admin only)
 * DELETE /api/leave-types/:id   — delete (HR/Admin only)
 *
 * SECURITY FIX: original Postgres RLS had zero write restriction
 * (USING true) — locked to HR/Admin here per decision.
 */

$db = get_db();

if ($method === 'GET') {
    if (currentEmployeeId() === null) json_error('Unauthorized', 401);
    $rows = $db->query('SELECT * FROM leave_types ORDER BY name')->fetchAll();
    json_ok($rows);
}

if ($method === 'POST') {
    requireRole(['HR', 'Admin']);
    $input = request_body();
    $name = trim($input['name'] ?? '');
    if ($name === '') json_error('Name is required.', 422);

    $id = bin2hex(random_bytes(16));
    $stmt = $db->prepare('INSERT INTO leave_types (id, name, description, default_allocation) VALUES (?, ?, ?, ?)');
    $stmt->execute([
        $id,
        $name,
        $input['description'] ?? null,
        (int)($input['default_allocation'] ?? 0),
    ]);

    $fetch = $db->prepare('SELECT * FROM leave_types WHERE id = ? LIMIT 1');
    $fetch->execute([$id]);
    json_ok(['success' => true, 'leaveType' => $fetch->fetch()]);
}

if ($method === 'DELETE') {
    requireRole(['HR', 'Admin']);
    $id = $params['id'] ?? '';
    $db->prepare('DELETE FROM leave_types WHERE id = ?')->execute([$id]);
    json_ok(['success' => true]);
}

json_error("Method not allowed: {$method}", 405);