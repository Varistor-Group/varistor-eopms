<?php
/**
 * POST /api/attendance/field-punch          — multipart: photo (file), punchType, lat?, lng?, accuracy?, confidenceScore?
 * GET  /api/attendance/field-punch/status    — punch status for the logged-in employee, today
 *
 * Employee identity is ALWAYS derived from the auth token, never trusted
 * from client input — the original version trusted a client-supplied
 * employeeId, meaning anyone could submit a punch/photo as any employee.
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

const FIELD_PHOTO_UPLOAD_BASE = __DIR__ . '/uploads/field-photos';
const FIELD_PHOTO_URL_BASE = 'https://eopms.ytbhai.com/eopms-api/uploads/field-photos';
const MAX_FIELD_PHOTO_BYTES = 8 * 1024 * 1024;

function generateUuidV4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function saveFieldPhoto($file, $employeeId) {
    if ($file['error'] !== UPLOAD_ERR_OK) throw new Exception('Upload failed (code ' . $file['error'] . ').');
    if ($file['size'] > MAX_FIELD_PHOTO_BYTES) throw new Exception('Photo exceeds the 8MB limit.');

    $dir = FIELD_PHOTO_UPLOAD_BASE . '/' . $employeeId;
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $safeName = time() . '_' . bin2hex(random_bytes(6)) . '.jpg';
    $dest = $dir . '/' . $safeName;
    if (!move_uploaded_file($file['tmp_name'], $dest)) throw new Exception('Failed to save photo.');

    $storagePath = $employeeId . '/' . $safeName;
    return [$storagePath, FIELD_PHOTO_URL_BASE . '/' . $storagePath];
}

// GET /api/attendance/field-punch/status
if ($method === 'GET') {
    $today = date('Y-m-d');
    $stmt = $db->prepare('SELECT punch_in, punch_out FROM attendance_ledger WHERE employee_id = ? AND date = ? LIMIT 1');
    $stmt->execute([$myId, $today]);
    $row = $stmt->fetch();
    $punchedIn = (bool)($row && !empty($row['punch_in']) && empty($row['punch_out']));
    json_ok(['punchedIn' => $punchedIn]);
}

// POST /api/attendance/field-punch
if ($method === 'POST') {
    if (empty($_FILES['photo']['name'])) json_error('Photo is required.', 422);

    $date = date('Y-m-d');
    $punchType = $_POST['punchType'] ?? 'in';
    $lat = isset($_POST['lat']) ? (float)$_POST['lat'] : null;
    $lng = isset($_POST['lng']) ? (float)$_POST['lng'] : null;
    $accuracy = isset($_POST['accuracy']) ? (float)$_POST['accuracy'] : null;
    // Client-supplied — informational only for HR's review, never trusted as
    // an actual verification signal. Real verification is the HR approve/reject
    // step in field_photos_hr.php.
    $confidenceScore = isset($_POST['confidenceScore']) ? (float)$_POST['confidenceScore'] : null;

    try {
        [$storagePath, $photoUrl] = saveFieldPhoto($_FILES['photo'], $myId);
    } catch (Exception $e) {
        json_error($e->getMessage(), 422);
    }

    $now = date('Y-m-d H:i:s');

    $photoId = generateUuidV4();
    $db->prepare(
        'INSERT INTO field_attendance_photos
         (id, employee_id, date, photo_url, storage_path, punch_type, verification_status, confidence_score, latitude, longitude, location_accuracy, punch_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([$photoId, $myId, $date, $photoUrl, $storagePath, $punchType, 'Pending', $confidenceScore, $lat, $lng, $accuracy, $now]);

    $find = $db->prepare('SELECT * FROM attendance_ledger WHERE employee_id = ? AND date = ? LIMIT 1');
    $find->execute([$myId, $date]);
    $existing = $find->fetch();

    if ($existing) {
        if ($punchType === 'in') {
            $db->prepare('UPDATE attendance_ledger SET punch_in = ?, status = ?, source = ?, photo_url = ?, confidence = ? WHERE id = ?')
               ->execute([$now, 'Present', 'field_photo', $photoUrl, $confidenceScore, $existing['id']]);
        } else {
            $workHours = !empty($existing['punch_in'])
                ? round((strtotime($now) - strtotime($existing['punch_in'])) / 3600, 2)
                : null;
            $db->prepare('UPDATE attendance_ledger SET punch_out = ?, photo_url = ?, work_hours = ? WHERE id = ?')
               ->execute([$now, $photoUrl, $workHours, $existing['id']]);
        }
    } else {
        $newId = generateUuidV4();
        if ($punchType === 'in') {
            $db->prepare(
                'INSERT INTO attendance_ledger (id, employee_id, date, status, source, photo_url, confidence, is_field_employee, punch_in)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)'
            )->execute([$newId, $myId, $date, 'Present', 'field_photo', $photoUrl, $confidenceScore, $now]);
        } else {
            $db->prepare(
                'INSERT INTO attendance_ledger (id, employee_id, date, status, source, photo_url, is_field_employee, punch_out)
                 VALUES (?, ?, ?, ?, ?, ?, 1, ?)'
            )->execute([$newId, $myId, $date, 'Present', 'field_photo', $photoUrl, $now]);
        }
    }

    json_ok(['success' => true, 'photoUrl' => $photoUrl]);
}

json_error("Method not allowed: {$method}", 405);