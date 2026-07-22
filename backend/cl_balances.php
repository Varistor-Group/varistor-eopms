<?php
/**
 * GET /api/cl-balances              — all employees' casual leave balances
 * GET /api/cl-balances/:id          — one employee's balance
 * PUT /api/cl-balances/:id          — set total / used (HR/Admin only)
 *
 * MIGRATION NOTE: previously read/wrote db.json exclusively (employee_cl_balances
 * key), never touched Supabase. Rebuilt here against the leave_balances table's
 * casual_total/casual_used columns — the default total of 12 in the old code
 * matches leave_balances.casual_total's schema default exactly, confirming this
 * endpoint always meant "casual leave," not the newer flexible leave_types system.
 *
 * SECURITY FIX: the original Postgres RLS on leave_balances had no write
 * restriction at all (flagged in rls_to_php_mapping.md). PUT below now
 * requires HR/Admin — confirm this matches intended behavior.
 */

$db    = get_db();
$empId = $params['id'] ?? null;

if ($method === 'GET') {
    $myId = currentEmployeeId();
    if ($myId === null) json_error('Unauthorized', 401);
    $role = currentUserRole();

    if ($empId !== null) {
        // own balance, or HR/Admin can view anyone's
        if ($empId !== $myId && !in_array($role, ['HR', 'Admin'], true)) {
            json_error('Forbidden', 403);
        }
        $stmt = $db->prepare('SELECT casual_total AS total, casual_used AS used FROM leave_balances WHERE employee_id = ? LIMIT 1');
        $stmt->execute([$empId]);
        $row = $stmt->fetch();
        json_ok($row ?: ['total' => 12, 'used' => 0]);
    }

    // listing all balances — HR/Admin only
    requireRole(['HR', 'Admin']);
    $stmt = $db->query('SELECT employee_id, casual_total AS total, casual_used AS used FROM leave_balances');
    $rows = $stmt->fetchAll();
    $byEmployee = [];
    foreach ($rows as $r) {
        $byEmployee[$r['employee_id']] = ['total' => (int)$r['total'], 'used' => (int)$r['used']];
    }
    json_ok($byEmployee);
}

if ($method === 'PUT') {
    requireRole(['HR', 'Admin']);
    if (!$empId) json_error('Employee ID required', 400);

    $body = request_body();

    $existingStmt = $db->prepare('SELECT casual_total, casual_used FROM leave_balances WHERE employee_id = ? LIMIT 1');
    $existingStmt->execute([$empId]);
    $existing = $existingStmt->fetch() ?: ['casual_total' => 12, 'casual_used' => 0];

    $newTotal = $existing['casual_total'];
    $newUsed  = $existing['casual_used'];

    if (isset($body['total'])) {
        $newTotal = (int)$body['total'];
        if ($newTotal < 0) json_error('Invalid total value.', 400);
    }
    if (isset($body['used'])) {
        $newUsed = (int)$body['used'];
        if ($newUsed < 0) json_error('Invalid used value.', 400);
    }

    $upsert = $db->prepare(
        'INSERT INTO leave_balances (employee_id, casual_total, casual_used)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE casual_total = VALUES(casual_total), casual_used = VALUES(casual_used)'
    );
    $upsert->execute([$empId, $newTotal, $newUsed]);

    json_ok(['success' => true, 'balance' => ['total' => $newTotal, 'used' => $newUsed]]);
}

json_error("Method not allowed: {$method}", 405);