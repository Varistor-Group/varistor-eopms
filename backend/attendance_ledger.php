<?php
/**
 * GET /api/attendance-ledger/date/:date              — all employees' attendance for one date
 * GET /api/attendance-ledger/employee/:employeeId/:month  — one employee's attendance for a month (YYYY-MM)
 * PUT /api/attendance-ledger/:id                      — HR/Admin edit (creates row if none exists yet)
 *
 * Missing records are reported honestly (no ledger row = employee absent /
 * no record for that date) — the old fake-data generator is gone entirely.
 * Every edit now actually writes to attendance_edits (the original code's
 * own comment said it should, but never did).
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

$date = $params['date'] ?? null;
$employeeId = $params['employeeId'] ?? null;
$month = $params['month'] ?? null;
$id = $params['id'] ?? null;

function generateUuidV4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function calcWorkHours($punchIn, $punchOut) {
    if (!$punchIn || !$punchOut) return null;
    $diff = (strtotime($punchOut) - strtotime($punchIn)) / 3600;
    return round($diff, 2);
}

// GET /api/attendance-ledger/date/:date
if ($method === 'GET' && $date !== null) {
    $empStmt = $db->query("SELECT id, full_name, department FROM employees WHERE status != 'Inactive'");
    $roster = $empStmt->fetchAll();

    $ledgerStmt = $db->prepare('SELECT * FROM attendance_ledger WHERE date = ?');
    $ledgerStmt->execute([$date]);
    $ledgerRows = $ledgerStmt->fetchAll();
    $ledgerMap = [];
    foreach ($ledgerRows as $row) $ledgerMap[$row['employee_id']] = $row;

    $holCheckStmt = $db->prepare('SELECT id FROM holidays WHERE date = ? LIMIT 1');
    $holCheckStmt->execute([$date]);
    $isHoliday = (bool)$holCheckStmt->fetch();
    $isSunday = date('N', strtotime($date)) == 7;

    $fallbackStatus = 'Absent';
    if ($isSunday) $fallbackStatus = 'W.O';
    elseif ($isHoliday) $fallbackStatus = 'Holiday';

    $result = array_map(function ($emp) use ($ledgerMap, $date, $fallbackStatus) {
        $row = $ledgerMap[$emp['id']] ?? null;
        if ($row) {
            return array_merge($row, [
                'employeeName' => $emp['full_name'],
                'department' => $emp['department'],
            ]);
        }
        return [
            'id' => null,
            'employee_id' => $emp['id'],
            'employeeName' => $emp['full_name'],
            'department' => $emp['department'],
            'date' => $date,
            'punch_in' => null,
            'punch_out' => null,
            'work_hours' => null,
            'status' => $fallbackStatus,
            'source' => 'none',
            'confidence' => null,
            'photo_url' => null,
            'is_field_employee' => false,
            'created_at' => null,
        ];
    }, $roster);

    json_ok($result);
}

// GET /api/attendance-ledger/employee/:employeeId/:month
if ($method === 'GET' && $employeeId !== null && $month !== null) {
    $stmt = $db->prepare(
        'SELECT * FROM attendance_ledger WHERE employee_id = ? AND date >= ? AND date <= ? ORDER BY date ASC'
    );
    $stmt->execute([$employeeId, "$month-01", "$month-31"]);
    $rows = $stmt->fetchAll();

    $empStmt = $db->prepare('SELECT full_name, department FROM employees WHERE id = ? LIMIT 1');
    $empStmt->execute([$employeeId]);
    $emp = $empStmt->fetch();

    json_ok(array_map(fn($row) => array_merge($row, [
        'employeeName' => $emp['full_name'] ?? 'Unknown',
        'department' => $emp['department'] ?? 'Unknown',
    ]), $rows));
}

// PUT /api/attendance-ledger/:id
// :id can be a real ledger UUID, OR "new:{employeeId}:{date}" for a date
// with no existing row (frontend must send this sentinel format instead of
// the old "atl-{empId}-{date}" fake-generator ID scheme).
if ($method === 'PUT' && $id !== null) {
    requireRole(['HR', 'Admin']);
    $input = request_body();
    $reason = trim($input['reason'] ?? '');
    if ($reason === '') json_error('Reason is required for attendance edits.', 422);

    $newPunchIn = $input['punch_in'] ?? null;
    $newPunchOut = $input['punch_out'] ?? null;
    $newStatus = $input['status'] ?? null;

    if (str_starts_with($id, 'new:')) {
        [, $employeeId, $date] = explode(':', $id, 3);

        $empStmt = $db->prepare('SELECT is_field_employee FROM employees WHERE id = ? LIMIT 1');
        $empStmt->execute([$employeeId]);
        $emp = $empStmt->fetch();

        $workHours = calcWorkHours($newPunchIn, $newPunchOut);
        $newId = generateUuidV4();

        $db->prepare(
            'INSERT INTO attendance_ledger
             (id, employee_id, date, punch_in, punch_out, work_hours, status, source, override_reason, editor_id, edited_at, is_field_employee)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)'
        )->execute([
            $newId, $employeeId, $date, $newPunchIn, $newPunchOut, $workHours,
            $newStatus ?? 'Present', 'hr_override', $reason, $myId,
            (int)($emp['is_field_employee'] ?? 0),
        ]);

        // Audit row: old_* fields are null since there was no prior record.
        $db->prepare(
            'INSERT INTO attendance_edits
             (id, ledger_id, employee_id, editor_id, old_status, new_punch_in, new_punch_out, new_status, reason)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([generateUuidV4(), $newId, $employeeId, $myId, 'Absent', $newPunchIn, $newPunchOut, $newStatus ?? 'Present', $reason]);

        json_ok(['success' => true]);
    }

    // Existing ledger row
    $find = $db->prepare('SELECT * FROM attendance_ledger WHERE id = ? LIMIT 1');
    $find->execute([$id]);
    $existing = $find->fetch();
    if (!$existing) json_error('Attendance record not found.', 404);

    $finalPunchIn = $newPunchIn ?? $existing['punch_in'];
    $finalPunchOut = $newPunchOut ?? $existing['punch_out'];
    $finalStatus = $newStatus ?? $existing['status'];
    $workHours = calcWorkHours($finalPunchIn, $finalPunchOut);

    $db->prepare(
        'UPDATE attendance_ledger
         SET punch_in = ?, punch_out = ?, work_hours = ?, status = ?, source = ?, override_reason = ?, editor_id = ?, edited_at = NOW()
         WHERE id = ?'
    )->execute([$finalPunchIn, $finalPunchOut, $workHours, $finalStatus, 'hr_override', $reason, $myId, $id]);

    $db->prepare(
        'INSERT INTO attendance_edits
         (id, ledger_id, employee_id, editor_id, old_punch_in, old_punch_out, old_status, new_punch_in, new_punch_out, new_status, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        generateUuidV4(), $id, $existing['employee_id'], $myId,
        $existing['punch_in'], $existing['punch_out'], $existing['status'],
        $finalPunchIn, $finalPunchOut, $finalStatus, $reason,
    ]);

    json_ok(['success' => true]);
}

json_error("Method not allowed: {$method}", 405);