<?php
/**
 * GET /api/employee-leave-balances              — all balances (HR/Admin only)
 * GET /api/employee-leave-balances/:employeeId   — one employee's balances (own, or HR/Admin)
 * PUT /api/employee-leave-balances/:employeeId   — upsert one balance row (HR/Admin only)
 *   Body: { leaveTypeName, total, used }
 *
 * SECURITY FIX: original Postgres RLS had zero restriction on ANY operation
 * (USING true on select/insert/update/delete) — locked to HR/Admin for
 * writes here; reads restricted to own-record-or-HR/Admin per decision.
 */

$db = get_db();
$employeeId = $params['employeeId'] ?? null;

if ($method === 'GET') {
    $myId = currentEmployeeId();
    if ($myId === null) json_error('Unauthorized', 401);
    $role = currentUserRole();

    if ($employeeId !== null) {
        if ($employeeId !== $myId && !in_array($role, ['HR', 'Admin'], true)) {
            json_error('Forbidden', 403);
        }
        $stmt = $db->prepare('SELECT * FROM employee_leave_balances WHERE employee_id = ?');
        $stmt->execute([$employeeId]);
        json_ok($stmt->fetchAll());
    }

    requireRole(['HR', 'Admin']);
    $rows = $db->query('SELECT * FROM employee_leave_balances')->fetchAll();
    json_ok($rows);
}

if ($method === 'PUT') {
    requireRole(['HR', 'Admin']);
    if (!$employeeId) json_error('Employee ID required.', 400);

    $input = request_body();
    $leaveTypeName = trim($input['leaveTypeName'] ?? '');
    if ($leaveTypeName === '') json_error('leaveTypeName is required.', 422);

    $total = (int)($input['total'] ?? 0);
    $used = (int)($input['used'] ?? 0);

    // Upsert: check if a row exists for this employee+leave type
    $find = $db->prepare('SELECT id FROM employee_leave_balances WHERE employee_id = ? AND leave_type_name = ? LIMIT 1');
    $find->execute([$employeeId, $leaveTypeName]);
    $existing = $find->fetch();

    if ($existing) {
        $db->prepare('UPDATE employee_leave_balances SET total = ?, used = ? WHERE id = ?')
           ->execute([$total, $used, $existing['id']]);
    } else {
        $id = bin2hex(random_bytes(16));
        $db->prepare('INSERT INTO employee_leave_balances (id, employee_id, leave_type_name, total, used) VALUES (?, ?, ?, ?, ?)')
           ->execute([$id, $employeeId, $leaveTypeName, $total, $used]);
    }

    json_ok(['success' => true]);
}

json_error("Method not allowed: {$method}", 405);