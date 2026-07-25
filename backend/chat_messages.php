<?php
/**
 * GET    /api/chat/messages/:channelId       — fetch messages for a channel
 * POST   /api/chat/messages                  — send a message
 * PUT    /api/chat/messages/:id              — edit message text
 * DELETE /api/chat/messages/:id              — delete a message
 * POST   /api/chat/messages/:id/react        — toggle a reaction (swap/clear like WhatsApp)
 * POST   /api/chat/channels/:channelId/read  — mark channel read
 * GET    /api/chat/unread                    — unread summary (total + byChannel)
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

$channelId = $params['channelId'] ?? null;
$id = $params['id'] ?? null;

function rowToMessage($row, $myId) {
    return [
        'id' => $row['id'],
        'channelId' => $row['channel_id'],
        'authorId' => $row['author_id'],
        'authorName' => $row['author_name'] ?? '',
        'authorRole' => $row['author_role'] ?? '',
        'authorAvatar' => $row['author_avatar'] ?? '',
        'isSelf' => $row['author_id'] === $myId,
        'text' => $row['text'],
        'attachment' => $row['attachment_name'] ? [
            'name' => $row['attachment_name'],
            'size' => $row['attachment_size'],
            'type' => $row['attachment_type'],
        ] : null,
        'edited' => (bool)$row['edited'],
        'timestamp' => $row['created_at'],
        'reactions' => $row['reactions'] ?? [],
    ];
}

// GET /api/chat/messages/:channelId
if ($method === 'GET' && $channelId !== null) {
    $stmt = $db->prepare(
        'SELECT m.*, e.full_name AS author_name, e.role AS author_role, e.avatar_url AS author_avatar
         FROM chat_messages m
         JOIN employees e ON e.id = m.author_id
         WHERE m.channel_id = ?
         ORDER BY m.created_at ASC'
    );
    $stmt->execute([$channelId]);
    $messages = $stmt->fetchAll();

    if (!empty($messages)) {
        $ids = array_column($messages, 'id');
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $reactStmt = $db->prepare("SELECT r.*, e.full_name FROM chat_reactions r JOIN employees e ON e.id = r.employee_id WHERE r.message_id IN ($placeholders)");
        $reactStmt->execute($ids);
        $allReactions = $reactStmt->fetchAll();

        foreach ($messages as &$m) {
            $m['reactions'] = array_values(array_map(
                fn($r) => ['emoji' => $r['emoji'], 'userName' => $r['full_name']],
                array_filter($allReactions, fn($r) => $r['message_id'] === $m['id'])
            ));
        }
        unset($m);
    }

    json_ok(array_map(fn($m) => rowToMessage($m, $myId), $messages));
}

// GET /api/chat/unread
if ($method === 'GET' && $channelId === null && $id === null) {
    $channels = $db->query('SELECT id FROM chat_channels')->fetchAll();
    $readsStmt = $db->prepare('SELECT channel_id, last_read_at FROM chat_reads WHERE employee_id = ?');
    $readsStmt->execute([$myId]);
    $reads = [];
    foreach ($readsStmt->fetchAll() as $r) $reads[$r['channel_id']] = $r['last_read_at'];

    $byChannel = [];
    $total = 0;
    foreach ($channels as $c) {
        $lastRead = $reads[$c['id']] ?? '1970-01-01 00:00:00';
        $countStmt = $db->prepare('SELECT COUNT(*) AS cnt FROM chat_messages WHERE channel_id = ? AND author_id != ? AND created_at > ?');
        $countStmt->execute([$c['id'], $myId, $lastRead]);
        $unread = (int)$countStmt->fetch()['cnt'];
        if ($unread > 0) {
            $byChannel[$c['id']] = $unread;
            $total += $unread;
        }
    }
    json_ok(['total' => $total, 'byChannel' => $byChannel]);
}

// POST /api/chat/messages
if ($method === 'POST' && $channelId === null && $id === null) {
    $input = request_body();
    $chId = $input['channelId'] ?? '';
    if ($chId === '') json_error('channelId is required.', 422);

    $msgId = bin2hex(random_bytes(16));
    $attachment = $input['attachment'] ?? null;

    $db->prepare(
        'INSERT INTO chat_messages (id, channel_id, author_id, text, attachment_name, attachment_size, attachment_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $msgId, $chId, $myId,
        $input['text'] ?? null,
        $attachment['name'] ?? null,
        $attachment['size'] ?? null,
        $attachment['type'] ?? null,
    ]);

    // Auto mark-read for sender
    $db->prepare('INSERT INTO chat_reads (channel_id, employee_id, last_read_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE last_read_at = NOW()')
       ->execute([$chId, $myId]);

    $fetch = $db->prepare(
        'SELECT m.*, e.full_name AS author_name, e.role AS author_role, e.avatar_url AS author_avatar
         FROM chat_messages m JOIN employees e ON e.id = m.author_id WHERE m.id = ? LIMIT 1'
    );
    $fetch->execute([$msgId]);
    $row = $fetch->fetch();
    $row['reactions'] = [];
    json_ok(['success' => true, 'message' => rowToMessage($row, $myId)]);
}

// PUT /api/chat/messages/:id
if ($method === 'PUT' && $id !== null) {
    $input = request_body();
    $text = $input['text'] ?? '';
    $db->prepare('UPDATE chat_messages SET text = ?, edited = 1 WHERE id = ? AND author_id = ?')
       ->execute([$text, $id, $myId]);
    json_ok(['success' => true]);
}

// DELETE /api/chat/messages/:id
if ($method === 'DELETE' && $id !== null) {
    $db->prepare('DELETE FROM chat_messages WHERE id = ? AND author_id = ?')->execute([$id, $myId]);
    json_ok(['success' => true]);
}

// POST /api/chat/messages/:id/react
if ($method === 'POST' && $id !== null && isset($params['action']) && $params['action'] === 'react') {
    $input = request_body();
    $emoji = $input['emoji'] ?? '';
    if ($emoji === '') json_error('emoji is required.', 422);

    $find = $db->prepare('SELECT id, emoji FROM chat_reactions WHERE message_id = ? AND employee_id = ? LIMIT 1');
    $find->execute([$id, $myId]);
    $existing = $find->fetch();

    if ($existing && $existing['emoji'] === $emoji) {
        $db->prepare('DELETE FROM chat_reactions WHERE id = ?')->execute([$existing['id']]);
    } elseif ($existing) {
        $db->prepare('UPDATE chat_reactions SET emoji = ? WHERE id = ?')->execute([$emoji, $existing['id']]);
    } else {
        $rId = bin2hex(random_bytes(16));
        $db->prepare('INSERT INTO chat_reactions (id, message_id, employee_id, emoji) VALUES (?, ?, ?, ?)')
           ->execute([$rId, $id, $myId, $emoji]);
    }
    json_ok(['success' => true]);
}

// POST /api/chat/channels/:channelId/read
if ($method === 'POST' && $channelId !== null) {
    $db->prepare('INSERT INTO chat_reads (channel_id, employee_id, last_read_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE last_read_at = NOW()')
       ->execute([$channelId, $myId]);
    json_ok(['success' => true]);
}

json_error("Method not allowed: {$method}", 405);