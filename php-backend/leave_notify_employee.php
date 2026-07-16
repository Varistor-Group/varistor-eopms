<?php
/**
 * POST /api/leave/notify-employee
 * Sends leave status (approved/rejected) email to employee.
 * Body: { employeeEmail, employeeName, leaveId, status, comment }
 */

$body          = request_body();
$employeeEmail = $body['employeeEmail'] ?? '';
$employeeName  = $body['employeeName']  ?? '';
$leaveId       = $body['leaveId']       ?? '';
$status        = $body['status']        ?? '';
$comment       = $body['comment']       ?? '';

if (!$employeeEmail || !$leaveId || !$status) {
    json_error('Missing required fields');
}

$approved    = ($status === 'Approved');
$statusColor = $approved ? '#84CC16' : '#ef4444';
$statusLower = strtolower($status);

$commentHtml = '';
if (!$approved && $comment) {
    $commentHtml = <<<HTML
<p style="background:#fef2f2; border:1px solid #fecaca; padding:12px; border-radius:4px; font-size:13px;">
  <strong>Reviewer comment:</strong> {$comment}
</p>
HTML;
}

$html = <<<HTML
<div style="font-family: Inter, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
  <div style="background: {$statusColor}; padding: 16px 24px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #000; margin: 0; font-size: 20px; font-weight: 700;">Varistor EOPMS</h1>
  </div>
  <div style="background: #ffffff; padding: 32px; border: 1px solid #D8DED2; border-radius: 0 0 8px 8px;">
    <h2 style="font-size: 18px; font-weight: 600; color: #111;">Leave {$status}</h2>
    <p style="color: #444; line-height: 1.6;">Hi {$employeeName},</p>
    <p style="color: #444; line-height: 1.6;">Your leave request <strong>{$leaveId}</strong> has been
      <strong style="color:{$statusColor};">{$statusLower}</strong>.</p>
    {$commentHtml}
    <p style="color: #888; font-size: 12px; margin-top: 32px;">
      This is an automated message from Varistor EOPMS Leave Management.
    </p>
  </div>
</div>
HTML;

try {
    $mail = make_mailer();
    $mail->addAddress($employeeEmail, $employeeName);
    $mail->Subject = "Your Leave Request {$leaveId} has been {$status}";
    $mail->Body    = $html;
    $mail->send();
    json_ok(['success' => true]);
} catch (\Exception $e) {
    json_error('Failed to send leave status email: ' . $e->getMessage(), 500);
}
