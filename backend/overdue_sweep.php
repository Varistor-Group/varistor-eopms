<?php
/**
 * backend/overdue_sweep.php
 * GET /api/tasks/overdue-sweep?key=...
 *
 * Meant to be triggered periodically (e.g. once daily) by a cron job hitting
 * this URL — NOT by a logged-in user, so it does not use the normal
 * currentEmployeeId() session auth. Protected instead by a shared secret key.
 *
 * For every task whose due_date has passed, that isn't 'done', and hasn't
 * already been swept: emails the assignee, their real Reporting Manager (if
 * one is set), and every HR/Admin employee — then marks it as swept so it's
 * only ever notified once, not re-sent on every run.
 *
 * Example cron entry (runs daily at 9am server time):
 *   0 9 * * * curl -s "https://eopms.ytbhai.com/eopms-api/api/tasks/overdue-sweep?key=pillTsbzP-_Y-YoP1I_8lziR8QrzDYPFzICCP3RQauE" >/dev/null 2>&1
 */

// IMPORTANT: this key must match exactly what's used in the cron command
// above. It's the only thing standing between this endpoint and anyone on
// the internet triggering it.
const OVERDUE_SWEEP_KEY = 'pillTsbzP-_Y-YoP1I_8lziR8QrzDYPFzICCP3RQauE';

if (($_GET['key'] ?? '') !== OVERDUE_SWEEP_KEY) {
    json_error('Forbidden', 403);
}

$db = get_db();

$overdueTasks = $db->query(
    "SELECT * FROM tasks
     WHERE due_date < CURDATE()
       AND status NOT IN ('done')
       AND (is_overdue_swept = 0 OR is_overdue_swept IS NULL)"
)->fetchAll();

// HR/Admin recipients are the same for every task, so fetch once.
$hrAdminStmt = $db->query(
    "SELECT full_name, personal_email FROM employees
     WHERE role IN ('HR', 'Admin') AND personal_email IS NOT NULL AND personal_email != ''"
);
$hrAdminRecipients = $hrAdminStmt->fetchAll();

$empStmt = $db->prepare('SELECT full_name, personal_email, reporting_manager_id FROM employees WHERE id = ? LIMIT 1');
$mgrStmt = $db->prepare('SELECT full_name, personal_email FROM employees WHERE id = ? LIMIT 1');
$markSweptStmt = $db->prepare('UPDATE tasks SET is_overdue_swept = 1 WHERE id = ?');

function sendOverdueEmail(string $toEmail, string $toName, string $taskTitle, string $dueDate, string $assigneeName, bool $isAssignee): void {
    $heading = $isAssignee ? 'Your Task Is Overdue' : 'An Employee\'s Task Is Overdue';
    $intro = $isAssignee
        ? "Hi {$toName}, the following task assigned to you has passed its due date."
        : "Hi {$toName}, a task assigned to <strong>{$assigneeName}</strong> has passed its due date.";

    $html = <<<HTML
<div style="font-family: Inter, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
  <div style="background: #dc2626; padding: 16px 24px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 20px; font-weight: 700;">Varistor EOPMS</h1>
  </div>
  <div style="background: #ffffff; padding: 32px; border: 1px solid #D8DED2; border-radius: 0 0 8px 8px;">
    <h2 style="font-size: 18px; font-weight: 600; color: #111;">{$heading}</h2>
    <p style="color: #444; line-height: 1.6;">{$intro}</p>
    <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
      <tr style="background:#f9f9f9;">
        <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Task</td>
        <td style="padding:10px 12px; border:1px solid #eee;">{$taskTitle}</td>
      </tr>
      <tr>
        <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Due Date</td>
        <td style="padding:10px 12px; border:1px solid #eee; color:#dc2626; font-weight:600;">{$dueDate} (overdue)</td>
      </tr>
    </table>
    <div style="text-align: center; margin-top: 30px;">
      <a href="{APP_URL}" style="display: inline-block; background: #84CC16; color: #000; font-weight: 600; padding: 12px 24px; border-radius: 6px; text-decoration: none;">View in EOPMS →</a>
    </div>
  </div>
</div>
HTML;
    $html = str_replace('{APP_URL}', APP_URL, $html);

    $mail = make_mailer();
    $mail->addAddress($toEmail);
    $mail->Subject = "Overdue: {$taskTitle}";
    $mail->Body = $html;
    $mail->send();
}

$sweptCount = 0;
$emailsSent = 0;
$emailsFailed = 0;

foreach ($overdueTasks as $task) {
    $empStmt->execute([$task['assignee_id']]);
    $assignee = $empStmt->fetch();

    if ($assignee) {
        $recipients = [];

        if (!empty($assignee['personal_email'])) {
            $recipients[$assignee['personal_email']] = ['name' => $assignee['full_name'], 'isAssignee' => true];
        }

        if (!empty($assignee['reporting_manager_id'])) {
            $mgrStmt->execute([$assignee['reporting_manager_id']]);
            $manager = $mgrStmt->fetch();
            if ($manager && !empty($manager['personal_email'])) {
                $recipients[$manager['personal_email']] = ['name' => $manager['full_name'], 'isAssignee' => false];
            }
        }

        foreach ($hrAdminRecipients as $hr) {
            $recipients[$hr['personal_email']] = ['name' => $hr['full_name'], 'isAssignee' => false];
        }

        foreach ($recipients as $email => $info) {
            try {
                sendOverdueEmail($email, $info['name'], $task['title'], $task['due_date'], $assignee['full_name'], $info['isAssignee']);
                $emailsSent++;
            } catch (\Exception $e) {
                $emailsFailed++;
            }
        }
    }

    $markSweptStmt->execute([$task['id']]);
    $sweptCount++;
}

json_ok([
    'success' => true,
    'tasksSwept' => $sweptCount,
    'emailsSent' => $emailsSent,
    'emailsFailed' => $emailsFailed,
]);
