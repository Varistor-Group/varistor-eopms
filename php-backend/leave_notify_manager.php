<?php
/**
 * POST /api/leave/notify-manager
 * Sends leave request notification email to reporting manager.
 * Body: { employeeName, leaveType, from, to, days, reason, managerEmail }
 */

$body         = request_body();
$empName      = $body['employeeName'] ?? '';
$leaveType    = $body['leaveType']    ?? '';
$from         = $body['from']         ?? '';
$to           = $body['to']           ?? '';
$days         = $body['days']         ?? '';
$reason       = $body['reason']       ?? '—';
$managerEmail = $body['managerEmail'] ?? '';

if (!$empName || !$leaveType || !$from || !$to || !$managerEmail) {
    json_error('Missing required fields');
}

$html = <<<HTML
<div style="font-family: Inter, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
  <div style="background: #84CC16; padding: 16px 24px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #000; margin: 0; font-size: 20px; font-weight: 700;">Varistor EOPMS</h1>
  </div>
  <div style="background: #ffffff; padding: 32px; border: 1px solid #D8DED2; border-radius: 0 0 8px 8px;">
    <h2 style="font-size: 18px; font-weight: 600; color: #111;">New Leave Request</h2>
    <p style="color: #444; line-height: 1.6;">A leave request is awaiting your review on <strong>Varistor EOPMS</strong>.</p>
    <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
      <tr style="background:#f9f9f9;">
        <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Employee</td>
        <td style="padding:10px 12px; border:1px solid #eee;">{$empName}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Type</td>
        <td style="padding:10px 12px; border:1px solid #eee;">{$leaveType}</td>
      </tr>
      <tr style="background:#f9f9f9;">
        <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Dates</td>
        <td style="padding:10px 12px; border:1px solid #eee;">{$from} → {$to} ({$days} working day/s)</td>
      </tr>
      <tr>
        <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Reason</td>
        <td style="padding:10px 12px; border:1px solid #eee;">{$reason}</td>
      </tr>
    </table>
    <div style="text-align: center; margin-top: 30px;">
      <a href="{APP_URL}" style="display: inline-block; background: #84CC16; color: #000; font-weight: 600; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Review in EOPMS →</a>
    </div>
  </div>
</div>
HTML;

$html = str_replace('{APP_URL}', APP_URL, $html);

try {
    $mail = make_mailer();
    $mail->addAddress($managerEmail);
    $mail->Subject = "Leave Request: {$empName} – {$leaveType} ({$days} day/s)";
    $mail->Body    = $html;
    $mail->send();
    json_ok(['success' => true]);
} catch (\Exception $e) {
    json_error('Failed to send leave notification email: ' . $e->getMessage(), 500);
}
