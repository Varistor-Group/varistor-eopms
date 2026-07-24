<?php
/**
 * POST /api/auth/login
 * Body: { "email": "...", "password": "..." }
 */

$db = get_db();
$input = request_body();

$email = trim($input['email'] ?? '');
$password = $input['password'] ?? '';

if ($email === '' || $password === '') {
    json_error('Email and password are required.', 422);
}

$stmt = $db->prepare('SELECT id, full_name, personal_email, department, role, avatar_url, is_field_employee, password_hash, status FROM employees WHERE personal_email = ? LIMIT 1');
$stmt->execute([$email]);
$emp = $stmt->fetch();

if (!$emp || !$emp['password_hash'] || !password_verify($password, $emp['password_hash'])) {
    json_error('Invalid email or password.', 401);
}

if ($emp['status'] !== 'Active') {
    json_error('This account is inactive. Contact HR/Admin.', 403);
}

$token = bin2hex(random_bytes(32));
$expiresAt = date('Y-m-d H:i:s', time() + 60 * 60 * 24 * 7);

$db->prepare('INSERT INTO auth_sessions (token, employee_id, expires_at) VALUES (?, ?, ?)')
   ->execute([$token, $emp['id'], $expiresAt]);

json_ok([
    'success' => true,
    'token' => $token,
    'user' => [
        'id' => $emp['id'],
        'name' => $emp['full_name'],
        'email' => $emp['personal_email'],
        'department' => $emp['department'] ?? '',
        'avatarUrl' => $emp['avatar_url'] ?? '',
        'role' => $emp['role'],
        'is_field_employee' => (bool)$emp['is_field_employee'],
    ],
]);