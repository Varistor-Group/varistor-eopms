<?php
/**
 * GET /api/attendance-yearly-summary/:year   — HR/Admin overview, all employees
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);
requireRole(['HR', 'Admin']);

$year = $params['year'] ?? null;
if ($method !== 'GET' || $year === null) json_error("Method not allowed: {$method}", 405);

$today = date('Y-m-d');

$roster = $db->query("SELECT id, full_name, department FROM employees WHERE status != 'Inactive'")->fetchAll();

$ledgerStmt = $db->prepare('SELECT * FROM attendance_ledger WHERE date >= ? AND date <= ?');
$ledgerStmt->execute(["$year-01-01", "$year-12-31"]);
$ledgerMap = [];
foreach ($ledgerStmt->fetchAll() as $row) $ledgerMap["{$row['employee_id']}|{$row['date']}"] = $row;

$holStmt = $db->prepare('SELECT date FROM holidays WHERE date LIKE ?');
$holStmt->execute(["$year-%"]);
$holidaySet = array_flip(array_column($holStmt->fetchAll(), 'date'));

$leaveStmt = $db->prepare(
    "SELECT employee_id, from_date, to_date FROM leave_requests WHERE status = 'Approved' AND from_date <= ? AND to_date >= ?"
);
$leaveStmt->execute(["$year-12-31", "$year-01-01"]);
$approvedLeaveSet = [];
foreach ($leaveStmt->fetchAll() as $row) {
    $start = max($row['from_date'], "$year-01-01");
    $end = min($row['to_date'], "$year-12-31");
    $cursor = strtotime($start);
    $endTs = strtotime($end);
    while ($cursor <= $endTs) {
        $approvedLeaveSet["{$row['employee_id']}|" . date('Y-m-d', $cursor)] = true;
        $cursor = strtotime('+1 day', $cursor);
    }
}

$balStmt = $db->query('SELECT employee_id, total, used FROM employee_leave_balances');
$balanceMap = [];
foreach ($balStmt->fetchAll() as $row) {
    $remaining = max(0, (float)$row['total'] - (float)$row['used']);
    $balanceMap[$row['employee_id']] = ($balanceMap[$row['employee_id']] ?? 0) + $remaining;
}

$daysInYear = (date('L', strtotime("$year-01-01"))) ? 366 : 365;
$result = [];

foreach ($roster as $emp) {
    $present = $paidLeave = $unpaidLeave = $absent = $holidays = $weekOff = $halfDay = 0;
    $remainingBalance = $balanceMap[$emp['id']] ?? 0;

    for ($dayNum = 0; $dayNum < $daysInYear; $dayNum++) {
        $date = date('Y-m-d', strtotime("$year-01-01 +$dayNum days"));
        if ($date > $today) break;
        if (substr($date, 0, 4) !== $year) break;

        $ledgerRow = $ledgerMap["{$emp['id']}|$date"] ?? null;
        $isSunday = date('N', strtotime($date)) == 7;
        $isHoliday = isset($holidaySet[$date]);

        $status = $ledgerRow ? $ledgerRow['status'] : ($isSunday ? 'W.O' : ($isHoliday ? 'Holiday' : 'Absent'));
        $isWorking = $status !== 'W.O' && $status !== 'Holiday';
        $wasUnpaidLeaveRequest = false;

        if ($isWorking) {
            $hasApprovedLeave = isset($approvedLeaveSet["{$emp['id']}|$date"]);
            $hasPunchIn = $ledgerRow && !empty($ledgerRow['punch_in']);

            if ($hasApprovedLeave) {
                if ($remainingBalance > 0) {
                    $status = 'Leave';
                    $remainingBalance--;
                } else {
                    $status = 'Absent';
                    $wasUnpaidLeaveRequest = true;
                }
            } elseif (!$hasPunchIn && !in_array($status, ['Leave', 'Absent', 'Half-day'])) {
                $status = 'Absent';
            }
        }

        switch ($status) {
            case 'Present':
            case 'Late':
                $present++;
                break;
            case 'Half-day':
                $halfDay++;
                break;
            case 'Holiday':
                $holidays++;
                break;
            case 'W.O':
                $weekOff++;
                break;
            case 'Leave':
                $paidLeave++;
                break;
            case 'Absent':
                if ($wasUnpaidLeaveRequest) $unpaidLeave++;
                else $absent++;
                break;
        }
    }

    $result[] = [
        'employee_id' => $emp['id'],
        'employeeName' => $emp['full_name'],
        'department' => $emp['department'],
        'present' => $present,
        'paidLeave' => $paidLeave,
        'unpaidLeave' => $unpaidLeave,
        'absent' => $absent,
        'holidays' => $holidays,
        'weekOff' => $weekOff,
        'halfDay' => $halfDay,
    ];
}

json_ok($result);