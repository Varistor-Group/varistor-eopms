<?php
/**
 * POST /api/activity
 * Body: { action, details?, metadata? }
 * performed_by is always the authenticated employee — never trusts a
 * client-supplied identity, same hardening pattern applied elsewhere.
 */

$db = get_db();
$myId = currentEmployeeId();
if ($myId === null) json_error('Unauthorized', 401);

if ($method !== 'POST') json_error("Method not allowed: {$method}", 405);

function generateUuidV4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

$input = request_body();
$action = $input['action'] ?? '';
$details = $input['details'] ?? '';
$metadata = $input['metadata'] ?? [];
if ($action === '') json_error('action is required.', 422);

$db->prepare('INSERT INTO activity_log (id, action, performed_by, details, metadata) VALUES (?, ?, ?, ?, ?)')
   ->execute([generateUuidV4(), $action, $myId, $details, json_encode($metadata)]);

json_ok(['success' => true]);