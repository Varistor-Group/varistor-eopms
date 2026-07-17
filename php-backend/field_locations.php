<?php
/**
 * POST /api/employees/location
 * GET /api/employees/locations
 */

$method = $_SERVER['REQUEST_METHOD'];
$dbStr = file_get_contents(DB_PATH);
$data = json_decode($dbStr, true);

if ($method === 'GET') {
    if (isset($_GET['history'])) {
        $empId = $_GET['employeeId'] ?? '';
        $from = $_GET['from'] ?? ''; // ISO string
        $to = $_GET['to'] ?? ''; // ISO string
        $history = [];
        foreach (($data['field_locations'] ?? []) as $loc) {
            if ($loc['employeeId'] === $empId) {
                if ($from && $loc['timestamp'] < $from) continue;
                if ($to && $loc['timestamp'] > $to) continue;
                $history[] = $loc;
            }
        }
        json_ok($history);
    } else {
        // Return all latest locations (one per employee) for today
        $today = date('Y-m-d');
        $latest = [];
        foreach (($data['field_locations'] ?? []) as $loc) {
            if (strpos($loc['timestamp'], $today) === 0) {
                $empId = $loc['employeeId'];
                if (!isset($latest[$empId]) || $loc['timestamp'] > $latest[$empId]['timestamp']) {
                    $latest[$empId] = $loc;
                }
            }
        }
        json_ok(array_values($latest));
    }
}

if ($method === 'POST') {
    $body = request_body();
    $employeeId = $body['employeeId'] ?? '';
    $lat = $body['latitude'] ?? null;
    $lng = $body['longitude'] ?? null;
    $acc = $body['accuracy'] ?? null;
    $timestamp = $body['timestamp'] ?? date('c');
    
    if (!$employeeId || $lat === null || $lng === null) {
        json_error('Missing required fields');
    }
    
    // Look up employee name/dept
    $empName = 'Unknown';
    $empDept = 'Unknown';
    $supaResponse = supabase_admin_get('/rest/v1/employees?id=eq.' . urlencode($employeeId) . '&select=fullName,department');
    if (isset($supaResponse[0])) {
        $empName = $supaResponse[0]['fullName'];
        $empDept = $supaResponse[0]['department'];
    }
    
    $locEntry = [
        'id' => 'loc-' . time() . rand(100, 999),
        'employeeId' => $employeeId,
        'employeeName' => $empName,
        'department' => $empDept,
        'latitude' => $lat,
        'longitude' => $lng,
        'accuracy' => $acc,
        'timestamp' => $timestamp
    ];
    
    $data['field_locations'][] = $locEntry;
    
    // Keep only last 1000 locations to prevent db.json bloat
    if (count($data['field_locations']) > 1000) {
        $data['field_locations'] = array_slice($data['field_locations'], -1000);
    }
    
    file_put_contents(DB_PATH, json_encode($data, JSON_PRETTY_PRINT));
    json_ok(['success' => true]);
}

json_error('Method not allowed', 405);
