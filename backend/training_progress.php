<?php
// PUT /api/training-progress  — body: { moduleId, watchedSeconds }

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

if ($method !== 'PUT') json_error("Method not allowed: {$method}", 405);

function generateUuidV4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

$input = request_body();
$moduleId = $input['moduleId'] ?? '';
$watchedSeconds = (int)($input['watchedSeconds'] ?? 0);
if ($moduleId === '') json_error('moduleId is required.', 422);

$modStmt = $db->prepare('SELECT duration_seconds FROM training_modules WHERE id = ? LIMIT 1');
$modStmt->execute([$moduleId]);
$module = $modStmt->fetch();
$completed = $module ? $watchedSeconds >= (int)$module['duration_seconds'] : false;

$progId = generateUuidV4();
$db->prepare(
    'INSERT INTO training_progress (id, employee_id, module_id, watched_seconds, completed)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE watched_seconds = VALUES(watched_seconds), completed = VALUES(completed)'
)->execute([$progId, $myId, $moduleId, $watchedSeconds, (int)$completed]);

json_ok(['success' => true]);