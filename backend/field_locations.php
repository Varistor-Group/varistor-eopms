<?php
/**
 * POST /api/employees/location    — submit the logged-in employee's current location
 * GET  /api/employees/locations   — latest location per employee today (HR/Admin),
 *                                    or ?history=true&employeeId=X&from=&to= for one
 *                                    employee's path history (HR/Admin)
 *
 * REBUILT: previous version read/wrote the legacy db.json file and called
 * supabase_admin_get(), a function that no longer exists -- every POST here
 * was fatal-erroring silently. Also had zero authentication (anyone could
 * post fake locations for any employee, or read everyone's location data).
 */
$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

function generateUuidV4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

if ($method === 'GET') {
    requireRole(['HR', 'Admin']);

    if (isset($_GET['history']) && $_GET['history'] === 'true') {
        $empId = $_GET['employeeId'] ?? '';
        $from  = $_GET['from'] ?? '';
        $to    = $_GET['to'] ?? '';
        if ($empId === '') json_error('employeeId is required.', 422);

        $sql = 'SELECT id, employee_id, latitude, longitude, accuracy, recorded_at
                FROM field_locations WHERE employee_id = ?';
        $params = [$empId];
        if ($from !== '') { $sql .= ' AND recorded_at >= ?'; $params[] = $from; }
        if ($to !== '')   { $sql .= ' AND recorded_at <= ?'; $params[] = $to; }
        $sql .= ' ORDER BY recorded_at ASC';

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $result = array_map(function ($r) {
            return [
                'id' => $r['id'],
                'employeeId' => $r['employee_id'],
                'latitude' => (float)$r['latitude'],
                'longitude' => (float)$r['longitude'],
                'accuracy' => $r['accuracy'] !== null ? (float)$r['accuracy'] : null,
                'timestamp' => $r['recorded_at'],
            ];
        }, $rows);
        json_ok($result);
    } else {
        // Latest location per employee, today only.
        $stmt = $db->query(
            "SELECT fl.id, fl.employee_id, fl.latitude, fl.longitude, fl.accuracy, fl.recorded_at,
                    e.full_name AS employeeName, e.department
             FROM field_locations fl
             INNER JOIN (
                 SELECT employee_id, MAX(recorded_at) AS max_recorded
                 FROM field_locations
                 WHERE DATE(recorded_at) = CURDATE()
                 GROUP BY employee_id
             ) latest ON latest.employee_id = fl.employee_id AND latest.max_recorded = fl.recorded_at
             INNER JOIN employees e ON e.id = fl.employee_id"
        );
        $rows = $stmt->fetchAll();

        $result = array_map(function ($r) {
            return [
                'id' => $r['id'],
                'employeeId' => $r['employee_id'],
                'employeeName' => $r['employeeName'],
                'department' => $r['department'],
                'latitude' => (float)$r['latitude'],
                'longitude' => (float)$r['longitude'],
                'accuracy' => $r['accuracy'] !== null ? (float)$r['accuracy'] : null,
                'timestamp' => $r['recorded_at'],
            ];
        }, $rows);
        json_ok($result);
    }
}

if ($method === 'POST') {
    // Always use the authenticated caller's own id -- never trust a
    // client-supplied employeeId, matching the pattern used elsewhere
    // (e.g. leaves.php) to prevent submitting fake locations for others.
    $body = request_body();
    $lat = $body['latitude'] ?? null;
    $lng = $body['longitude'] ?? null;
    $acc = $body['accuracy'] ?? null;
    $timestamp = $body['timestamp'] ?? date('c');

    if ($lat === null || $lng === null) {
        json_error('latitude and longitude are required.', 422);
    }

    $id = generateUuidV4();
    $db->prepare(
        'INSERT INTO field_locations (id, employee_id, latitude, longitude, accuracy, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$id, $myId, $lat, $lng, $acc, date('Y-m-d H:i:s', strtotime($timestamp))]);

    json_ok(['success' => true]);
}

json_error("Method not allowed: {$method}", 405);
