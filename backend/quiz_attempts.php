<?php
/**
 * GET  /api/quiz-attempts/latest/:moduleId   — latest attempt for current employee
 * POST /api/quiz-attempts                    — submit an attempt
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

$moduleId = $params['moduleId'] ?? null;

function generateUuidV4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function rowToAttempt($r) {
    return [
        'id' => $r['id'],
        'employee_id' => $r['employee_id'],
        'module_id' => $r['module_id'],
        'answers' => json_decode($r['answers'], true),
        'score' => (int)$r['score'],
        'passed' => (bool)$r['passed'],
        'attempted_at' => $r['attempted_at'],
    ];
}

// GET /api/quiz-attempts/latest/:moduleId
if ($method === 'GET' && $moduleId !== null) {
    $stmt = $db->prepare('SELECT * FROM quiz_attempts WHERE employee_id = ? AND module_id = ? ORDER BY attempted_at DESC LIMIT 1');
    $stmt->execute([$myId, $moduleId]);
    $row = $stmt->fetch();
    json_ok($row ? rowToAttempt($row) : null);
}

// POST /api/quiz-attempts
if ($method === 'POST' && $moduleId === null) {
    $input = request_body();
    $modId = $input['moduleId'] ?? '';
    $answers = $input['answers'] ?? [];
    if ($modId === '') json_error('moduleId is required.', 422);

    $qStmt = $db->prepare('SELECT id, correct_index FROM quiz_questions WHERE module_id = ?');
    $qStmt->execute([$modId]);
    $questions = $qStmt->fetchAll();

    $correct = 0;
    foreach ($questions as $q) {
        if (isset($answers[$q['id']]) && (int)$answers[$q['id']] === (int)$q['correct_index']) $correct++;
    }
    $score = count($questions) > 0 ? round(($correct / count($questions)) * 100) : 0;
    $passed = $score >= 70;

    $attemptId = generateUuidV4();
    $db->prepare(
        'INSERT INTO quiz_attempts (id, employee_id, module_id, answers, score, passed) VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$attemptId, $myId, $modId, json_encode($answers), $score, (int)$passed]);

    $fetch = $db->prepare('SELECT * FROM quiz_attempts WHERE id = ?');
    $fetch->execute([$attemptId]);
    json_ok(rowToAttempt($fetch->fetch()));
}

json_error("Method not allowed: {$method}", 405);