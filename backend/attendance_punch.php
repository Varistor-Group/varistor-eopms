<?php
/**
 * POST /api/attendance/punch          — self-punch in/out for the logged-in employee (no photo/GPS)
 * GET  /api/attendance/punch/status   — today's punch status for the logged-in employee (drives button state)
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

function generateUuidV4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function notify_hr_punch(string $empId, string $action, string $time): void {
    $db = get_db();
    $empStmt = $db->prepare('SELECT full_name FROM employees WHERE id = ? LIMIT 1');
    $empStmt->execute([$empId]);
    $emp = $empStmt->fetch();
    $empName = $emp['full_name'] ?? $empId;

    $hrStmt = $db->query("SELECT personal_email FROM employees WHERE role IN ('HR','Admin') AND personal_email IS NOT NULL AND personal_email != ''");
    $hrEmails = $hrStmt->fetchAll(PDO::FETCH_COLUMN);
    if (empty($hrEmails)) return;

    $actionLabel = $action === 'in' ? 'Punched In' : 'Punched Out';
    $html = "<div style=\"font-family: Inter, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;\">"
        . "<div style=\"background: #84CC16; padding: 16px 24px; border-radius: 8px 8px 0 0;\"><h1 style=\"color:#000;margin:0;font-size:20px;font-weight:700;\">Varistor EOPMS</h1></div>"
        . "<div style=\"background:#fff;padding:32px;border:1px solid #D8DED2;border-radius:0 0 8px 8px;\">"
        . "<h2 style=\"font-size:18px;font-weight:600;color:#111;\">Attendance: {$actionLabel}</h2>"
        . "<p style=\"color:#444;line-height:1.6;\"><strong>{$empName}</strong> {$actionLabel} at {$time}.</p>"
        . "</div></div>";

    try {
        $mail = make_mailer();
        foreach ($hrEmails as $email) {
            $mail->addAddress($email);
        }
        $mail->Subject = "{$empName} {$actionLabel}";
        $mail->Body = $html;
        $mail->send();
    } catch (\Exception $e) {
        error_log('notify_hr_punch failed: ' . $e->getMessage());
    }
}

function calcWorkHours($punchIn, $punchOut) {
    if (!$punchIn || !$punchOut) return null;
    $diff = (strtotime($punchOut) - strtotime($punchIn)) / 3600;
    return round($diff, 2);
}

$today = date('Y-m-d');

// GET /api/attendance/punch/status
if ($method === 'GET') {
    $stmt = $db->prepare('SELECT id, punch_in, punch_out, status FROM attendance_ledger WHERE employee_id = ? AND date = ? LIMIT 1');
    $stmt->execute([$myId, $today]);
    $row = $stmt->fetch();
    json_ok([
        'punchedIn' => (bool)($row && $row['punch_in'] && !$row['punch_out']),
        'punchedOut' => (bool)($row && $row['punch_in'] && $row['punch_out']),
        'record' => $row ?: null,
    ]);
}

// POST /api/attendance/punch
if ($method === 'POST') {
    // Block punching on an approved leave day — leave is handled entirely
    // through the existing leave_requests approval flow.
    $leaveStmt = $db->prepare(
        "SELECT id FROM leave_requests WHERE employee_id = ? AND status = 'Approved' AND ? BETWEEN from_date AND to_date LIMIT 1"
    );
    $leaveStmt->execute([$myId, $today]);
    if ($leaveStmt->fetch()) {
        json_error('You are on approved leave today.', 422);
    }

    $find = $db->prepare('SELECT * FROM attendance_ledger WHERE employee_id = ? AND date = ? LIMIT 1');
    $find->execute([$myId, $today]);
    $existing = $find->fetch();
    $now = date('Y-m-d H:i:s');

    if (!$existing || !$existing['punch_in']) {
        // ── Punch IN ──
        $empStmt = $db->prepare('SELECT shift_start, is_field_employee FROM employees WHERE id = ? LIMIT 1');
        $empStmt->execute([$myId]);
        $emp = $empStmt->fetch();

        $status = 'Present';
        if (!empty($emp['shift_start'])) {
            $graceStmt = $db->query("SELECT `value` FROM attendance_settings WHERE `key` = 'grace_period_minutes' LIMIT 1");
            $graceRow = $graceStmt->fetch();
            $graceMinutes = $graceRow ? (int)$graceRow['value'] : 15;

            $deadline = strtotime("$today {$emp['shift_start']}") + $graceMinutes * 60;
            if (strtotime($now) > $deadline) {
                $status = 'Late';
            }
        }

        if ($existing) {
            $db->prepare('UPDATE attendance_ledger SET punch_in = ?, status = ?, source = ? WHERE id = ?')
               ->execute([$now, $status, 'self_punch', $existing['id']]);
        } else {
            $newId = generateUuidV4();
            $db->prepare(
                'INSERT INTO attendance_ledger (id, employee_id, date, punch_in, status, source, is_field_employee)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            )->execute([$newId, $myId, $today, $now, $status, 'self_punch', (int)($emp['is_field_employee'] ?? 0)]);
        }

        notify_hr_punch($myId, 'in', $now);
        json_ok(['success' => true, 'type' => 'in', 'time' => $now, 'status' => $status]);
    }

    if (!$existing['punch_out']) {
        // ── Punch OUT ──
        $workHours = calcWorkHours($existing['punch_in'], $now);
        $db->prepare('UPDATE attendance_ledger SET punch_out = ?, work_hours = ? WHERE id = ?')
           ->execute([$now, $workHours, $existing['id']]);
        notify_hr_punch($myId, 'out', $now);
        json_ok(['success' => true, 'type' => 'out', 'time' => $now, 'workHours' => $workHours]);
    }

    json_error('Already punched out for today.', 422);
}

json_error("Method not allowed: {$method}", 405);