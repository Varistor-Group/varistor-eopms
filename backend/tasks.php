<?php
/**
 * GET    /api/tasks              — list all (any authenticated)
 * POST   /api/tasks               — create (any authenticated — employee, manager, or HR)
 * PUT    /api/tasks/:id            — update (any authenticated for most fields;
 *                                    marking status='done' requires HR/Admin, or the
 *                                    assignee's actual Reporting Manager, matched by
 *                                    employees.reporting_manager_id)
 * DELETE /api/tasks/:id            — delete (HR/Admin always; a Reporting Manager
 *                                    may reject a direct report's pending_review
 *                                    request; an employee may cancel their own
 *                                    pending_review request)
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);
$role = currentUserRole();

$id = $params['id'] ?? null;

function rowToTask($row) {
    return [
        'id' => $row['id'],
        'title' => $row['title'],
        'description' => $row['description'],
        'dueDate' => $row['due_date'],
        'priority' => $row['priority'],
        'status' => $row['status'],
        'completedAt' => $row['completed_at'],
        'assigneeId' => $row['assignee_id'],
        'checklist' => $row['checklist'] ? json_decode($row['checklist'], true) : [],
        'comments' => $row['comments'] ? json_decode($row['comments'], true) : [],
        'attachments' => $row['attachments'] ? json_decode($row['attachments'], true) : [],
        'pointsProcessed' => (bool)$row['points_processed'],
        'isOverdueSwept' => (bool)$row['is_overdue_swept'],
    ];
}

if ($method === 'GET') {
    $rows = $db->query('SELECT * FROM tasks ORDER BY created_at DESC')->fetchAll();
    json_ok(array_map('rowToTask', $rows));
}

if ($method === 'POST') {
    $input = request_body();
    $taskId = $input['id'] ?? ('task-' . bin2hex(random_bytes(8)));

    $stmt = $db->prepare(
        'INSERT INTO tasks (id, title, description, due_date, priority, status, assignee_id, checklist, comments, attachments, points_processed, is_overdue_swept)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $taskId,
        $input['title'] ?? '',
        $input['description'] ?? '',
        $input['dueDate'] ?? date('Y-m-d'),
        $input['priority'] ?? 'medium',
        $input['status'] ?? 'todo',
        $input['assigneeId'] ?? null,
        json_encode($input['checklist'] ?? []),
        json_encode([]),
        json_encode([]),
        0,
        0,
    ]);

    $fetch = $db->prepare('SELECT * FROM tasks WHERE id = ? LIMIT 1');
    $fetch->execute([$taskId]);
    json_ok(rowToTask($fetch->fetch()));
}

if ($method === 'PUT') {
    if (!$id) json_error('Task ID required.', 400);
    $input = request_body();

    // Guard: marking a task 'done' requires approval-capable role.
    // HR/Admin can approve anyone's task. A Reporting Manager can only
    // approve tasks for employees whose reporting_manager_id matches them.
    if (isset($input['status']) && $input['status'] === 'done') {
        if (!in_array($role, ['HR', 'Admin', 'Reporting Manager'], true)) {
            json_error('Only HR, Admin, or a Reporting Manager can approve task completion.', 403);
        }

        if ($role === 'Reporting Manager') {
            $taskStmt = $db->prepare('SELECT assignee_id FROM tasks WHERE id = ? LIMIT 1');
            $taskStmt->execute([$id]);
            $taskRow = $taskStmt->fetch();
            if (!$taskRow) json_error('Task not found.', 404);

            $assigneeStmt = $db->prepare('SELECT reporting_manager_id FROM employees WHERE id = ? LIMIT 1');
            $assigneeStmt->execute([$taskRow['assignee_id']]);
            $assignee = $assigneeStmt->fetch();

            if (!$assignee || $assignee['reporting_manager_id'] !== $myId) {
                json_error('You can only approve tasks for your direct reports.', 403);
            }
        }

        // Stamp completion time — this is what lets us later tell whether
        // the task was finished on-time or late, comparing against due_date.
        $input['completedAt'] = date('Y-m-d H:i:s');
    }

    // Guard: approving an employee-requested task (status pending_review -> anything else,
    // typically 'todo') requires the same approval-capable roles as completion approval.
    if (isset($input['status']) && $input['status'] !== 'pending_review') {
        $curStmt = $db->prepare('SELECT assignee_id, status FROM tasks WHERE id = ? LIMIT 1');
        $curStmt->execute([$id]);
        $curRow = $curStmt->fetch();

        if ($curRow && $curRow['status'] === 'pending_review') {
            if (!in_array($role, ['HR', 'Admin', 'Reporting Manager'], true)) {
                json_error('Only HR, Admin, or a Reporting Manager can approve task requests.', 403);
            }
            if ($role === 'Reporting Manager') {
                $assigneeStmt = $db->prepare('SELECT reporting_manager_id FROM employees WHERE id = ? LIMIT 1');
                $assigneeStmt->execute([$curRow['assignee_id']]);
                $assignee = $assigneeStmt->fetch();
                if (!$assignee || $assignee['reporting_manager_id'] !== $myId) {
                    json_error('You can only approve requests for your direct reports.', 403);
                }
            }
        }
    }
    $setClauses = [];
    $values = [];

    $fieldMap = [
        'title' => 'title',
        'description' => 'description',
        'dueDate' => 'due_date',
        'priority' => 'priority',
        'status' => 'status',
        'completedAt' => 'completed_at',
        'pointsProcessed' => 'points_processed',
        'isOverdueSwept' => 'is_overdue_swept',
    ];
    foreach ($fieldMap as $jsKey => $col) {
        if (array_key_exists($jsKey, $input)) {
            $val = $input[$jsKey];
            $setClauses[] = "$col = ?";
            $values[] = is_bool($val) ? (int)$val : $val;
        }
    }
    if (array_key_exists('checklist', $input)) {
        $setClauses[] = 'checklist = ?';
        $values[] = json_encode($input['checklist']);
    }
    if (array_key_exists('comments', $input)) {
        $setClauses[] = 'comments = ?';
        $values[] = json_encode($input['comments']);
    }
    if (array_key_exists('attachments', $input)) {
        $setClauses[] = 'attachments = ?';
        $values[] = json_encode($input['attachments']);
    }

    if (!empty($setClauses)) {
        $values[] = $id;
        $sql = 'UPDATE tasks SET ' . implode(', ', $setClauses) . ' WHERE id = ?';
        $db->prepare($sql)->execute($values);
    }

    $fetch = $db->prepare('SELECT * FROM tasks WHERE id = ? LIMIT 1');
    $fetch->execute([$id]);
    $row = $fetch->fetch();
    if (!$row) json_error('Task not found.', 404);
    json_ok(rowToTask($row));
}

if ($method === 'DELETE') {
    if (!$id) json_error('Task ID required.', 400);

    $taskStmt = $db->prepare('SELECT assignee_id, status FROM tasks WHERE id = ? LIMIT 1');
    $taskStmt->execute([$id]);
    $taskRow = $taskStmt->fetch();
    if (!$taskRow) json_error('Task not found.', 404);

    $canDelete = in_array($role, ['HR', 'Admin'], true);

    // Task requests (status pending_review) are a special case: the employee who
    // requested it can cancel it, and their Reporting Manager can reject it.
    if (!$canDelete && $taskRow['status'] === 'pending_review') {
        if ($taskRow['assignee_id'] === $myId) {
            $canDelete = true;
        } elseif ($role === 'Reporting Manager') {
            $assigneeStmt = $db->prepare('SELECT reporting_manager_id FROM employees WHERE id = ? LIMIT 1');
            $assigneeStmt->execute([$taskRow['assignee_id']]);
            $assignee = $assigneeStmt->fetch();
            if ($assignee && $assignee['reporting_manager_id'] === $myId) {
                $canDelete = true;
            }
        }
    }

    if (!$canDelete) json_error('Not authorized to delete this task.', 403);

    $db->prepare('DELETE FROM tasks WHERE id = ?')->execute([$id]);
    json_ok(['success' => true]);
}

json_error("Method not allowed: {$method}", 405);
