<?php
/**
 * GET /api/documents/:employeeId
 */

$employeeId = $params['employeeId'] ?? '';
$db         = read_db();
$docs       = array_values(array_filter($db['documents'] ?? [], fn($d) => $d['employeeId'] === $employeeId));
json_ok($docs);
