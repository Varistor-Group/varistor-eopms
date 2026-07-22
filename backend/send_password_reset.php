<?php
/**
 * POST /api/send-password-reset
 * Uses Supabase Admin REST API to generate a recovery link, then emails it.
 * Body: { email }
 */

$body  = request_body();
$email = trim($body['email'] ?? '');

if (!$email) {
    json_error('Email is required');
}

// ── Generate Supabase recovery link ──────────────────────────────────────────
$resetRedirect = APP_URL . '/reset-password';

$supaResponse = supabase_admin_post('/auth/v1/admin/generate_link', [
    'type'        => 'recovery',
    'email'       => $email,
    'redirect_to' => $resetRedirect,
]);

if (($supaResponse['__http_code'] ?? 0) >= 400) {
    $errMsg = $supaResponse['message'] ?? $supaResponse['error_description'] ?? 'Could not generate reset link.';
    json_error($errMsg, 400);
}

$resetLink = $supaResponse['properties']['action_link'] ?? null;
if (!$resetLink) {
    json_error('Reset link generation failed — no link returned.', 500);
}

// ── Send email ────────────────────────────────────────────────────────────────
try {
    $mail = make_mailer();
    $mail->addAddress($email);
    $mail->Subject = 'Varistor EOPMS — Password Reset Request';
    $mail->Body = <<<HTML
<div style="font-family: Inter, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
  <div style="background: #84CC16; padding: 16px 24px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #000; margin: 0; font-size: 20px; font-weight: 700;">Varistor EOPMS</h1>
  </div>
  <div style="background: #ffffff; padding: 32px; border: 1px solid #D8DED2; border-radius: 0 0 8px 8px;">
    <h2 style="font-size: 18px; font-weight: 600; color: #111;">Password Reset Requested</h2>
    <p style="color: #444; line-height: 1.6;">We received a request to reset the password for your Varistor EOPMS account.</p>
    <a href="{RESET_LINK}" style="display: inline-block; background: #84CC16; color: #000; font-weight: 600; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 8px;">Reset My Password →</a>
    <p style="color: #444; line-height: 1.6; margin-top: 24px;">If you did not request this, please ignore this email. Your password will not be changed.</p>
    <p style="color: #888; font-size: 12px; margin-top: 32px;">This link expires in 1 hour.</p>
  </div>
</div>
HTML;
    $mail->Body = str_replace('{RESET_LINK}', htmlspecialchars($resetLink), $mail->Body);
    $mail->send();
    json_ok(['success' => true]);
} catch (\Exception $e) {
    json_ok(['success' => false, 'error' => $e->getMessage()]);
}
