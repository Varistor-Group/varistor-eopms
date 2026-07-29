<?php
/**
 * GET /api/attendance-monthly-report/:month
 * Optional query param: ?employeeIds=id1,id2,id3
 * Aggregates present/late/leave/weekoff/holiday/halfday/absent/totalHrs/payableDays
 * per employee for a YYYY-MM month. Integrates approved leave requests and
 * remaining leave balance (leave with exhausted balance counts as Absent).
 * Fake-data generator removed — missing ledger rows on working days are
 * honestly Absent, matching the rest of this conversion.
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

$month = $params['month'] ?? null;
if ($method !== 'GET' || $month === null) json_error("Method not allowed: {$method}", 405);

$employeeIdsParam = $_GET['employeeIds'] ?? null;
$employeeIdsFilter = $employeeIdsParam ? explode(',', $employeeIdsParam) : null;

// ── Roster ──
$empSql = "SELECT id, full_name, department FROM employees WHERE status != 'Inactive'";
$empParams = [];
if ($employeeIdsFilter) {
    $placeholders = implode(',', array_fill(0, count($employeeIdsFilter), '?'));
    $empSql = "SELECT id, full_name, department FROM employees WHERE status != 'Inactive' AND id IN ($placeholders)";
    $empParams = $employeeIdsFilter;
}
$empStmt = $db->prepare($empSql);
$empStmt->execute($empParams);
$roster = $empStmt->fetchAll();

// ── Dates in month up to today ──
[$year, $mon] = explode('-', $month);
$daysInMonth = (int)date('t', strtotime("$month-01"));
$today = date('Y-m-d');
$dates = [];
for ($d = 1; $d <= $daysInMonth; $d++) {
    $date = sprintf('%s-%s-%02d', $year, $mon, $d);
    if ($date > $today) break;
    $dates[] = $date;
}

// ── Holidays ──
$holStmt = $db->prepare('SELECT date FROM holidays WHERE date >= ? AND date <= ?');
$holStmt->execute(["$month-01", "$month-31"]);
$holidaySet = array_flip(array_column($holStmt->fetchAll(), 'date'));

// ── Ledger entries for the month ──
$ledgerSql = 'SELECT * FROM attendance_ledger WHERE date >= ? AND date <= ?';
$ledgerParams = ["$month-01", "$month-31"];
if ($employeeIdsFilter) {
    $placeholders = implode(',', array_fill(0, count($employeeIdsFilter), '?'));
    $ledgerSql .= " AND employee_id IN ($placeholders)";
    $ledgerParams = array_merge($ledgerParams, $employeeIdsFilter);
}
$ledgerStmt = $db->prepare($ledgerSql);
$ledgerStmt->execute($ledgerParams);
$ledgerMap = [];
foreach ($ledgerStmt->fetchAll() as $row) {
    $ledgerMap["{$row['employee_id']}|{$row['date']}"] = $row;
}

// ── Approved leaves overlapping this month ──
$leaveStmt = $db->prepare(
    "SELECT employee_id, from_date, to_date FROM leave_requests WHERE status = 'Approved' AND from_date <= ? AND to_date >= ?"
);
$leaveStmt->execute(["$month-31", "$month-01"]);
$approvedLeaveSet = [];
foreach ($leaveStmt->fetchAll() as $row) {
    $start = max($row['from_date'], "$month-01");
    $end = min($row['to_date'], "$month-31");
    $cursor = strtotime($start);
    $endTs = strtotime($end);
    while ($cursor <= $endTs) {
        $approvedLeaveSet["{$row['employee_id']}|" . date('Y-m-d', $cursor)] = true;
        $cursor = strtotime('+1 day', $cursor);
    }
}

// ── Remaining leave balance per employee ──
$balStmt = $db->query('SELECT employee_id, total, used FROM employee_leave_balances');
$balanceMap = [];
foreach ($balStmt->fetchAll() as $row) {
    $remaining = max(0, (float)$row['total'] - (float)$row['used']);
    $balanceMap[$row['employee_id']] = ($balanceMap[$row['employee_id']] ?? 0) + $remaining;
}

// ── Build report rows ──
$result = [];
foreach ($roster as $emp) {
    $present = $late = $leaves = $weekOff = $holidays = $halfDay = $absent = 0;
    $totalHrs = 0.0;
    $dailyRecords = [];

    foreach ($dates as $date) {
        $ledgerRow = $ledgerMap["{$emp['id']}|$date"] ?? null;
        $isSunday = date('N', strtotime($date)) == 7;
        $isHoliday = isset($holidaySet[$date]);

        if ($ledgerRow) {
            $status = $ledgerRow['status'];
        } else {
            if ($isSunday) $status = 'W.O';
            elseif ($isHoliday) $status = 'Holiday';
            else $status = 'Absent';
        }

        $isWorking = $status !== 'W.O' && $status !== 'Holiday';
        if ($isWorking) {
            $hasApprovedLeave = isset($approvedLeaveSet["{$emp['id']}|$date"]);
            $remainingBalance = $balanceMap[$emp['id']] ?? 0;
            $hasPunchIn = $ledgerRow && !empty($ledgerRow['punch_in']);

            if ($hasApprovedLeave) {
                $status = $remainingBalance > 0 ? 'Leave' : 'Absent';
            } elseif (!$hasPunchIn && !in_array($status, ['Leave', 'Absent', 'Half-day'])) {
                $status = 'Absent';
            }
        }

        $workHours = $ledgerRow['work_hours'] ?? null;

        $dailyRecords[] = [
            'date' => $date,
            'punch_in' => $ledgerRow['punch_in'] ?? null,
            'punch_out' => $ledgerRow['punch_out'] ?? null,
            'work_hours' => $workHours,
            'status' => $status,
        ];

        switch ($status) {
            case 'Present': $present++; break;
            case 'Late': $late++; $present++; break;
            case 'Half-day': $halfDay++; break;
            case 'Holiday': $holidays++; break;
            case 'W.O': $weekOff++; break;
            case 'Leave': $leaves++; break;
            case 'Absent': $absent++; break;
        }
        if ($workHours) $totalHrs += (float)$workHours;
    }

    $workingDays = count($dates) - $weekOff - $holidays;
   $present = $late = $leaves = $weekOff = $holidays = $halfDay = $absent = 0;
$totalHrs = 0.0;
$payableDays = 0.0;
$dailyRecords = [];

// ... (date loop stays the same until the switch block) ...

switch ($status) {
    case 'Present':
        $present++;
        $payableDays += 1.0;
        break;
    case 'Late':
        $late++;
        $payableDays += ($workHours !== null && round((float)$workHours) >= 9) ? 1.0 : 0.5;
        break;
    case 'Half-day':
        $halfDay++;
        $payableDays += 0.5;
        break;
    case 'Holiday':
        $holidays++;
        break;
    case 'W.O':
        $weekOff++;
        break;
    case 'Leave':
        $leaves++;
        $payableDays += 1.0;
        break;
    case 'Absent':
        $absent++;
        break;
}
if ($workHours) $totalHrs += (float)$workHours;

    $result[] = [
        'employee_id' => $emp['id'],
        'employeeName' => $emp['full_name'],
        'department' => $emp['department'],
        'present' => $present,
        'late' => $late,
        'leaves' => $leaves,
        'weekOff' => $weekOff,
        'holidays' => $holidays,
        'halfDay' => $halfDay,
        'absent' => $absent,
        'totalHrs' => round($totalHrs, 1),
        'payableDays' => round($payableDays, 1),
        'workingDays' => $workingDays,
        'dailyRecords' => $dailyRecords,
    ];
}

json_ok($result);