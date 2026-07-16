<?php
/**
 * GET  /api/employees          — list all
 * POST /api/employees          — create
 * PUT  /api/employees/:id      — update
 * DELETE /api/employees/:id    — (not used by frontend currently, but included)
 */

if ($method === 'GET') {
    $db = read_db();
    json_ok($db['employees'] ?? []);
}

if ($method === 'POST') {
    $db       = read_db();
    $employee = request_body();
    if (!isset($db['employees'])) $db['employees'] = [];

    // Duplicate check
    foreach ($db['employees'] as $e) {
        if ($e['employeeId'] === ($employee['employeeId'] ?? '') ||
            $e['personalEmail'] === ($employee['personalEmail'] ?? '')) {
            json_error('Employee ID or email already exists.', 400);
        }
    }

    $db['employees'][] = $employee;

    if (!isset($db['activity_log'])) $db['activity_log'] = [];
    $db['activity_log'][] = [
        'id'        => (string)(time() * 1000),
        'action'    => 'CREATE_EMPLOYEE',
        'by'        => 'admin@varistor.in',
        'details'   => 'Created employee ' . ($employee['fullName'] ?? '') . ' (' . ($employee['employeeId'] ?? '') . ')',
        'timestamp' => date('c'),
    ];

    write_db($db);
    json_ok(['success' => true, 'employee' => $employee]);
}

if ($method === 'PUT') {
    $id = $params['id'] ?? '';
    $db  = read_db();
    if (!isset($db['employees'])) $db['employees'] = [];

    $index = -1;
    foreach ($db['employees'] as $k => $e) {
        if ($e['id'] === $id) { $index = $k; break; }
    }
    if ($index === -1) {
        json_error('Employee not found.', 404);
    }

    $updates = request_body();
    // Protect immutable fields
    foreach (['id', 'employeeId', 'personalEmail', 'createdAt', 'tempPassword'] as $f) {
        unset($updates[$f]);
    }

    $db['employees'][$index] = array_merge($db['employees'][$index], $updates);

    if (!isset($db['activity_log'])) $db['activity_log'] = [];
    $db['activity_log'][] = [
        'id'        => (string)(time() * 1000),
        'action'    => 'UPDATE_EMPLOYEE',
        'by'        => 'admin@varistor.in',
        'details'   => 'Updated employee ' . ($db['employees'][$index]['fullName'] ?? '') . ' (' . $id . ')',
        'timestamp' => date('c'),
    ];

    write_db($db);
    json_ok(['success' => true, 'employee' => $db['employees'][$index]]);
}

if ($method === 'DELETE') {
    $id = $params['id'] ?? '';
    $db  = read_db();
    $db['employees'] = array_values(array_filter($db['employees'] ?? [], fn($e) => $e['id'] !== $id));
    write_db($db);
    json_ok(['success' => true]);
}
