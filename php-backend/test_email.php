<?php
/**
 * GET /api/test-email
 * Sends a smoke-test email to the SMTP_FROM address.
 */

try {
    $mail = make_mailer();
    $mail->addAddress(SMTP_FROM, 'EOPMS Admin');
    $mail->Subject = 'EOPMS Email Test';
    $mail->Body    = '<p>SMTP is working correctly from PHP backend.</p>';
    $mail->send();
    json_ok(['success' => true, 'message' => 'Test email sent to ' . SMTP_FROM]);
} catch (\Exception $e) {
    json_ok(['success' => false, 'error' => $e->getMessage()]);
}
