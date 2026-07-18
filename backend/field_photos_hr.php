<?php
/**
 * GET /api/attendance/field-photos/pending
 * POST /api/attendance/field-photos/verify
 */

$method = $_SERVER['REQUEST_METHOD'];
$dbStr = file_get_contents(DB_PATH);
$data = json_decode($dbStr, true);

if ($method === 'GET') {
    $pending = [];
    foreach (($data['field_photos'] ?? []) as $photo) {
        if (($photo['verification_status'] ?? '') === 'Pending') {
            $pending[] = $photo;
        }
    }
    json_ok($pending);
}

if ($method === 'POST') {
    $body = request_body();
    $photoId = $body['photoId'] ?? '';
    $status = $body['status'] ?? '';
    $verifiedBy = $body['verifiedBy'] ?? 'System';
    
    if (!$photoId || !in_array($status, ['Verified', 'Rejected'])) {
        json_error('Invalid input');
    }
    
    $photoIdx = -1;
    foreach ($data['field_photos'] as $i => $photo) {
        if ($photo['id'] === $photoId) {
            $photoIdx = $i;
            break;
        }
    }
    
    if ($photoIdx < 0) {
        json_error('Photo record not found');
    }
    
    $photo = $data['field_photos'][$photoIdx];
    $data['field_photos'][$photoIdx]['verification_status'] = $status;
    $data['field_photos'][$photoIdx]['verified_by'] = $verifiedBy;
    $data['field_photos'][$photoIdx]['verified_at'] = date('c');
    
    // If rejected, mark ledger as Absent
    if ($status === 'Rejected') {
        $ledgerId = "atl-{$photo['employee_id']}-{$photo['date']}";
        foreach ($data['attendance_ledger'] as $i => $ledger) {
            if ($ledger['id'] === $ledgerId) {
                $data['attendance_ledger'][$i]['status'] = 'Absent';
                $data['attendance_ledger'][$i]['override_reason'] = 'Field photo rejected by HR';
                $data['attendance_ledger'][$i]['editor_id'] = $verifiedBy;
                $data['attendance_ledger'][$i]['edited_at'] = date('c');
                break;
            }
        }
    }
    
    file_put_contents(DB_PATH, json_encode($data, JSON_PRETTY_PRINT));
    json_ok(['success' => true]);
}

json_error('Method not allowed', 405);
