<?php
/**
 * GET /api/cl-balances              — all balances
 * GET /api/cl-balances/:id          — one employee
 * PUT /api/cl-balances/:id          — set total / used
 */

$empId = $params['id'] ?? null;

if ($method === 'GET') {
    $db  = read_db();
    $bal = $db['employee_cl_balances'] ?? [];
    if ($empId !== null) {
        json_ok($bal[$empId] ?? ['total' => 12, 'used' => 0]);
    }
    json_ok($bal);
}

if ($method === 'PUT') {
    if (!$empId) json_error('Employee ID required', 400);
    $body = request_body();
    $db   = read_db();
    if (!isset($db['employee_cl_balances'])) $db['employee_cl_balances'] = [];
    $existing = $db['employee_cl_balances'][$empId] ?? ['total' => 12, 'used' => 0];

    $newTotal = $existing['total'];
    $newUsed  = $existing['used'];

    if (isset($body['total'])) {
        $newTotal = (int)$body['total'];
        if ($newTotal < 0) json_error('Invalid total value.', 400);
    }
    if (isset($body['used'])) {
        $newUsed = (int)$body['used'];
        if ($newUsed < 0) json_error('Invalid used value.', 400);
    }

    $db['employee_cl_balances'][$empId] = ['total' => $newTotal, 'used' => $newUsed];
    write_db($db);
    json_ok(['success' => true, 'balance' => $db['employee_cl_balances'][$empId]]);
}
