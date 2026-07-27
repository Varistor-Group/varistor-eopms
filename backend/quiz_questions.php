<?php
// GET /api/quiz-questions/:moduleId

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

$moduleId = $params['moduleId'] ?? null;
if ($method !== 'GET' || $moduleId === null) json_error("Method not allowed: {$method}", 405);

$stmt = $db->prepare('SELECT * FROM quiz_questions WHERE module_id = ? ORDER BY created_at ASC');
$stmt->execute([$moduleId]);
$rows = $stmt->fetchAll();

json_ok(array_map(fn($r) => [
    'id' => $r['id'],
    'module_id' => $r['module_id'],
    'question' => $r['question'],
    'options' => json_decode($r['options'], true),
    'correct_index' => (int)$r['correct_index'],
], $rows));