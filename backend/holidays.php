<?php
/**
 * GET    /api/holidays/:year   — list holidays for a year
 * POST   /api/holidays         — add a holiday (HR/Admin)
 * DELETE /api/holidays/:id     — remove a holiday (HR/Admin)
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

$year = $params['year'] ?? null;
$id = $params['id'] ?? null;

function generateUuidV4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

// GET /api/holidays/:year
if ($method === 'GET' && $year !== null) {
    $stmt = $db->prepare('SELECT * FROM holidays WHERE date LIKE ? ORDER BY date ASC');
    $stmt->execute(["$year-%"]);
    json_ok($stmt->fetchAll());
}

// POST /api/holidays
if ($method === 'POST' && $id === null) {
    requireRole(['HR', 'Admin']);
    $input = request_body();
    $date = $input['date'] ?? '';
    $occasion = trim($input['occasion'] ?? '');
    $type = $input['type'] ?? 'National';
    $applyToAll = (bool)($input['apply_to_all'] ?? true);
    if ($date === '' || $occasion === '') json_error('date and occasion are required.', 422);

    $dupCheck = $db->prepare('SELECT id FROM holidays WHERE date = ? LIMIT 1');
    $dupCheck->execute([$date]);
    if ($dupCheck->fetch()) json_error('A holiday is already recorded for this date.', 422);

    $newId = generateUuidV4();
    $db->prepare(
        'INSERT INTO holidays (id, date, occasion, type, apply_to_all, created_by) VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$newId, $date, $occasion, $type, (int)$applyToAll, $myId]);

    $fetch = $db->prepare('SELECT * FROM holidays WHERE id = ?');
    $fetch->execute([$newId]);
    json_ok($fetch->fetch());
}

// DELETE /api/holidays/:id
if ($method === 'DELETE' && $id !== null) {
    requireRole(['HR', 'Admin']);
    $db->prepare('DELETE FROM holidays WHERE id = ?')->execute([$id]);
    json_ok(['success' => true]);
}

json_error("Method not allowed: {$method}", 405);