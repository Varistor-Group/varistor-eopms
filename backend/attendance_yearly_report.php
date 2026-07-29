<?php
/**
 * GET /api/attendance-yearly-report/:year/:employeeId
 * Full year, day-by-day, for one employee's attendance calendar view.
 * Reuses the same status-resolution logic as attendance_monthly_report.php
 * (real ledger status, Sunday/Holiday fallback, approved-leave + balance
 * depletion), applied across all 12 months instead of one.
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

$year = $params['year'] ?? null;
$employeeId = $params['employeeId'] ?? null;
if ($method !== 'GET' || $year === null || $employeeId === null) json_error("Method not allowed: {$method}", 405);

$empStmt = $db->prepare('SELECT id, full_name, department FROM employees WHERE id = ? LIMIT 1');
$empStmt->execute([$employeeId]);
$emp = $empStmt->fetch();
if (!$emp) json_error('Employee not found.', 404);

$today = date('Y-m-d');

// ── Ledger for the whole year ──
$ledgerStmt = $db->prepare('SELECT * FROM attendance_ledger WHERE employee_id = ? AND date >= ? AND date <= ?');
$ledgerStmt->execute([$employeeId, "$year-01-01", "$year-12-31"]);
$ledgerMap = [];
foreach ($ledgerStmt->fetchAll() as $row) $ledgerMap[$row['date']] = $row;

// ── Holidays for the year ──
$holStmt = $db->prepare('SELECT date FROM holidays WHERE date LIKE ?');
$holStmt->execute(["$year-%"]);
$holidaySet = array_flip(array_column($holStmt->fetchAll(), 'date'));

// ── Approved leave days for the year ──
$leaveStmt = $db->prepare(
    "SELECT from_date, to_date FROM leave_requests WHERE employee_id = ? AND status = 'Approved' AND from_date <= ? AND to_date >= ?"
);
$leaveStmt->execute([$employeeId, "$year-12-31", "$year-01-01"]);
$approvedLeaveSet = [];
foreach ($leaveStmt->fetchAll() as $row) {
    $start = max($row['from_date'], "$year-01-01");
    $end = min($row['to_date'], "$year-12-31");
    $cursor = strtotime($start);
    $endTs = strtotime($end);
    while ($cursor <= $endTs) {
        $approvedLeaveSet[date('Y-m-d', $cursor)] = true;
        $cursor = strtotime('+1 day', $cursor);
    }
}

// ── Remaining leave balance for this employee ──
$balStmt = $db->prepare('SELECT total, used FROM employee_leave_balances WHERE employee_id = ?');
$balStmt->execute([$employeeId]);
$remainingBalance = 0.0;
$totalBalance = 0.0;
foreach ($balStmt->fetchAll() as $row) {
    $remaining = max(0, (float)$row['total'] - (float)$row['used']);
    $remainingBalance += $remaining;
    $totalBalance += (float)$row['total'];
}

$MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
$months = [];
$totals = ['present' => 0, 'paidLeave' => 0, 'unpaidLeave' => 0, 'absent' => 0, 'holidays' => 0, 'weekOff' => 0, 'halfDay' => 0, 'totalLeaveBalance' => $totalBalance, 'usedLeaveBalance' => 0];

for ($m = 0; $m < 12; $m++) {
    $monthNum = $m + 1;
    $daysInMonth = (int)date('t', strtotime(sprintf('%s-%02d-01', $year, $monthNum)));
    $days = [];

    for ($d = 1; $d <= $daysInMonth; $d++) {
        $date = sprintf('%s-%02d-%02d', $year, $monthNum, $d);

        if ($date > $today) {
            $days[] = ['date' => $date, 'code' => '-', 'status' => 'Present', 'isLeavePaidOut' => false];
            continue;
        }

        $ledgerRow = $ledgerMap[$date] ?? null;
        $isSunday = date('N', strtotime($date)) == 7;
        $isHoliday = isset($holidaySet[$date]);

        $status = $ledgerRow ? $ledgerRow['status'] : ($isSunday ? 'W.O' : ($isHoliday ? 'Holiday' : 'Absent'));
        $isWorking = $status !== 'W.O' && $status !== 'Holiday';
        $wasUnpaidLeaveRequest = false;

        if ($isWorking) {
            $hasApprovedLeave = isset($approvedLeaveSet[$date]);
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

        $isLeavePaidOut = false;
        switch ($status) {
            case 'Present':
            case 'Late':
                $code = 'P';
                $totals['present']++;
                break;
            case 'Half-day':
                $code = 'HD';
                $totals['halfDay']++;
                break;
            case 'Holiday':
                $code = 'H';
                $totals['holidays']++;
                break;
            case 'W.O':
                $code = 'WO';
                $totals['weekOff']++;
                break;
            case 'Leave':
                $code = 'L';
                $isLeavePaidOut = true;
                $totals['paidLeave']++;
                break;
            case 'Absent':
                $code = 'A';
                if ($wasUnpaidLeaveRequest) $totals['unpaidLeave']++;
                else $totals['absent']++;
                break;
            default:
                $code = '-';
        }

        $days[] = ['date' => $date, 'code' => $code, 'status' => $status, 'isLeavePaidOut' => $isLeavePaidOut];
    }

    $months[] = ['month' => sprintf('%s-%02d', $year, $monthNum), 'monthLabel' => $MONTH_LABELS[$m], 'days' => $days];
}

$totals['usedLeaveBalance'] = $totalBalance - $remainingBalance;

json_ok([
    'employee_id' => $emp['id'],
    'employeeName' => $emp['full_name'],
    'department' => $emp['department'],
    'year' => $year,
    'months' => $months,
    'totals' => $totals,
]);