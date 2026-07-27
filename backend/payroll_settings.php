<?php
/**
 * GET /api/payroll-settings           — get all settings (any authenticated)
 * PUT /api/payroll-settings/:key      — set one setting (HR/Admin only)
 *
 * Replaces localStorage keys: eopms_salary_heads, eopms_salary_formulas,
 * eopms_employee_salary_details. Each is stored as one row keyed by name.
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

$key = $params['key'] ?? null;

if ($method === 'GET') {
    $rows = $db->query('SELECT setting_key, setting_value FROM payroll_settings')->fetchAll();
    $result = [];
    foreach ($rows as $r) {
        $result[$r['setting_key']] = json_decode($r['setting_value'], true);
    }
    json_ok($result);
}

if ($method === 'PUT') {
    requireRole(['HR', 'Admin']);
    if (!$key) json_error('Setting key required.', 400);

    $input = request_body();
    $value = $input['value'] ?? null;

    $db->prepare('INSERT INTO payroll_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)')
       ->execute([$key, json_encode($value)]);

    json_ok(['success' => true]);
}

json_error("Method not allowed: {$method}", 405);