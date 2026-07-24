<?php
/**
 * POST /api/auth/reset-password
 * Body: { "email": "..." }
 * Always returns success (prevents email enumeration), even if email not found.
 */
$input = request_body();
$email = trim($input['email'] ?? '');

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_error('Please enter a valid email address.', 422);
}

$db = get_db();
$stmt = $db->prepare('SELECT id, full_name FROM employees WHERE personal_email = ? LIMIT 1');
$stmt->execute([$email]);
$emp = $stmt->fetch();

if ($emp) {
    $newPassword = strtoupper(substr(bin2hex(random_bytes(4)), 0, 4)) . '@' . date('Y') . '!' . random_int(100, 999);
    $hash = password_hash($newPassword, PASSWORD_DEFAULT);
    $db->prepare('UPDATE employees SET password_hash = ? WHERE id = ?')->execute([$hash, $emp['id']]);

    try {
        $mail = make_mailer();
        $mail->addAddress($email, $emp['full_name']);
        $mail->Subject = 'Your Varistor EOPMS password has been reset';
        $mail->Body = "<p>Hi {$emp['full_name']},</p><p>Your new temporary password is: <strong>{$newPassword}</strong></p><p>Please log in and change it as soon as possible.</p>";
        $mail->send();
    } catch (\Exception $e) {
        // Log server-side but don't reveal to caller (avoid enumeration)
        error_log('[reset_password] mail failed: ' . $e->getMessage());
    }
}

// Always success — don't reveal whether the email exists
json_ok(['success' => true, 'message' => 'If an account exists with this email, a reset link has been sent.']);