<?php
/**
 * GET  /api/attendance/field-photos/pending   — all pending field photo verifications (HR/Admin)
 * POST /api/attendance/field-photos/verify    — verify or reject one (HR/Admin)
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

// GET /api/attendance/field-photos/pending
if ($method === 'GET') {
    requireRole(['HR', 'Admin']);
    $stmt = $db->query(
        "SELECT p.*, e.full_name AS employeeName, e.department
         FROM field_attendance_photos p
         JOIN employees e ON e.id = p.employee_id
         WHERE p.verification_status = 'Pending'
         ORDER BY p.uploaded_at ASC"
    );
    json_ok($stmt->fetchAll());
}

// POST /api/attendance/field-photos/verify
if ($method === 'POST') {
    requireRole(['HR', 'Admin']);
    $input = request_body();
    $photoId = $input['photoId'] ?? '';
    $status = $input['status'] ?? '';
    if ($photoId === '' || !in_array($status, ['Verified', 'Rejected'], true)) {
        json_error('Invalid input.', 422);
    }

    $find = $db->prepare('SELECT * FROM field_attendance_photos WHERE id = ? LIMIT 1');
    $find->execute([$photoId]);
    $photo = $find->fetch();
    if (!$photo) json_error('Photo record not found.', 404);

    $db->prepare(
        'UPDATE field_attendance_photos SET verification_status = ?, verified_by = ?, verified_at = NOW() WHERE id = ?'
    )->execute([$status, $myId, $photoId]);

    if ($status === 'Rejected') {
        $ledgerStmt = $db->prepare('SELECT id FROM attendance_ledger WHERE employee_id = ? AND date = ? LIMIT 1');
        $ledgerStmt->execute([$photo['employee_id'], $photo['date']]);
        $ledger = $ledgerStmt->fetch();

        if ($ledger) {
            $db->prepare(
                'UPDATE attendance_ledger SET status = ?, override_reason = ?, editor_id = ?, edited_at = NOW() WHERE id = ?'
            )->execute(['Absent', 'Field photo rejected by HR', $myId, $ledger['id']]);
        }
    }

    json_ok(['success' => true]);
}

json_error("Method not allowed: {$method}", 405);