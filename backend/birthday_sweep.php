<?php
/**
 * backend/birthday_sweep.php
 * GET /api/announcements/birthday-sweep?key=...
 *
 * Meant to be triggered once daily by a cron job — NOT by a logged-in user,
 * so it doesn't use currentEmployeeId() session auth. Protected by a shared
 * secret key, same pattern as overdue_sweep.php.
 *
 * Previously, birthday announcements only got created client-side (in
 * App.tsx) when the birthday employee themselves happened to log in that
 * day — so if they didn't log in, nothing was ever posted. This sweep makes
 * it actually automatic: for every employee whose date_of_birth matches
 * today's month/day, create a Birthday announcement if one doesn't already
 * exist for them today (same dedup rule already used in announcements.php).
 */

const BIRTHDAY_SWEEP_KEY = 'QHP-R_k0CvGSrNWFsBRQjbNH4aTFilSI1ybY0J0T98E';

if (($_GET['key'] ?? '') !== BIRTHDAY_SWEEP_KEY) {
    json_error('Forbidden', 403);
}

$db = get_db();

$birthdayEmployees = $db->query(
    "SELECT id, full_name FROM employees
     WHERE date_of_birth IS NOT NULL
       AND MONTH(date_of_birth) = MONTH(CURDATE())
       AND DAY(date_of_birth) = DAY(CURDATE())
       AND status = 'Active'"
)->fetchAll();

$todayStart = date('Y-m-d 00:00:00');
$dupCheckStmt = $db->prepare('SELECT id FROM announcements WHERE type = ? AND title = ? AND created_at >= ? LIMIT 1');
$insertStmt = $db->prepare('INSERT INTO announcements (id, title, content, author_role, type) VALUES (?, ?, ?, ?, ?)');

$created = 0;
$skipped = 0;

foreach ($birthdayEmployees as $emp) {
    $title = "🎂 Happy Birthday, {$emp['full_name']}!";

    $dupCheckStmt->execute(['Birthday', $title, $todayStart]);
    if ($dupCheckStmt->fetch()) {
        $skipped++;
        continue;
    }

    $newId = bin2hex(random_bytes(16));
    $insertStmt->execute([
        $newId,
        $title,
        'Join us in wishing them the happiest of birthdays! 🎉',
        'Admin',
        'Birthday',
    ]);
    $created++;
}

json_ok([
    'success' => true,
    'birthdaysToday' => count($birthdayEmployees),
    'announcementsCreated' => $created,
    'alreadyExisted' => $skipped,
]);
