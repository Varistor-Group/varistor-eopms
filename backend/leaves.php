<?php
/**
 * GET  /api/leaves       — list leave requests (own, or all if HR/Admin/Reporting Manager)
 * POST /api/leaves       — create a leave request (always for the calling employee)
 * PUT  /api/leaves/:id   — update status (HR/Admin/Reporting Manager only)
 *
 * MIGRATION NOTE: This handler previously read/wrote db.json exclusively and
 * never touched Supabase. It's rebuilt here against MySQL (leave_requests
 * table) rather than converted, since there was no prior Supabase version to
 * convert from. See rls_to_php_mapping.md for the leave_requests access rules
 * this implements.
 *
 * ASSUMPTION FLAGGED: field names below (type, from_date/to_date, reason)
 * are guessed from the old db.json shape. Please confirm against the actual
 * frontend request body (src/api/leaves.ts or similar) before wiring this up
 * — if the frontend sends different key names, only the request_body() reads
 * below need adjusting, not the SQL.
 */

$db = get_db();

if ($method === 'GET') {
    $myId = currentEmployeeId();
    if ($myId === null) json_error('Unauthorized', 401);
    $role = currentUserRole();

    if (in_array($role, ['HR', 'Admin', 'Reporting Manager'], true)) {
        $stmt = $db->query('SELECT * FROM leave_requests ORDER BY submitted_at DESC');
        $rows = $stmt->fetchAll();
    } else {
        $stmt = $db->prepare('SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY submitted_at DESC');
        $stmt->execute([$myId]);
        $rows = $stmt->fetchAll();
    }
    json_ok($rows);
}

if ($method === 'POST') {
    $myId = currentEmployeeId();
    if ($myId === null) json_error('Unauthorized', 401);

    // Look up the caller's own name/department rather than trusting the
    // request body for these — prevents applying for leave "as" someone else.
    $empStmt = $db->prepare('SELECT full_name, department FROM employees WHERE id = ? LIMIT 1');
    $empStmt->execute([$myId]);
    $emp = $empStmt->fetch();
    if (!$emp) json_error('Employee record not found.', 404);

    $input = request_body();
    $type      = $input['type'] ?? '';
    $fromDate  = $input['from_date'] ?? $input['startDate'] ?? '';
    $toDate    = $input['to_date']   ?? $input['endDate']   ?? '';
    $reason    = $input['reason'] ?? '';
    $days      = $input['days'] ?? null;

    if ($type === '' || $fromDate === '' || $toDate === '') {
        json_error('type, from_date, and to_date are required.', 422);
    }
    if ($days === null) {
        $days = (strtotime($toDate) - strtotime($fromDate)) / 86400 + 1;
    }

    $id = null; // let MySQL DEFAULT (UUID()) generate it
    $insert = $db->prepare(
        'INSERT INTO leave_requests (employee_id, employee_name, department, type, from_date, to_date, days, reason, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $insert->execute([$myId, $emp['full_name'], $emp['department'], $type, $fromDate, $toDate, $days, $reason, 'Pending']);
    $newId = $db->lastInsertId(); // note: not reliable for UUID PKs — see fetch-back below

    $fetch = $db->prepare('SELECT * FROM leave_requests WHERE employee_id = ? AND from_date = ? AND to_date = ? ORDER BY submitted_at DESC LIMIT 1');
    $fetch->execute([$myId, $fromDate, $toDate]);
    $newLeave = $fetch->fetch();

    $log = $db->prepare('INSERT INTO activity_log (action, performed_by, details) VALUES (?, ?, ?)');
    $log->execute([
        'APPLY_LEAVE',
        $myId,
        $emp['full_name'] . ' applied for ' . $type . ' from ' . $fromDate . ' to ' . $toDate,
    ]);

    json_ok(['success' => true, 'leave' => $newLeave]);
}

if ($method === 'PUT') {
    requireRole(['HR', 'Admin', 'Reporting Manager']);
    $myId = currentEmployeeId();

    $id   = $params['id'] ?? '';
    $body = request_body();
    $status = $body['status'] ?? '';
    if ($status === '') json_error('status is required.', 422);

    $find = $db->prepare('SELECT * FROM leave_requests WHERE id = ? LIMIT 1');
    $find->execute([$id]);
    $leave = $find->fetch();
    if (!$leave) json_error('Leave request not found.', 404);

    $reviewerStmt = $db->prepare('SELECT full_name FROM employees WHERE id = ? LIMIT 1');
    $reviewerStmt->execute([$myId]);
    $reviewer = $reviewerStmt->fetch();

    $rejectionComment = $body['comment'] ?? $body['rejection_comment'] ?? '';

    $update = $db->prepare(
        'UPDATE leave_requests
         SET status = ?, reviewer_id = ?, reviewer_name = ?, rejection_comment = ?, reviewed_at = NOW()
         WHERE id = ?'
    );
    $update->execute([$status, $myId, $reviewer['full_name'] ?? '', $rejectionComment, $id]);

    $log = $db->prepare('INSERT INTO activity_log (action, performed_by, details) VALUES (?, ?, ?)');
    $log->execute([
        'LEAVE_' . strtoupper($status),
        $myId,
        $status . ' leave request for ' . $leave['employee_name'],
    ]);

    $updated = $find; // re-fetch to return current state
    $updated->execute([$id]);
    json_ok(['success' => true, 'leave' => $updated->fetch()]);
}

json_error("Method not allowed: {$method}", 405);