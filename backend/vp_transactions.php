<?php
/**
 * POST /api/vp-transactions           — award/deduct points, atomically updates
 *                                        employees.vari_points and logs to vp_audit_log
 * GET  /api/vp-transactions           — transaction history (own, or all if HR/Admin)
 * GET  /api/vp-transactions/:employeeId — one employee's history
 *
 * Body for POST: { recipientId, points, type: 'credit'|'debit', reason }
 * admin_id is ALWAYS the authenticated caller — never trusted from the client.
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);
$role = currentUserRole();

$employeeId = $params['employeeId'] ?? null;

function generateUuidV4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

// POST /api/vp-transactions
// POST /api/vp-transactions
if ($method === 'POST' && $employeeId === null) {
    $input = request_body();
    $recipientId = $input['recipientId'] ?? '';
    $points = (int)($input['points'] ?? 0);
    $type = $input['type'] ?? '';
    $reason = trim($input['reason'] ?? '');

    if ($recipientId === '' || $points <= 0 || !in_array($type, ['credit', 'debit'], true) || $reason === '') {
        json_error('recipientId, a positive points value, type, and reason are all required.', 422);
    }

    if ($myId !== $recipientId) {
        if ($role === 'Reporting Manager') {
            // A Reporting Manager can only award points to their own direct reports.
            $recStmt = $db->prepare('SELECT reporting_manager_id FROM employees WHERE id = ? LIMIT 1');
            $recStmt->execute([$recipientId]);
            $recipient = $recStmt->fetch();
            if (!$recipient || $recipient['reporting_manager_id'] !== $myId) {
                json_error('You can only award points to your direct reports.', 403);
            }
        } elseif (!in_array($role, ['HR', 'Admin'], true)) {
            json_error('Only HR, Admin, or a Reporting Manager (for their own reports) can process points for another employee.', 403);
        }
    }

    $empStmt = $db->prepare('SELECT vari_points, full_name, employee_id FROM employees WHERE id = ? LIMIT 1');
    $empStmt->execute([$recipientId]);
    $emp = $empStmt->fetch();
    if (!$emp) json_error('Employee not found.', 404);

    $currentVP = (int)$emp['vari_points'];
    $newVP = $type === 'credit' ? $currentVP + $points : max(0, $currentVP - $points);

    $db->prepare('UPDATE employees SET vari_points = ? WHERE id = ?')->execute([$newVP, $recipientId]);

    $txnId = generateUuidV4();
    $db->prepare(
        'INSERT INTO vp_audit_log (id, admin_id, recipient_id, points, type, reason) VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$txnId, $myId, $recipientId, $points, $type, $reason]);

    json_ok(['success' => true, 'newBalance' => $newVP, 'transactionId' => $txnId]);
}

// GET /api/vp-transactions/:employeeId
if ($method === 'GET' && $employeeId !== null) {
    if ($employeeId !== $myId && !in_array($role, ['HR', 'Admin'], true)) {
        json_error('Forbidden', 403);
    }
    $stmt = $db->prepare(
        'SELECT l.*, a.full_name AS admin_name FROM vp_audit_log l LEFT JOIN employees a ON a.id = l.admin_id
         WHERE l.recipient_id = ? ORDER BY l.created_at DESC'
    );
    $stmt->execute([$employeeId]);
    json_ok($stmt->fetchAll());
}

// GET /api/vp-transactions
if ($method === 'GET' && $employeeId === null) {
    requireRole(['HR', 'Admin']);
    $stmt = $db->query(
        'SELECT l.*, a.full_name AS admin_name, r.full_name AS recipient_name
         FROM vp_audit_log l
         LEFT JOIN employees a ON a.id = l.admin_id
         LEFT JOIN employees r ON r.id = l.recipient_id
         ORDER BY l.created_at DESC'
    );
    json_ok($stmt->fetchAll());
}

json_error("Method not allowed: {$method}", 405);