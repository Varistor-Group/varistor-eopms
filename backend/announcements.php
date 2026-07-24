<?php
/**
 * GET    /api/announcements                — list, with computed reactions/isRead for caller
 * POST   /api/announcements                — create (HR/Admin only)
 * DELETE /api/announcements/:id             — delete (HR/Admin only)
 * POST   /api/announcements/:id/react       — toggle a reaction (any authenticated, own only)
 * POST   /api/announcements/:id/read        — mark as read (any authenticated, own only)
 */

$db = get_db();
$id = $params['id'] ?? null;
$action = $params['action'] ?? null; // 'react' or 'read', set by route regex

const EMOJIS = ['👍', '❤️', '🎉', '💵', '🎂'];

function buildAnnouncementDTOs($db, $userId) {
    $anns = $db->query('SELECT * FROM announcements ORDER BY created_at DESC')->fetchAll();
    $reactions = $db->query('SELECT * FROM announcement_reactions')->fetchAll();
    $readsStmt = $db->prepare('SELECT * FROM announcement_reads WHERE user_id = ?');
    $readsStmt->execute([$userId]);
    $reads = $readsStmt->fetchAll();

    $result = [];
    foreach ($anns as $ann) {
        $annReactions = array_filter($reactions, fn($r) => $r['announcement_id'] === $ann['id']);
        $counts = [];
        $userReacted = [];
        foreach ($annReactions as $r) {
            $counts[$r['emoji_type']] = ($counts[$r['emoji_type']] ?? 0) + 1;
            if ($r['user_id'] === $userId) $userReacted[$r['emoji_type']] = true;
        }
        $uniqueEmojis = array_unique(array_merge(EMOJIS, array_keys($counts)));
        $isRead = false;
        foreach ($reads as $r) {
            if ($r['announcement_id'] === $ann['id']) { $isRead = true; break; }
        }

        $reactionsList = [];
        foreach ($uniqueEmojis as $emoji) {
            $reactionsList[] = [
                'emoji' => $emoji,
                'count' => $counts[$emoji] ?? 0,
                'reactedByUser' => isset($userReacted[$emoji]),
            ];
        }

        $result[] = array_merge($ann, [
            'reactions' => $reactionsList,
            'isRead' => $isRead,
        ]);
    }
    return $result;
}

$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

if ($method === 'GET') {
    json_ok(buildAnnouncementDTOs($db, $myId));
}

if ($method === 'POST' && $action === 'react') {
    $input = request_body();
    $emojiType = $input['emojiType'] ?? '';
    if ($emojiType === '') json_error('emojiType is required.', 422);

    $find = $db->prepare('SELECT id FROM announcement_reactions WHERE announcement_id = ? AND user_id = ? AND emoji_type = ? LIMIT 1');
    $find->execute([$id, $myId, $emojiType]);
    $existing = $find->fetch();

    if ($existing) {
        $db->prepare('DELETE FROM announcement_reactions WHERE id = ?')->execute([$existing['id']]);
    } else {
        $newId = bin2hex(random_bytes(16));
        $db->prepare('INSERT INTO announcement_reactions (id, announcement_id, user_id, emoji_type) VALUES (?, ?, ?, ?)')
           ->execute([$newId, $id, $myId, $emojiType]);
    }

    json_ok(buildAnnouncementDTOs($db, $myId));
}

if ($method === 'POST' && $action === 'read') {
    $find = $db->prepare('SELECT id FROM announcement_reads WHERE announcement_id = ? AND user_id = ? LIMIT 1');
    $find->execute([$id, $myId]);
    if (!$find->fetch()) {
        $newId = bin2hex(random_bytes(16));
        $db->prepare('INSERT INTO announcement_reads (id, announcement_id, user_id) VALUES (?, ?, ?)')
           ->execute([$newId, $id, $myId]);
    }

    json_ok(buildAnnouncementDTOs($db, $myId));
}

if ($method === 'POST' && $id === null) {
    requireRole(['HR', 'Admin']);
    $input = request_body();

    if (($input['type'] ?? '') === 'Birthday') {
        $todayStart = date('Y-m-d 00:00:00');
        $dupCheck = $db->prepare('SELECT id FROM announcements WHERE type = ? AND title = ? AND created_at >= ? LIMIT 1');
        $dupCheck->execute(['Birthday', $input['title'] ?? '', $todayStart]);
        if ($dupCheck->fetch()) {
            json_ok(buildAnnouncementDTOs($db, $myId));
        }
    }

    $newId = bin2hex(random_bytes(16));
    $db->prepare('INSERT INTO announcements (id, title, content, author_role, type) VALUES (?, ?, ?, ?, ?)')
       ->execute([$newId, $input['title'] ?? '', $input['content'] ?? '', $input['author_role'] ?? '', $input['type'] ?? 'Standard']);

    // Auto mark as read for creator
    $readId = bin2hex(random_bytes(16));
    $db->prepare('INSERT INTO announcement_reads (id, announcement_id, user_id) VALUES (?, ?, ?)')
       ->execute([$readId, $newId, $myId]);

    json_ok(buildAnnouncementDTOs($db, $myId));
}

if ($method === 'DELETE') {
    requireRole(['HR', 'Admin']);
    $db->prepare('DELETE FROM announcements WHERE id = ?')->execute([$id]);
    json_ok(buildAnnouncementDTOs($db, $myId));
}

json_error("Method not allowed: {$method}", 405);