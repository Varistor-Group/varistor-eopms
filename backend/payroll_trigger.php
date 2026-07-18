<?php
/**
 * POST /api/payroll/trigger-send
 * Manually triggers payslip dispatch from db.json records.
 * Mirrors dispatchPayslips() + buildSlipsFromDb() from server.js.
 */

$db      = read_db();
$records = $db['payroll_records'] ?? [];
$empList = $db['employees']       ?? [];

if (count($records) === 0) {
    json_ok(['success' => true, 'sent' => 0, 'failed' => [], 'skipped' => true]);
}

// Keep only latest revision per employee
$latestMap = [];
foreach ($records as $rec) {
    $empId    = $rec['employeeId'] ?? '';
    $existing = $latestMap[$empId] ?? null;
    if (!$existing || ($rec['revision'] ?? 0) > ($existing['revision'] ?? 0)) {
        $latestMap[$empId] = $rec;
    }
}

function get_days_in_month(string $monthLabel): int {
    $ts = strtotime('1 ' . $monthLabel);
    return $ts ? (int)date('t', $ts) : 30;
}

$slips = [];
foreach ($latestMap as $rec) {
    $empId = $rec['employeeId'] ?? '';
    $emp   = null;
    foreach ($empList as $e) {
        if ($e['employeeId'] === $empId) { $emp = $e; break; }
    }
    if (!$emp || empty($emp['personalEmail']) || ($emp['status'] ?? '') !== 'Active') continue;

    $c = $rec['components'] ?? [];
    $slips[] = [
        'name'            => $rec['employeeName']  ?? '',
        'email'           => $emp['personalEmail'],
        'employeeId'      => $empId,
        'department'      => $rec['department']    ?? '',
        'designation'     => $rec['designation']   ?? '',
        'month'           => $rec['month']         ?? date('M Y'),
        'monthlySalary'   => $rec['monthlySalary'] ?? $rec['ctc'] ?? 0,
        'ctc'             => $rec['ctc']           ?? $rec['monthlySalary'] ?? 0,
        'totalDays'       => $rec['totalDays']     ?? get_days_in_month($rec['month'] ?? ''),
        'payDays'         => $rec['payDays']       ?? get_days_in_month($rec['month'] ?? ''),
        'clBalance'       => $rec['clBalance']     ?? 0,
        'pfUan'           => $rec['pfUan']         ?? '—',
        'basic'           => $c['basic']           ?? 0,
        'hra'             => $c['hra']             ?? 0,
        'medical'         => $c['medical']         ?? 0,
        'ta'              => $c['ta']              ?? 0,
        'lta'             => $c['lta']             ?? 0,
        'specialAllowance'=> $c['specialAllowance']?? 0,
        'pfEmployee'      => $c['pfEmployee']      ?? 0,
        'pfEmployer'      => $c['pfEmployer']      ?? 0,
        'esi'             => $c['esi']             ?? 0,
        'pt'              => $c['pt']              ?? 0,
        'tds'             => $c['tds']             ?? 0,
        'reimbursement'   => $c['reimbursement']   ?? 0,
        'incentives'      => $c['incentives']      ?? 0,
        'overtime'        => $c['overtime']        ?? 0,
        'otherDeductions' => $c['otherDeductions'] ?? 0,
        'deductions'      => ($c['pfEmployee'] ?? 0) + ($c['esi'] ?? 0) + ($c['pt'] ?? 0) + ($c['tds'] ?? 0) + ($c['otherDeductions'] ?? 0),
        'netPay'          => $rec['netPay']        ?? 0,
        'finalPay'        => $rec['finalPay']      ?? 0,
        'deduction'       => $rec['deduction']     ?? 0,
        'additionHeads'   => $rec['additionHeads'] ?? [],
        'deductionHeads'  => $rec['deductionHeads']?? [],
        'additionValues'  => $rec['additionValues']?? [],
        'deductionValues' => $rec['deductionValues']?? [],
    ];
}

if (count($slips) === 0) {
    json_ok(['success' => true, 'sent' => 0, 'failed' => [], 'skipped' => true]);
}

// Reuse send-slips logic by including it (body is already available via $slips variable)
// We temporarily override $body to simulate a POST to send-slips
$body = ['slips' => $slips];
ob_start();
require __DIR__ . '/payroll_send_slips.php';
$output = ob_get_clean();

// Update lastRun
$db2 = read_db();
if (!isset($db2['payroll_schedule'])) $db2['payroll_schedule'] = [];
$db2['payroll_schedule']['lastRun'] = date('c');
write_db($db2);

// Forward the send-slips response
header('Content-Type: application/json; charset=utf-8');
echo $output;
exit;
