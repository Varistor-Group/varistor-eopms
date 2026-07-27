<?php
/**
 * POST /api/payroll/trigger-send
 * Manually triggers payslip dispatch, pulling the latest revision per
 * employee from the payroll_records MySQL table.
 */

requireRole(['HR', 'Admin']); // SECURITY FIX: was completely open before

$db = get_db();

// Get latest revision per employee (any status — matches old behavior,
// which didn't filter by draft/approved)
$records = $db->query(
    'SELECT pr.* FROM payroll_records pr
     INNER JOIN (
         SELECT employee_id, MAX(revision) AS max_rev
         FROM payroll_records
         GROUP BY employee_id
     ) latest ON pr.employee_id = latest.employee_id AND pr.revision = latest.max_rev'
)->fetchAll();

if (count($records) === 0) {
    json_ok(['success' => true, 'sent' => 0, 'failed' => [], 'skipped' => true]);
}

function get_days_in_month(string $monthLabel): int {
    $ts = strtotime('1 ' . $monthLabel);
    return $ts ? (int)date('t', $ts) : 30;
}

$slips = [];
foreach ($records as $rec) {
    $empStmt = $db->prepare('SELECT personal_email, status FROM employees WHERE id = ? LIMIT 1');
    $empStmt->execute([$rec['employee_id']]);
    $emp = $empStmt->fetch();

    if (!$emp || empty($emp['personal_email']) || $emp['status'] !== 'Active') continue;

    $c = $rec['components'] ? json_decode($rec['components'], true) : [];

    $slips[] = [
        'name'            => $rec['employee_name']  ?? '',
        'email'           => $emp['personal_email'],
        'employeeId'      => $rec['employee_id'],
        'department'      => $rec['department']    ?? '',
        'designation'     => $rec['designation']   ?? '',
        'month'           => $rec['month']         ?? date('M Y'),
        'monthlySalary'   => $rec['monthly_salary'] ?? $rec['ctc'] ?? 0,
        'ctc'             => $rec['ctc']           ?? $rec['monthly_salary'] ?? 0,
        'totalDays'       => $rec['total_days']    ?? get_days_in_month($rec['month'] ?? ''),
        'payDays'         => $rec['pay_days']      ?? get_days_in_month($rec['month'] ?? ''),
        'clBalance'       => $rec['cl_balance']    ?? 0,
        'pfUan'           => $rec['pf_uan']        ?? '—',
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
        'netPay'          => $rec['net_pay']        ?? 0,
        'finalPay'        => $rec['final_pay']      ?? 0,
        'deduction'       => $rec['deduction']      ?? 0,
        'additionHeads'   => $rec['addition_heads']  ? json_decode($rec['addition_heads'], true)  : [],
        'deductionHeads'  => $rec['deduction_heads'] ? json_decode($rec['deduction_heads'], true) : [],
        'additionValues'  => $rec['addition_values']  ? json_decode($rec['addition_values'], true)  : [],
        'deductionValues' => $rec['deduction_values'] ? json_decode($rec['deduction_values'], true) : [],
    ];
}

if (count($slips) === 0) {
    json_ok(['success' => true, 'sent' => 0, 'failed' => [], 'skipped' => true]);
}

// Reuse send-slips logic by including it — same pattern as before,
// but note payroll_send_slips.php now also calls requireRole() itself,
// which is redundant here but harmless (caller already passed the check).
$body = ['slips' => $slips];
ob_start();
require __DIR__ . '/payroll_send_slips.php';
$output = ob_get_clean();

// Update lastRun in payroll_settings
$stmt = $db->prepare('SELECT setting_value FROM payroll_settings WHERE setting_key = ? LIMIT 1');
$stmt->execute(['schedule']);
$row = $stmt->fetch();
$sched = $row ? json_decode($row['setting_value'], true) : [];
$sched['lastRun'] = date('c');
$db->prepare('INSERT INTO payroll_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)')
   ->execute(['schedule', json_encode($sched)]);

header('Content-Type: application/json; charset=utf-8');
echo $output;
exit;