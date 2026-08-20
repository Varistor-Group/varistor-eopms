<?php
/**
 * GET /api/auth/me
 * Returns the currently authenticated user based on the Bearer token,
 * or 401 if not logged in / token invalid.
 */
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

$db = get_db();
$stmt = $db->prepare('SELECT id, full_name, personal_email, department, role, avatar_url, is_field_employee, date_of_birth FROM employees WHERE id = ? LIMIT 1');
$stmt->execute([$myId]);
$emp = $stmt->fetch();
if (!$emp) json_error('Employee not found.', 404);

json_ok([
    'success' => true,
    'user' => [
        'id' => $emp['id'],
        'name' => $emp['full_name'],
        'email' => $emp['personal_email'],
        'department' => $emp['department'] ?? '',
        'avatarUrl' => $emp['avatar_url'] ?? '',
        'role' => $emp['role'],
        'is_field_employee' => (bool)$emp['is_field_employee'],
        'dob' => $emp['date_of_birth'] ?? null,
    ],
]);