<?php
/**
 * GET/PUT /api/payroll/schedule
 * GET  — returns current schedule
 * PUT  — updates schedule (HR/Admin only; no cron reschedule here —
 *         use a cPanel Cron Job pointed at trigger-send if automation is needed)
 */

$db = get_db();

if ($method === 'GET') {
    $stmt = $db->prepare('SELECT setting_value FROM payroll_settings WHERE setting_key = ? LIMIT 1');
    $stmt->execute(['schedule']);
    $row = $stmt->fetch();
    $sched = $row ? json_decode($row['setting_value'], true) : ['day' => 10, 'hour' => 10, 'minute' => 0, 'enabled' => true, 'lastRun' => null];
    json_ok($sched);
}

if ($method === 'PUT') {
    requireRole(['HR', 'Admin']);
    $body = request_body();

    $stmt = $db->prepare('SELECT setting_value FROM payroll_settings WHERE setting_key = ? LIMIT 1');
    $stmt->execute(['schedule']);
    $row = $stmt->fetch();
    $existing = $row ? json_decode($row['setting_value'], true) : [];

    $newSched = array_merge($existing, [
        'day'     => (int)($body['day']    ?? 10),
        'hour'    => (int)($body['hour']   ?? 10),
        'minute'  => (int)($body['minute'] ?? 0),
        'enabled' => $body['enabled'] !== false,
    ]);

    $db->prepare('INSERT INTO payroll_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)')
       ->execute(['schedule', json_encode($newSched)]);

    json_ok(['success' => true, 'schedule' => $newSched]);
}

json_error("Method not allowed: {$method}", 405);