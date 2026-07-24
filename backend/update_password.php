<?php
/**
 * POST /api/auth/update-password
 * Body: { "password": "..." }
 * Requires a valid Bearer token (Authorization header).
 */
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

$input = request_body();
$password = $input['password'] ?? '';
if (strlen($password) < 6) json_error('Password must be at least 6 characters.', 422);

$hash = password_hash($password, PASSWORD_DEFAULT);
$db = get_db();
$db->prepare('UPDATE employees SET password_hash = ? WHERE id = ?')->execute([$hash, $myId]);

json_ok(['success' => true]);