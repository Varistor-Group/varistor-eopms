<?php
/**
 * POST /api/tasks/notify-assignee
 * Sends a "you've been assigned a task" email to the employee.
 * Body: { assigneeName, assigneeEmail, taskTitle, description, dueDate, priority }
 */

$body          = request_body();
$assigneeName  = $body['assigneeName']  ?? '';
$assigneeEmail = $body['assigneeEmail'] ?? '';
$taskTitle     = $body['taskTitle']     ?? '';
$description   = $body['description']  ?? '—';
$dueDate       = $body['dueDate']       ?? '';
$priority      = $body['priority']      ?? '';

if (!$assigneeName || !$assigneeEmail || !$taskTitle || !$dueDate) {
    json_error('Missing required fields');
}

$html = <<<HTML
<div style="font-family: Inter, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
  <div style="background: #84CC16; padding: 16px 24px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #000; margin: 0; font-size: 20px; font-weight: 700;">Varistor EOPMS</h1>
  </div>
  <div style="background: #ffffff; padding: 32px; border: 1px solid #D8DED2; border-radius: 0 0 8px 8px;">
    <h2 style="font-size: 18px; font-weight: 600; color: #111;">New Task Assigned to You</h2>
    <p style="color: #444; line-height: 1.6;">Hi {$assigneeName}, a new task has been assigned to you on <strong>Varistor EOPMS</strong>.</p>
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
    </table>
    <div style="text-align: center; margin-top: 30px;">
      <a href="{APP_URL}" style="display: inline-block; background: #84CC16; color: #000; font-weight: 600; padding: 12px 24px; border-radius: 6px; text-decoration: none;">View Task in EOPMS →</a>
    </div>
  </div>
</div>
HTML;

$html = str_replace('{APP_URL}', APP_URL, $html);

try {
    $mail = make_mailer();
    $mail->addAddress($assigneeEmail);
    $mail->Subject = "New Task Assigned: {$taskTitle}";
    $mail->Body    = $html;
    $mail->send();
    json_ok(['success' => true]);
} catch (\Exception $e) {
    json_error('Failed to send task assignment email: ' . $e->getMessage(), 500);
}
