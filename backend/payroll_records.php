<?php
/**
 * GET    /api/payroll-records                    — list all, or ?employeeId=X for one employee
 *         Access: HR/Admin see all; employee sees only their OWN approved records
 * POST   /api/payroll-records                     — bulk upsert (HR/Admin only), matched by
 *         employee_id + month + revision since id is DB-generated
 * PUT    /api/payroll-records/:id                 — partial update a single record (HR/Admin only)
 *         Locked once status='approved'
 * POST   /api/payroll-records/:id/approve         — approve (HR/Admin only)
 * POST   /api/payroll-records/:id/revision        — create a new draft revision from an approved record
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);
$role = currentUserRole();
$id = $params['id'] ?? null;
$action = $params['action'] ?? null;

function rowToPayrollRecord($row) {
    return [
        'id' => $row['id'],
        'employeeId' => $row['employee_id'],
        'employeeName' => $row['employee_name'],
        'department' => $row['department'],
        'designation' => $row['designation'],
        'month' => $row['month'],
        'ctc' => (float)$row['ctc'],
        'monthlySalary' => (float)$row['monthly_salary'],
        'netPay' => (float)$row['net_pay'],
        'finalPay' => (float)$row['final_pay'],
        'status' => $row['status'],
        'revision' => (int)$row['revision'],
        'approvedBy' => $row['approved_by'],
        'approvedAt' => $row['approved_at'],
        'autoFormula' => (bool)$row['auto_formula'],
        'totalDays' => (int)$row['total_days'],
        'payDays' => (float)$row['pay_days'],
        'clBalance' => (int)$row['cl_balance'],
        'pfUan' => $row['pf_uan'],
        'hasPf' => (bool)$row['has_pf'],
        'hasEsi' => (bool)$row['has_esi'],
        'hasPt' => (bool)$row['has_pt'],
        'slipReleased' => (bool)$row['slip_released'],
        'components' => $row['components'] ? json_decode($row['components'], true) : null,
        'additionHeads' => $row['addition_heads'] ? json_decode($row['addition_heads'], true) : [],
        'deductionHeads' => $row['deduction_heads'] ? json_decode($row['deduction_heads'], true) : [],
        'additionValues' => $row['addition_values'] ? json_decode($row['addition_values'], true) : [],
        'deductionValues' => $row['deduction_values'] ? json_decode($row['deduction_values'], true) : [],
        'attendanceBreakdown' => $row['attendance_breakdown'] ? json_decode($row['attendance_breakdown'], true) : null,
        'deduction' => $row['deduction'] !== null ? (int)$row['deduction'] : null,
        'lopDays' => $row['lop_days'] !== null ? (int)$row['lop_days'] : null,
        'lopDeduction' => $row['lop_deduction'] !== null ? (int)$row['lop_deduction'] : null,
    ];
}

function upsertRecord($db, $r) {
    $revision = $r['revision'] ?? 1;
    $find = $db->prepare('SELECT id, status FROM payroll_records WHERE employee_id = ? AND month = ? AND revision = ? LIMIT 1');
    $find->execute([$r['employeeId'], $r['month'], $revision]);
    $existing = $find->fetch();

    if ($existing && $existing['status'] === 'approved') {
        return $existing['id']; // locked — skip silently, matches old "Locked" behavior
    }

    $params = [
        $r['employeeId'], $r['employeeName'], $r['department'] ?? null, $r['designation'] ?? null, $r['month'],
        $r['ctc'] ?? 0, $r['monthlySalary'] ?? 0, $r['netPay'] ?? 0, $r['finalPay'] ?? 0,
        $r['status'] ?? 'draft', $revision, $r['approvedBy'] ?? null, $r['approvedAt'] ?? null,
        isset($r['autoFormula']) ? (int)$r['autoFormula'] : 1,
        $r['totalDays'] ?? 30, $r['payDays'] ?? 30, $r['clBalance'] ?? 12, $r['pfUan'] ?? null,
        isset($r['hasPf']) ? (int)$r['hasPf'] : 1,
        isset($r['hasEsi']) ? (int)$r['hasEsi'] : 1,
        isset($r['hasPt']) ? (int)$r['hasPt'] : 1,
        isset($r['slipReleased']) ? (int)$r['slipReleased'] : 0,
        json_encode($r['components'] ?? null),
        json_encode($r['additionHeads'] ?? []),
        json_encode($r['deductionHeads'] ?? []),
        json_encode($r['additionValues'] ?? []),
        json_encode($r['deductionValues'] ?? []),
        json_encode($r['attendanceBreakdown'] ?? null),
        $r['deduction'] ?? null, $r['lopDays'] ?? null, $r['lopDeduction'] ?? null,
    ];

    if ($existing) {
        $sql = 'UPDATE payroll_records SET employee_id=?, employee_name=?, department=?, designation=?, month=?, ctc=?, monthly_salary=?, net_pay=?, final_pay=?, status=?, revision=?, approved_by=?, approved_at=?, auto_formula=?, total_days=?, pay_days=?, cl_balance=?, pf_uan=?, has_pf=?, has_esi=?, has_pt=?, slip_released=?, components=?, addition_heads=?, deduction_heads=?, addition_values=?, deduction_values=?, attendance_breakdown=?, deduction=?, lop_days=?, lop_deduction=? WHERE id=?';
        $params[] = $existing['id'];
        $db->prepare($sql)->execute($params);
        return $existing['id'];
    } else {
        $newId = bin2hex(random_bytes(16));
        $sql = 'INSERT INTO payroll_records (employee_id, employee_name, department, designation, month, ctc, monthly_salary, net_pay, final_pay, status, revision, approved_by, approved_at, auto_formula, total_days, pay_days, cl_balance, pf_uan, has_pf, has_esi, has_pt, slip_released, components, addition_heads, deduction_heads, addition_values, deduction_values, attendance_breakdown, deduction, lop_days, lop_deduction, id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';
        $params[] = $newId;
        $db->prepare($sql)->execute($params);
        return $newId;
    }
}

if ($method === 'GET' && $id === null) {
    $employeeIdFilter = $_GET['employeeId'] ?? null;

    if (in_array($role, ['HR', 'Admin'], true)) {
        if ($employeeIdFilter) {
            $stmt = $db->prepare('SELECT * FROM payroll_records WHERE employee_id = ?');
            $stmt->execute([$employeeIdFilter]);
        } else {
            $stmt = $db->query('SELECT * FROM payroll_records');
        }
    } else {
        $stmt = $db->prepare("SELECT * FROM payroll_records WHERE employee_id = ? AND status = 'approved'");
        $stmt->execute([$myId]);
    }
    json_ok(array_map('rowToPayrollRecord', $stmt->fetchAll()));
}

if ($method === 'POST' && $id === null) {
    requireRole(['HR', 'Admin']);
    $input = request_body();
    $records = $input['records'] ?? [];
    foreach ($records as $r) {
        if (!empty($r['employeeId']) && !empty($r['month'])) upsertRecord($db, $r);
    }
    json_ok(['success' => true, 'count' => count($records)]);
}

if ($method === 'PUT' && $id !== null) {
    requireRole(['HR', 'Admin']);
    $find = $db->prepare('SELECT * FROM payroll_records WHERE id = ? LIMIT 1');
    $find->execute([$id]);
    $existing = $find->fetch();
    if (!$existing) json_error('Record not found.', 404);
    if ($existing['status'] === 'approved') json_error('Record is locked (approved).', 403);

    $patch = request_body();
    $merged = array_merge(rowToPayrollRecord($existing), $patch);
    upsertRecord($db, $merged);

    $refetch = $db->prepare('SELECT * FROM payroll_records WHERE id = ? LIMIT 1');
    $refetch->execute([$id]);
    json_ok(rowToPayrollRecord($refetch->fetch()));
}

if ($method === 'POST' && $id !== null && $action === 'approve') {
    requireRole(['HR', 'Admin']);
    $now = date('Y-m-d H:i:s');
    $db->prepare("UPDATE payroll_records SET status='approved', approved_by=?, approved_at=? WHERE id=?")
       ->execute([$myId, $now, $id]);

    $auditId = bin2hex(random_bytes(16));
    $log = $db->prepare('INSERT INTO payroll_audit (id, record_id, action, performed_by, changes) VALUES (?, ?, ?, ?, ?)');
    $log->execute([$auditId, $id, 'APPROVED', $myId, json_encode(['approved_at' => $now])]);

    json_ok(['success' => true]);
}

if ($method === 'POST' && $id !== null && $action === 'revision') {
    requireRole(['HR', 'Admin']);
    $find = $db->prepare('SELECT * FROM payroll_records WHERE id = ? LIMIT 1');
    $find->execute([$id]);
    $rec = $find->fetch();
    if (!$rec) json_error('Record not found.', 404);

    $revised = rowToPayrollRecord($rec);
    $revised['revision'] = (int)$rec['revision'] + 1;
    $revised['status'] = 'draft';
    $revised['approvedBy'] = null;
    $revised['approvedAt'] = null;
    $newId = upsertRecord($db, $revised);

    $refetch = $db->prepare('SELECT * FROM payroll_records WHERE id = ? LIMIT 1');
    $refetch->execute([$newId]);
    json_ok(rowToPayrollRecord($refetch->fetch()));
}

json_error("Method not allowed: {$method}", 405);