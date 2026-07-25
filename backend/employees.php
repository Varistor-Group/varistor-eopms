<?php
/**
 * GET    /api/employees          — list all
 * POST   /api/employees          — create
 * PUT    /api/employees/:id      — update
 * DELETE /api/employees/:id      — (not used by frontend currently, but included)
 *
 * MIGRATION NOTE: previously read/wrote db.json exclusively (employees key),
 * never touched Supabase — same pattern found in leaves.php and cl_balances.php.
 * Rebuilt here against MySQL. Field names below convert the frontend's
 * camelCase (employeeId, fullName, ...) to the table's snake_case columns.
 */

$db = get_db();

// camelCase (frontend) -> snake_case (MySQL column) for employees fields
const EMPLOYEE_FIELD_MAP = [
    'employeeId'         => 'employee_id',
    'personalEmail'      => 'personal_email',
    'fullName'           => 'full_name',
    'username'           => 'username',
    'phone'              => 'phone',
    'department'         => 'department',
    'reportingManager'   => 'reporting_manager',
    'reportingManagerId' => 'reporting_manager_id',
    'role'               => 'role',
    'tempPassword'       => 'temp_password',
    'status'             => 'status',
    'variPoints'         => 'vari_points',
    'isFieldEmployee'    => 'is_field_employee',
    'avatarUrl'          => 'avatar_url',
    'dateOfJoining'      => 'date_of_joining',
    'dateOfBirth'        => 'date_of_birth',
    'uanNumber'          => 'uan_number',
    'shiftStart'         => 'shift_start',
    'shiftEnd'           => 'shift_end',
    'optOutPF'           => 'opt_out_pf',
    'optOutPT'           => 'opt_out_pt',
];

// Normalize a value before binding to PDO — booleans must become 0/1,
// not '' (PDO converts raw booleans to empty string, which breaks
// tinyint columns like is_field_employee, opt_out_pf, opt_out_pt).
function normalizeValue($val) {
    if (is_bool($val)) return (int)$val;
    return $val;
}

if ($method === 'GET') {
    if (currentEmployeeId() === null) json_error('Unauthorized', 401);
    $rows = $db->query('SELECT * FROM employees')->fetchAll();
    json_ok($rows);
}

if ($method === 'POST') {
    requireRole(['HR', 'Admin']);
    $employee = request_body();

    $empId = $employee['employeeId'] ?? '';
    $email = $employee['personalEmail'] ?? '';

    $dupCheck = $db->prepare('SELECT id FROM employees WHERE employee_id = ? OR personal_email = ? LIMIT 1');
    $dupCheck->execute([$empId, $email]);
    if ($dupCheck->fetch()) {
        json_error('Employee ID or email already exists.', 400);
    }

    $columns = ['id'];
    $placeholders = ['?'];
    $values = [$employee['id'] ?? ('VAR-' . substr(bin2hex(random_bytes(4)), 0, 6))];

    foreach (EMPLOYEE_FIELD_MAP as $jsKey => $col) {
        if (array_key_exists($jsKey, $employee)) {
            $columns[]      = $col;
            $placeholders[] = '?';
            $values[]       = normalizeValue($employee[$jsKey]);
        }
    }

    // Hash the temp password into password_hash so the employee can actually log in
    if (isset($employee['tempPassword']) && $employee['tempPassword'] !== '') {
        $columns[]      = 'password_hash';
        $placeholders[] = '?';
        $values[]       = password_hash($employee['tempPassword'], PASSWORD_DEFAULT);
    }

    $sql = 'INSERT INTO employees (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')';
    $insert = $db->prepare($sql);
    $insert->execute($values);

    $myId = currentEmployeeId();
    $log = $db->prepare('INSERT INTO activity_log (action, performed_by, details) VALUES (?, ?, ?)');
    $log->execute([
        'CREATE_EMPLOYEE',
        $myId,
        'Created employee ' . ($employee['fullName'] ?? '') . ' (' . $empId . ')',
    ]);

    $fetch = $db->prepare('SELECT * FROM employees WHERE id = ? LIMIT 1');
    $fetch->execute([$values[0]]);
    json_ok(['success' => true, 'employee' => $fetch->fetch()]);
}

if ($method === 'PUT') {
    $id = $params['id'] ?? '';
    requireOwnOrRole($id, ['HR', 'Admin']);

    $find = $db->prepare('SELECT * FROM employees WHERE id = ? LIMIT 1');
    $find->execute([$id]);
    $existing = $find->fetch();
    if (!$existing) json_error('Employee not found.', 404);

    $updates = request_body();
    // Protect immutable fields — same list as the original db.json version
    foreach (['id', 'employeeId', 'personalEmail', 'createdAt', 'tempPassword'] as $f) {
        unset($updates[$f]);
    }

    $setClauses = [];
    $values = [];
    foreach (EMPLOYEE_FIELD_MAP as $jsKey => $col) {
        if (array_key_exists($jsKey, $updates)) {
            $setClauses[] = "$col = ?";
            $values[]     = normalizeValue($updates[$jsKey]);
        }
    }

    if (!empty($setClauses)) {
        $values[] = $id;
        $sql = 'UPDATE employees SET ' . implode(', ', $setClauses) . ' WHERE id = ?';
        $db->prepare($sql)->execute($values);
    }

    $myId = currentEmployeeId();
    $refetch = $db->prepare('SELECT * FROM employees WHERE id = ? LIMIT 1');
    $refetch->execute([$id]);
    $updated = $refetch->fetch();

    $log = $db->prepare('INSERT INTO activity_log (action, performed_by, details) VALUES (?, ?, ?)');
    $log->execute([
        'UPDATE_EMPLOYEE',
        $myId,
        'Updated employee ' . ($updated['full_name'] ?? '') . ' (' . $id . ')',
    ]);

    json_ok(['success' => true, 'employee' => $updated]);
}

if ($method === 'DELETE') {
    requireRole(['Admin']);
    $id = $params['id'] ?? '';
    $db->prepare('DELETE FROM employees WHERE id = ?')->execute([$id]);
    json_ok(['success' => true]);
}

json_error("Method not allowed: {$method}", 405);