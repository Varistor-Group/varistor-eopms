<?php
/**
 * POST /api/send-credentials
 * Sends a welcome email with temp login credentials to a new employee.
 * Body: { name, email, employeeId, tempPassword }
 */

$body = request_body();
$name        = $body['name']        ?? '';
$email       = $body['email']       ?? '';
$employeeId  = $body['employeeId']  ?? '';
$tempPassword = $body['tempPassword'] ?? '';

if (!$name || !$email || !$employeeId || !$tempPassword) {
    json_error('Missing required fields');
}

try {
    $mail = make_mailer();
    $mail->addAddress($email, $name);
    $mail->Subject = 'Welcome to Varistor EOPMS — Your Login Credentials';
    $mail->Body = <<<HTML
<div style="font-family: Inter, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
  <div style="background: #84CC16; padding: 16px 24px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #000; margin: 0; font-size: 20px; font-weight: 700;">Varistor EOPMS</h1>
  </div>
  <div style="background: #ffffff; padding: 32px; border: 1px solid #D8DED2; border-radius: 0 0 8px 8px;">
    <h2 style="font-size: 18px; font-weight: 600; color: #111;">Welcome, {$name}!</h2>
    <p style="color: #444; line-height: 1.6;">Your account has been created on Varistor EOPMS. Here are your login credentials:</p>
    <div style="background: #f9fafb; border: 1px solid #D8DED2; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; color: #444;"><strong>Employee ID:</strong> {$employeeId}</p>
      <p style="margin: 0 0 8px 0; color: #444;"><strong>Email:</strong> {$email}</p>
      <p style="margin: 0; color: #444;"><strong>Temporary Password:</strong> {$tempPassword}</p>
    </div>
    <p style="color: #444; line-height: 1.6;">Please log in and change your password immediately.</p>
    <a href="{APP_URL}" style="display: inline-block; background: #84CC16; color: #000; font-weight: 600; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 8px;">Log In to EOPMS →</a>
    <p style="color: #888; font-size: 12px; margin-top: 32px;">If you did not expect this email, please contact HR immediately.</p>
  </div>
</div>
HTML;
    $mail->Body = str_replace('{APP_URL}', APP_URL, $mail->Body);
    $mail->send();
    json_ok(['success' => true]);
} catch (\Exception $e) {
    json_ok(['success' => false, 'error' => $e->getMessage()]);
}
