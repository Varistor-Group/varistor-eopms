<?php
/**
 * POST /api/biometric
 * Receives ADMS push from Bio Park D-01 biometric device.
 * Payload example: {"device_id": "D01-99", "user_id": "101", "time": "2026-07-14 09:30:00", "type": "0"}
 */

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'POST') {
    json_error('Method Not Allowed', 405);
}

// Support both JSON and URL-encoded form data (as ADMS can send either)
$body = request_body();
if (empty($body) && !empty($_POST)) {
    $body = $_POST;
}

$device_id = $body['device_id'] ?? '';
$user_id   = $body['user_id'] ?? '';
$time      = $body['time'] ?? '';
$type      = $body['type'] ?? ''; // 0 = In, 1 = Out (typical ADMS)

if (!$user_id || !$time) {
    json_error('Invalid Data: Missing user_id or time', 400);
}

// Extract date from time "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DD"
$dateStr = explode(' ', $time)[0];
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateStr)) {
    json_error('Invalid time format, expected YYYY-MM-DD HH:MM:SS', 400);
}

// 1. Fetch employee UUID using their biometric ID (which maps to employee_id in our DB)
// Note: We urlencode the user_id to prevent injection in the REST URL
$empResponse = supabase_admin_get('/rest/v1/employees?employee_id=eq.' . urlencode($user_id) . '&select=id,is_field_employee');

if (empty($empResponse) || !isset($empResponse[0]['id'])) {
    // If we can't find the employee, we still return 200 so the device doesn't keep retrying this failed record,
    // but we log an error response.
    json_ok(['status' => 'EMPLOYEE_NOT_FOUND', 'user_id' => $user_id]);
}

$employeeUuid = $empResponse[0]['id'];
$isFieldEmp   = $empResponse[0]['is_field_employee'] ?? false;
$nowIso       = gmdate('Y-m-d\TH:i:s\Z', strtotime($time)); // convert to ISO for DB

// 2. Check if an attendance_ledger record already exists for today
$ledgerResponse = supabase_admin_get('/rest/v1/attendance_ledger?employee_id=eq.' . urlencode($employeeUuid) . '&date=eq.' . urlencode($dateStr) . '&select=id,punch_in,punch_out');

$existingRecord = null;
if (!empty($ledgerResponse) && isset($ledgerResponse[0]['id'])) {
    $existingRecord = $ledgerResponse[0];
}

// 3. Process Check-In vs Check-Out
if ((string)$type === '0') {
    // Check-In
    if ($existingRecord) {
        // Update punch_in if it exists (or maybe keep the earliest? We'll overwrite to match previous logic)
        $patchPayload = [
            'punch_in' => $nowIso,
            'source'   => 'biometric_device',
            'status'   => 'Present'
        ];
        supabase_admin_patch('/rest/v1/attendance_ledger?id=eq.' . urlencode($existingRecord['id']), $patchPayload);
    } else {
        // Insert new record
        $insertPayload = [
            'employee_id' => $employeeUuid,
            'date'        => $dateStr,
            'punch_in'    => $nowIso,
            'source'      => 'biometric_device',
            'status'      => 'Present',
            'is_field_employee' => $isFieldEmp
        ];
        supabase_admin_post('/rest/v1/attendance_ledger', $insertPayload);
    }
} else {
    // Check-Out (type 1 or others)
    if ($existingRecord) {
        $punchInTime = !empty($existingRecord['punch_in']) ? strtotime($existingRecord['punch_in']) : null;
        $workHours = null;
        if ($punchInTime) {
            $diffMs = strtotime($nowIso) - $punchInTime;
            $workHours = round(($diffMs / 3600), 2);
        }
        $patchPayload = [
            'punch_out'  => $nowIso,
            'work_hours' => $workHours
        ];
        supabase_admin_patch('/rest/v1/attendance_ledger?id=eq.' . urlencode($existingRecord['id']), $patchPayload);
    } else {
        // Check-out without check-in
        $insertPayload = [
            'employee_id' => $employeeUuid,
            'date'        => $dateStr,
            'punch_out'   => $nowIso,
            'source'      => 'biometric_device',
            'status'      => 'Present', // Or half-day/absent based on logic, but present for now
            'is_field_employee' => $isFieldEmp
        ];
        supabase_admin_post('/rest/v1/attendance_ledger', $insertPayload);
    }
}

// Always return 200 OK so the machine clears the log from its memory
json_ok(["status" => "SUCCESS"]);
