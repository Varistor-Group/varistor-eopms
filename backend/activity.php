<?php
/**
 * POST /api/activity
 * Appends an activity log entry to db.json.
 */

$db  = read_db();
$log = request_body();
if (!isset($db['activity_log'])) $db['activity_log'] = [];
$db['activity_log'][] = array_merge($log, [
    'id'        => (string)(time() * 1000),
    'timestamp' => date('c'),
]);
write_db($db);
json_ok(['success' => true]);
