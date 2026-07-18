<?php
/**
 * GET/PUT /api/payroll/schedule
 * GET  — returns current schedule from db.json
 * PUT  — updates schedule (no cron reschedule in PHP; use cPanel Cron Job instead)
 */

if ($method === 'GET') {
    $db  = read_db();
    $sched = $db['payroll_schedule'] ?? ['day' => 10, 'hour' => 10, 'minute' => 0, 'enabled' => true, 'lastRun' => null];
    json_ok($sched);
}

if ($method === 'PUT') {
    $body    = request_body();
    $db      = read_db();
    $existing = $db['payroll_schedule'] ?? [];
    $newSched = array_merge($existing, [
        'day'     => (int)($body['day']    ?? 10),
        'hour'    => (int)($body['hour']   ?? 10),
        'minute'  => (int)($body['minute'] ?? 0),
        'enabled' => $body['enabled'] !== false,
    ]);
    $db['payroll_schedule'] = $newSched;
    write_db($db);
    json_ok(['success' => true, 'schedule' => $newSched]);
}
