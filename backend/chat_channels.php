<?php
/**
 * GET    /api/chat/channels          — list channels (filtered by role/dept for caller)
 * POST   /api/chat/channels          — create channel
 * PUT    /api/chat/channels/:id      — edit channel
 * DELETE /api/chat/channels/:id      — delete channel (cascades messages/reads via FK)
 */

$db = get_db();
$id = $params['id'] ?? null;

$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);
$role = currentUserRole();

function buildChannelsList($db, $myId, $role) {
    $channels = $db->query('SELECT * FROM chat_channels')->fetchAll();
    $empCountStmt = $db->query('SELECT COUNT(*) AS cnt FROM employees');
    $totalEmployees = (int)$empCountStmt->fetch()['cnt'];

    $myEmpStmt = $db->prepare('SELECT department FROM employees WHERE id = ? LIMIT 1');
    $myEmpStmt->execute([$myId]);
    $myDept = $myEmpStmt->fetch()['department'] ?? null;

    $result = [];
    foreach ($channels as $c) {
        $departments = $c['departments'] ? json_decode($c['departments'], true) : null;
        $allowedIds = $c['allowed_employee_ids'] ? json_decode($c['allowed_employee_ids'], true) : null;

        // Visibility check (Admin sees all)
        if ($role !== 'Admin' && ($departments || $allowedIds)) {
            $visible = false;
            if ($departments && $myDept && in_array($myDept, $departments, true)) $visible = true;
            if ($allowedIds && in_array($myId, $allowedIds, true)) $visible = true;
            if (!$visible) continue;
        }

        // Member count
        if ($departments || $allowedIds) {
            $countSql = 'SELECT COUNT(*) AS cnt FROM employees WHERE 1=0';
            $conditions = [];
            $countParams = [];
            if ($departments) {
                $placeholders = implode(',', array_fill(0, count($departments), '?'));
                $conditions[] = "department IN ($placeholders)";
                $countParams = array_merge($countParams, $departments);
            }
            if ($allowedIds) {
                $placeholders = implode(',', array_fill(0, count($allowedIds), '?'));
                $conditions[] = "id IN ($placeholders)";
                $countParams = array_merge($countParams, $allowedIds);
            }
            $countSql = 'SELECT COUNT(DISTINCT id) AS cnt FROM employees WHERE ' . implode(' OR ', $conditions);
            $cStmt = $db->prepare($countSql);
            $cStmt->execute($countParams);
            $memberCount = (int)$cStmt->fetch()['cnt'];
        } else {
            $memberCount = $totalEmployees;
        }

        $result[] = [
            'id' => $c['id'],
            'name' => $c['name'],
            'pinned' => $c['pinned'],
            'departments' => $departments,
            'allowedEmployeeIds' => $allowedIds,
            'memberCount' => $memberCount,
        ];
    }
    return $result;
}

if ($method === 'GET') {
    json_ok(buildChannelsList($db, $myId, $role));
}

if ($method === 'POST') {
    $input = request_body();
    $name = trim($input['name'] ?? '');
    if ($name === '') json_error('Channel name is required.', 422);

    $slug = strtolower(preg_replace('/[^a-z0-9]+/i', '-', $name));
    $slug = trim($slug, '-') . '-' . substr(bin2hex(random_bytes(3)), 0, 4);

    $departments = !empty($input['departments']) ? json_encode($input['departments']) : null;
    $allowedIds = !empty($input['allowedEmployeeIds']) ? json_encode($input['allowedEmployeeIds']) : null;

    $db->prepare('INSERT INTO chat_channels (id, name, departments, allowed_employee_ids) VALUES (?, ?, ?, ?)')
       ->execute([$slug, $name, $departments, $allowedIds]);

    json_ok(['success' => true, 'channels' => buildChannelsList($db, $myId, $role)]);
}

if ($method === 'PUT') {
    $input = request_body();
    $name = trim($input['name'] ?? '');
    if ($name === '') json_error('Channel name is required.', 422);

    $departments = !empty($input['departments']) ? json_encode($input['departments']) : null;
    $allowedIds = !empty($input['allowedEmployeeIds']) ? json_encode($input['allowedEmployeeIds']) : null;

    $db->prepare('UPDATE chat_channels SET name = ?, departments = ?, allowed_employee_ids = ? WHERE id = ?')
       ->execute([$name, $departments, $allowedIds, $id]);

    json_ok(['success' => true, 'channels' => buildChannelsList($db, $myId, $role)]);
}

if ($method === 'DELETE') {
    $countStmt = $db->query('SELECT COUNT(*) AS cnt FROM chat_channels');
    if ((int)$countStmt->fetch()['cnt'] <= 1) {
        json_error('At least one channel must remain.', 400);
    }
    $db->prepare('DELETE FROM chat_channels WHERE id = ?')->execute([$id]);
    json_ok(['success' => true, 'channels' => buildChannelsList($db, $myId, $role)]);
}

json_error("Method not allowed: {$method}", 405);