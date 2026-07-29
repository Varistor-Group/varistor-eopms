<?php
/**
 * GET /api/attendance-settings              — all settings as { key: value }
 * PUT /api/attendance-settings/:key         — update one setting (HR/Admin only)
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

$key = $params['key'] ?? null;

// GET /api/attendance-settings
if ($method === 'GET' && $key === null) {
    $rows = $db->query('SELECT `key`, `value` FROM attendance_settings')->fetchAll();
    $result = [];
    foreach ($rows as $row) $result[$row['key']] = $row['value'];
    json_ok($result);
}

// PUT /api/attendance-settings/:key
if ($method === 'PUT' && $key !== null) {
    requireRole(['HR', 'Admin']);
    $input = request_body();
    $value = $input['value'] ?? '';

    $db->prepare(
        'INSERT INTO attendance_settings (`key`, `value`) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)'
    )->execute([$key, (string)$value]);

    json_ok(['success' => true]);
}

json_error("Method not allowed: {$method}", 405);