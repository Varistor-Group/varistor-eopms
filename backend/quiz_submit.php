<?php
/**
 * POST /api/quiz/submit
 * Sends quiz result email to employee (and optionally HR).
 * Body: { employeeEmail, hrEmail, moduleTitle, score, passed }
 */

$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

$body          = request_body();
$employeeEmail = $body['employeeEmail'] ?? '';
$hrEmail       = $body['hrEmail']       ?? '';
$moduleTitle   = $body['moduleTitle']   ?? '';
$score         = $body['score']         ?? 0;
$passed        = (bool)($body['passed'] ?? false);

if (!$employeeEmail || !$moduleTitle) {
    json_error('Missing required fields');
}

$statusColor = $passed ? '#84CC16' : '#ef4444';
$statusLabel = $passed ? '✅ PASSED' : '❌ FAILED';
$nextLine    = $passed
    ? '<p style="color:#84CC16; font-size:13px;">The next module has been automatically unlocked.</p>'
    : '<p style="color:#ef4444; font-size:13px;">The employee may retry after a 24-hour cooldown.</p>';

$html = <<<HTML
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <div style="background-color: #84CC16; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: white; margin: 0;">Training Quiz Result</h1>
  </div>
  <div style="padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
    <p>A training quiz has been completed on <strong>Varistor EOPMS</strong>.</p>
    <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
      <tr style="background:#f9f9f9;">
        <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Module</td>
        <td style="padding:10px 12px; border:1px solid #eee;">{$moduleTitle}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Score</td>
        <td style="padding:10px 12px; border:1px solid #eee;"><strong style="color:{$statusColor};">{$score}%</strong></td>
      </tr>
      <tr style="background:#f9f9f9;">
        <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Result</td>
        <td style="padding:10px 12px; border:1px solid #eee;"><strong style="color:{$statusColor};">{$statusLabel}</strong></td>
      </tr>
      <tr>
        <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Passing score</td>
        <td style="padding:10px 12px; border:1px solid #eee;">70%</td>
      </tr>
    </table>
    {$nextLine}
    <p style="font-size:12px; color:#888; margin-top:24px;">This is an automated message from Varistor EOPMS Training.</p>
  </div>
</div>
HTML;

$subject = "Quiz Result: {$moduleTitle} — " . ($passed ? 'Passed' : 'Failed') . " ({$score}%)";

try {
    $mail = make_mailer();
    $mail->Subject = $subject;
    $mail->Body    = $html;
    $mail->addAddress($employeeEmail);
    if ($hrEmail) {
        $mail->addAddress($hrEmail);
    }
    $mail->send();
    json_ok(['success' => true]);
} catch (\Exception $e) {
    json_error('Failed to send quiz result email: ' . $e->getMessage(), 500);
}