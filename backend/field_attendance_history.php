<?php
/**
 * GET /api/field-attendance-history   — all field photo records, most recent first (HR/Admin)
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);
requireRole(['HR', 'Admin']);

if ($method !== 'GET') json_error("Method not allowed: {$method}", 405);

$stmt = $db->query(
    "SELECT p.*, e.full_name AS employeeName, e.department
     FROM field_attendance_photos p
     JOIN employees e ON e.id = p.employee_id
     ORDER BY p.uploaded_at DESC"
);
json_ok($stmt->fetchAll());