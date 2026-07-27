<?php
/**
 * GET    /api/training-modules              — fetch modules with status for current employee
 * POST   /api/training-modules               — create module (HR/Admin, multipart/form-data)
 * DELETE /api/training-modules/:id           — delete module (HR/Admin, non-seed only)
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

$id = $params['id'] ?? null;

const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_THUMB_BYTES = 5 * 1024 * 1024;
const UPLOAD_BASE = __DIR__ . '/uploads/training';
const UPLOAD_URL_BASE = 'https://eopms.ytbhai.com/eopms-api/uploads/training';

function generateUuidV4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function rowToModule($row) {
    return [
        'id' => $row['id'],
        'title' => $row['title'],
        'description' => $row['description'],
        'track' => $row['track'],
        'department' => $row['department'],
        'duration_seconds' => (int)$row['duration_seconds'],
        'thumbnail_url' => $row['thumbnail_url'],
        'video_url' => $row['video_url'],
        'order' => (int)$row['order'],
        'prerequisite_id' => $row['prerequisite_id'],
        'visibleToRoles' => $row['visible_to_roles'] ? json_decode($row['visible_to_roles'], true) : null,
    ];
}

function saveUpload($file, $subdir, $maxBytes) {
    if ($file['error'] !== UPLOAD_ERR_OK) throw new Exception('Upload failed (code ' . $file['error'] . ').');
    if ($file['size'] > $maxBytes) throw new Exception('File exceeds the ' . round($maxBytes / 1024 / 1024) . 'MB limit.');

    $dir = UPLOAD_BASE . '/' . $subdir;
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $safeName = time() . '_' . bin2hex(random_bytes(6)) . ($ext ? ".$ext" : '');
    $dest = $dir . '/' . $safeName;

    if (!move_uploaded_file($file['tmp_name'], $dest)) throw new Exception('Failed to save uploaded file.');

    return UPLOAD_URL_BASE . '/' . $subdir . '/' . $safeName;
}

// GET /api/training-modules
if ($method === 'GET' && $id === null) {
    $meStmt = $db->prepare('SELECT role, department FROM employees WHERE id = ? LIMIT 1');
    $meStmt->execute([$myId]);
    $me = $meStmt->fetch();
    $role = $me['role'] ?? null;
    $department = $me['department'] ?? null;
    $isManager = $role === 'HR' || $role === 'Admin';

    $modules = $db->query('SELECT * FROM training_modules WHERE is_seed = 0 ORDER BY `order` ASC')->fetchAll();
    $progStmt = $db->prepare('SELECT * FROM training_progress WHERE employee_id = ?');
    $progStmt->execute([$myId]);
    $allProgress = $progStmt->fetchAll();
    $attStmt = $db->prepare('SELECT * FROM quiz_attempts WHERE employee_id = ? ORDER BY attempted_at DESC');
    $attStmt->execute([$myId]);
    $allAttempts = $attStmt->fetchAll();

    $visible = array_values(array_filter($modules, function ($m) use ($isManager, $role, $department) {
        if ($isManager) return true;
        $roleOk = !$m['visible_to_roles'] || empty(json_decode($m['visible_to_roles'], true))
            || in_array($role, json_decode($m['visible_to_roles'], true));
        $deptOk = !$m['department'] || $m['department'] === $department;
        return $roleOk && $deptOk;
    }));
    $visibleIds = array_column($visible, 'id');

    $result = array_map(function ($m) use ($allProgress, $allAttempts, $myId, $visibleIds) {
        $moduleAttempts = array_values(array_filter($allAttempts, fn($a) => $a['module_id'] === $m['id']));
        $latestAttempt = $moduleAttempts[0] ?? null;

        $status = 'available';
        if ($latestAttempt && $latestAttempt['passed']) {
            $status = 'completed';
        } else {
            $prereqVisible = $m['prerequisite_id'] && in_array($m['prerequisite_id'], $visibleIds);
            $prereqPassed = $m['prerequisite_id']
                ? array_reduce($allAttempts, fn($carry, $a) => $carry || ($a['module_id'] === $m['prerequisite_id'] && $a['passed']), false)
                : true;
            if ($m['prerequisite_id'] && $prereqVisible && !$prereqPassed) {
                $status = 'locked';
            } elseif ($latestAttempt && !$latestAttempt['passed']) {
                $status = 'failed';
            } else {
                $progress = array_values(array_filter($allProgress, fn($p) => $p['module_id'] === $m['id']))[0] ?? null;
                if ($progress && (int)$progress['watched_seconds'] > 0) $status = 'in_progress';
            }
        }

        $progress = array_values(array_filter($allProgress, fn($p) => $p['module_id'] === $m['id']))[0] ?? null;

        return array_merge(rowToModule($m), [
            'status' => $status,
            'progress' => $progress ? [
                'id' => $progress['id'],
                'employee_id' => $progress['employee_id'],
                'module_id' => $progress['module_id'],
                'watched_seconds' => (int)$progress['watched_seconds'],
                'completed' => (bool)$progress['completed'],
                'created_at' => $progress['created_at'],
            ] : null,
            'latestAttempt' => $latestAttempt ? [
                'id' => $latestAttempt['id'],
                'employee_id' => $latestAttempt['employee_id'],
                'module_id' => $latestAttempt['module_id'],
                'answers' => json_decode($latestAttempt['answers'], true),
                'score' => (int)$latestAttempt['score'],
                'passed' => (bool)$latestAttempt['passed'],
                'attempted_at' => $latestAttempt['attempted_at'],
            ] : null,
        ]);
    }, $visible);

    json_ok($result);
}

// POST /api/training-modules  (multipart/form-data)
if ($method === 'POST' && $id === null) {
    requireRole(['HR', 'Admin']);

    $video_url = $_POST['video_url'] ?? '';
    $thumbnail_url = $_POST['thumbnail_url'] ?? '';

    try {
        if (!empty($_FILES['video']['name'])) {
            $video_url = saveUpload($_FILES['video'], 'videos', MAX_VIDEO_BYTES);
        }
        if (!empty($_FILES['thumbnail']['name'])) {
            $thumbnail_url = saveUpload($_FILES['thumbnail'], 'thumbnails', MAX_THUMB_BYTES);
        }
    } catch (Exception $e) {
        json_error($e->getMessage(), 422);
    }

    $newId = generateUuidV4();
    $visibleToRoles = json_decode($_POST['visibleToRoles'] ?? '[]', true) ?? [];

    $db->prepare(
        'INSERT INTO training_modules
         (id, title, description, track, department, duration_seconds, thumbnail_url, video_url, `order`, prerequisite_id, visible_to_roles, is_seed)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)'
    )->execute([
        $newId,
        $_POST['title'] ?? '',
        $_POST['description'] ?? '',
        $_POST['track'] ?? 'General',
        $_POST['department'] ?: null,
        (int)($_POST['duration_seconds'] ?? 0),
        $thumbnail_url,
        $video_url,
        (int)($_POST['order'] ?? 1),
        $_POST['prerequisite_id'] ?: null,
        json_encode($visibleToRoles),
    ]);

    $fetch = $db->prepare('SELECT * FROM training_modules WHERE id = ?');
    $fetch->execute([$newId]);
    json_ok(rowToModule($fetch->fetch()));
}

// DELETE /api/training-modules/:id
if ($method === 'DELETE' && $id !== null) {
    requireRole(['HR', 'Admin']);
    $db->prepare('DELETE FROM training_modules WHERE id = ? AND is_seed = 0')->execute([$id]);
    json_ok(['success' => true]);
}

json_error("Method not allowed: {$method}", 405);