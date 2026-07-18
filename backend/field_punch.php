<?php
/**
 * POST /api/attendance/field-punch   — Body: JSON { employeeId, date, punchType, photoUrl, confidenceScore, lat?, lng?, accuracy? }
 * GET  /api/attendance/field-punch/status?employeeId=...
 */

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $employeeId = $_GET['employeeId'] ?? '';
    if (!$employeeId) {
        json_error('Employee ID required');
    }
    
    $date = date('Y-m-d');
    $ledgerId = "atl-{$employeeId}-{$date}";
    
    $data = read_db();
    
    $punchedIn = false;
    foreach (($data['attendance_ledger'] ?? []) as $entry) {
        if ($entry['id'] === $ledgerId && !empty($entry['punch_in']) && empty($entry['punch_out'])) {
            $punchedIn = true;
            break;
        }
    }
    
    json_ok(['punchedIn' => $punchedIn]);
}

if ($method === 'POST') {
    // Accept JSON body (photo is already uploaded to Supabase Storage by the frontend)
    $body = request_body();

    $employeeId     = $body['employeeId']     ?? '';
    $date           = $body['date']           ?? date('Y-m-d');
    $punchType      = $body['punchType']      ?? 'in';
    $photoUrl       = $body['photoUrl']       ?? '';
    $confidenceScore = (float)($body['confidenceScore'] ?? 0);
    $lat      = isset($body['lat'])      ? (float)$body['lat']      : null;
    $lng      = isset($body['lng'])      ? (float)$body['lng']      : null;
    $accuracy = isset($body['accuracy']) ? (float)$body['accuracy'] : null;

    if (!$employeeId) json_error('Missing employeeId');
    if (!$photoUrl)   json_error('Missing photoUrl');
    
    // Load db.json safely
    $data = read_db();
    if (!isset($data['attendance_ledger'])) $data['attendance_ledger'] = [];
    if (!isset($data['field_photos'])) $data['field_photos'] = [];
    
    $now = date('c');
    
    // Fetch employee name from Supabase — correct column is full_name
    $empName = 'Unknown';
    $empDept = 'Unknown';
    $supaResponse = supabase_admin_get('/rest/v1/employees?id=eq.' . urlencode($employeeId) . '&select=full_name,department');
    if (isset($supaResponse[0])) {
        $empName = $supaResponse[0]['full_name'] ?? 'Unknown';
        $empDept = $supaResponse[0]['department'] ?? 'Unknown';
    }
    
    // Save to field_photos
    $photoEntry = [
        'id' => 'fp-' . time() . rand(100, 999),
        'employee_id' => $employeeId,
        'employeeName' => $empName,
        'department' => $empDept,
        'date' => $date,
        'photo_url' => $photoUrl,
        'uploaded_at' => $now,
        'punch_type' => $punchType,
        'verification_status' => 'Pending',
        'confidence_score' => $confidenceScore,
        'latitude' => $lat,
        'longitude' => $lng,
        'location_accuracy' => $accuracy,
        'punch_time' => $now,
    ];
    
    $data['field_photos'][] = $photoEntry;
    
    // Upsert attendance_ledger
    $ledgerId = "atl-{$employeeId}-{$date}";
    $ledgerIdx = -1;
    foreach ($data['attendance_ledger'] as $i => $entry) {
        if ($entry['id'] === $ledgerId) {
            $ledgerIdx = $i;
            break;
        }
    }
    
    if ($ledgerIdx >= 0) {
        $data['attendance_ledger'][$ledgerIdx]['status'] = 'Present';
        $data['attendance_ledger'][$ledgerIdx]['source'] = 'field_photo';
        $data['attendance_ledger'][$ledgerIdx]['photo_url'] = $photoUrl;
        $data['attendance_ledger'][$ledgerIdx]['confidence'] = $confidenceScore;
        if ($punchType === 'in') {
            $data['attendance_ledger'][$ledgerIdx]['punch_in'] = $now;
        } else {
            $data['attendance_ledger'][$ledgerIdx]['punch_out'] = $now;
            // Calculate work hours if punch_in exists
            if (!empty($data['attendance_ledger'][$ledgerIdx]['punch_in'])) {
                $inTime = strtotime($data['attendance_ledger'][$ledgerIdx]['punch_in']);
                $outTime = strtotime($now);
                $data['attendance_ledger'][$ledgerIdx]['work_hours'] = round(($outTime - $inTime) / 3600, 2);
            }
        }
    } else {
        $newLedger = [
            'id' => $ledgerId,
            'employee_id' => $employeeId,
            'employeeName' => $empName,
            'department' => $empDept,
            'date' => $date,
            'status' => 'Present',
            'source' => 'field_photo',
            'photo_url' => $photoUrl,
            'confidence' => $confidenceScore,
            'created_at' => $now,
            'is_field_employee' => true,
        ];
        if ($punchType === 'in') {
            $newLedger['punch_in'] = $now;
        } else {
            $newLedger['punch_out'] = $now;
        }
        $data['attendance_ledger'][] = $newLedger;
    }
    
    write_db($data);
    
    json_ok(['success' => true, 'photoUrl' => $photoUrl]);
}

json_error('Method not allowed', 405);
