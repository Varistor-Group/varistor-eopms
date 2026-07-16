<?php
/**
 * GET  /api/leaves       — all leaves
 * POST /api/leaves       — create leave request
 * PUT  /api/leaves/:id   — update leave status
 */

if ($method === 'GET') {
    $db = read_db();
    json_ok($db['leaves'] ?? []);
}

if ($method === 'POST') {
    $db    = read_db();
    if (!isset($db['leaves'])) $db['leaves'] = [];
    $input = request_body();

    $newLeave = array_merge($input, [
        'id'        => 'leave-' . (time() * 1000),
        'status'    => 'Pending',
        'createdAt' => date('c'),
    ]);
    $db['leaves'][] = $newLeave;

    if (!isset($db['activity_log'])) $db['activity_log'] = [];
    $db['activity_log'][] = [
        'id'        => (string)(time() * 1000),
        'action'    => 'APPLY_LEAVE',
        'by'        => $newLeave['employeeName'] ?? '',
        'details'   => ($newLeave['employeeName'] ?? '') . ' applied for ' . ($newLeave['type'] ?? '') . ' from ' . ($newLeave['startDate'] ?? '') . ' to ' . ($newLeave['endDate'] ?? ''),
        'timestamp' => date('c'),
    ];

    write_db($db);
    json_ok(['success' => true, 'leave' => $newLeave]);
}

if ($method === 'PUT') {
    $id   = $params['id'] ?? '';
    $db   = read_db();
    $body = request_body();
    if (!isset($db['leaves'])) $db['leaves'] = [];

    $index = -1;
    foreach ($db['leaves'] as $k => $l) {
        if ($l['id'] === $id) { $index = $k; break; }
    }
    if ($index === -1) {
        json_error('Leave request not found.', 404);
    }

    $status = $body['status'] ?? '';
    $db['leaves'][$index]['status'] = $status;

    if (!isset($db['activity_log'])) $db['activity_log'] = [];
    $db['activity_log'][] = [
        'id'        => (string)(time() * 1000),
        'action'    => 'LEAVE_' . strtoupper($status),
        'by'        => 'hr@varistor.in',
        'details'   => $status . ' leave request for ' . ($db['leaves'][$index]['employeeName'] ?? ''),
        'timestamp' => date('c'),
    ];

    write_db($db);
    json_ok(['success' => true, 'leave' => $db['leaves'][$index]]);
}
