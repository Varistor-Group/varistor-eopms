<?php
/**
 * GET /api/attendance-edits   — full audit trail of HR attendance overrides (HR/Admin)
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);
requireRole(['HR', 'Admin']);

if ($method !== 'GET') json_error("Method not allowed: {$method}", 405);

$stmt = $db->query(
    "SELECT e.*, emp.full_name AS employeeName, editor.full_name AS editorName
     FROM attendance_edits e
     LEFT JOIN employees emp ON emp.id = e.employee_id
     LEFT JOIN employees editor ON editor.id = e.editor_id
     ORDER BY e.edited_at DESC"
);
json_ok($stmt->fetchAll());