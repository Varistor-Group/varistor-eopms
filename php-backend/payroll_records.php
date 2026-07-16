<?php
/**
 * POST /api/payroll/records
 * Syncs latest payroll records from client into db.json.
 * Body: { records: [] }
 */

$body    = request_body();
$records = $body['records'] ?? null;

if (!is_array($records)) {
    json_error('records must be an array.', 400);
}

$db = read_db();
$db['payroll_records'] = $records;
write_db($db);

json_ok(['success' => true, 'count' => count($records)]);
