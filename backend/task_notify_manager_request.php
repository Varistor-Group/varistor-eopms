<?php
/**
 * POST /api/tasks/notify-manager-request
 * Sends a "task request awaiting your review" email to the employee's manager.
 * Body: { employeeName, managerEmail, taskTitle, description, dueDate, priority, notes }
 */

$body         = request_body();
$empName      = $body['employeeName'] ?? '';
$managerEmail = $body['managerEmail'] ?? '';
$taskTitle    = $body['taskTitle']    ?? '';
$description  = $body['description']  ?? '—';
$dueDate      = $body['dueDate']      ?? '';
$priority     = $body['priority']     ?? '';
$notes        = $body['notes']        ?? '';

if (!$empName || !$managerEmail || !$taskTitle || !$dueDate) {
    json_error('Missing required fields');
}

$notesRow = $notes
    ? "<tr style=\"background:#f9f9f9;\"><td style=\"padding:10px 12px; font-weight:600; border:1px solid #eee;\">Notes</td><td style=\"padding:10px 12px; border:1px solid #eee;\">{$notes}</td></tr>"
    : '';

$html = <<<HTML
<div style="font-family: Inter, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
  <div style="background: #84CC16; padding: 16px 24px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #000; margin: 0; font-size: 20px; font-weight: 700;">Varistor EOPMS</h1>
  </div>
  <div style="background: #ffffff; padding: 32px; border: 1px solid #D8DED2; border-radius: 0 0 8px 8px;">
    <h2 style="font-size: 18px; font-weight: 600; color: #111;">New Task Request Awaiting Your Review</h2>
    <p style="color: #444; line-height: 1.6;"><strong>{$empName}</strong> has requested a new task on <strong>Varistor EOPMS</strong>. Please review, edit if needed, and approve or reject.</p>
    <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
      <tr style="background:#f9f9f9;">
        <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Task</td>
        <td style="padding:10px 12px; border:1px solid #eee;">{$taskTitle}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Description</td>
        <td style="padding:10px 12px; border:1px solid #eee;">{$description}</td>
      </tr>
      <tr style="background:#f9f9f9;">
        <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Due Date</td>
        <td style="padding:10px 12px; border:1px solid #eee;">{$dueDate}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Priority</td>
        <td style="padding:10px 12px; border:1px solid #eee; text-transform:capitalize;">{$priority}</td>
      </tr>
      {$notesRow}
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
    $mail->Subject = "Task Request: {$empName} – {$taskTitle}";
    $mail->Body    = $html;
    $mail->send();
    json_ok(['success' => true]);
} catch (\Exception $e) {
    json_error('Failed to send task request notification email: ' . $e->getMessage(), 500);
}
