<?php
/**
 * EOPMS PHP Backend — Shared Helpers
 * Included by index.php before dispatching to handlers.
 *
 * MIGRATION NOTE: Supabase forwarding functions (supabase_admin_post/get/patch)
 * have been removed and replaced with a direct MySQL (PDO) connection, plus
 * the access-control helpers that replace Postgres RLS (see
 * rls_to_php_mapping.md / rls_to_php_mapping_remaining7.md).
 *
 * AUTH NOTE: currentEmployeeId() / currentUserRole() below use a PLACEHOLDER
 * mechanism (an X-Employee-Id request header) until Task 2 (Authentication)
 * builds real login/session/token handling. Everything calling these two
 * functions does not need to change when Task 2 lands — only the internals
 * of these two functions do.
 */

// ── CORS ──────────────────────────────────────────────────────────────────────
function cors_headers(): void {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Employee-Id');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

// ── JSON helpers ─────────────────────────────────────────────────────────────
function json_ok(array $data = [], int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $message, int $code = 400): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => $message]);
    exit;
}

function request_body(): array {
    $raw = file_get_contents('php://input');
    return json_decode($raw, true) ?? [];
}

// ── MySQL connection ──────────────────────────────────────────────────────────
// Expects DB_HOST, DB_NAME, DB_USER, DB_PASS constants defined in config.php,
// the same place SUPABASE_URL / SMTP_HOST etc. currently live.
function get_db(): \PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new \PDO($dsn, DB_USER, DB_PASS, [
            \PDO::ATTR_ERRMODE            => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
            \PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

// ── Access control (replaces Postgres RLS — see mapping docs) ────────────────
// PLACEHOLDER auth: reads the calling employee's id from a request header.
// Task 2 replaces the body of currentEmployeeId() with real session/JWT
// validation; currentUserRole() and requireRole() do not need to change.
function currentEmployeeId(): ?string {
    static $id = null;
    static $resolved = false;
    if ($resolved) return $id;
    $resolved = true;

    $headers = getallheaders();
    $raw = $headers['X-Employee-Id'] ?? $headers['x-employee-id'] ?? null;
    $id = $raw !== null && $raw !== '' ? $raw : null;
    return $id;
}

function currentUserRole(): ?string {
    static $role = null;
    static $resolved = false;
    if ($resolved) return $role;
    $resolved = true;

    $empId = currentEmployeeId();
    if ($empId === null) return null;

    $stmt = get_db()->prepare('SELECT role FROM employees WHERE id = ? LIMIT 1');
    $stmt->execute([$empId]);
    $row = $stmt->fetch();
    $role = $row['role'] ?? null;
    return $role;
}

// Call at the top of an endpoint to require one of the given roles.
// e.g. requireRole(['HR', 'Admin']);
function requireRole(array $allowedRoles): void {
    $role = currentUserRole();
    if ($role === null) {
        json_error('Unauthorized', 401);
    }
    if (!in_array($role, $allowedRoles, true)) {
        json_error('Forbidden', 403);
    }
}

// Call when an endpoint's rule is "own record, or one of these roles".
// e.g. requireOwnOrRole($row['employee_id'], ['HR', 'Admin']);
function requireOwnOrRole(?string $ownerEmployeeId, array $allowedRoles): void {
    $myId = currentEmployeeId();
    if ($myId === null) {
        json_error('Unauthorized', 401);
    }
    $role = currentUserRole();
    if ($ownerEmployeeId === $myId) return;
    if (in_array($role, $allowedRoles, true)) return;
    json_error('Forbidden', 403);
}

// ── PHPMailer factory ─────────────────────────────────────────────────────────
function make_mailer(): \PHPMailer\PHPMailer\PHPMailer {
    $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
    $mail->isSMTP();
    $mail->Host       = SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = SMTP_USER;
    $mail->Password   = SMTP_PASS;
    $mail->Port       = SMTP_PORT;
    $mail->SMTPSecure = SMTP_SECURE === 'ssl'
        ? \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS
        : \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
    $mail->SMTPOptions = ['ssl' => ['verify_peer' => false, 'verify_peer_name' => false, 'allow_self_signed' => true]];
    $mail->CharSet    = 'UTF-8';
    $mail->setFrom(SMTP_FROM, SMTP_NAME);
    $mail->isHTML(true);
    return $mail;
}

// ── Number to Indian words (mirrors Node version) ─────────────────────────────
function number_to_words(float $num): string {
    if ($num == 0) return 'Rupees Zero Only';

    $singles  = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    $doubles  = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
                  'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    $tens     = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    $twoDigits = function (int $n) use ($singles, $doubles, $tens): string {
        if ($n < 10)  return $singles[$n];
        if ($n < 20)  return $doubles[$n - 10];
        $u = $n % 10; $t = intdiv($n, 10);
        return $tens[$t] . ($u ? '-' . $singles[$u] : '');
    };

    $threeDigits = function (int $n) use ($singles, $twoDigits): string {
        $h = intdiv($n, 100); $r = $n % 100;
        $str = $h ? $singles[$h] . ' Hundred' : '';
        if ($r) { $str .= ($str ? ' and ' : '') . $twoDigits($r); }
        return $str;
    };

    $parts    = number_format($num, 2, '.', '');
    [$rupeesStr, $paiseStr2] = explode('.', $parts);
    $rupees   = (int) $rupeesStr;
    $paise    = (int) $paiseStr2;

    $result = '';
    $crores = intdiv($rupees, 10000000); $rupees %= 10000000;
    $lakhs  = intdiv($rupees, 100000);  $rupees %= 100000;
    $thous  = intdiv($rupees, 1000);    $rupees %= 1000;

    if ($crores) $result .= $threeDigits($crores) . ' Crore ';
    if ($lakhs)  $result .= $twoDigits($lakhs)    . ' Lakh ';
    if ($thous)  $result .= $twoDigits($thous)    . ' Thousand ';
    if ($rupees) $result .= $threeDigits($rupees);

    $paiseWords = $paise > 0 ? ' and ' . $twoDigits($paise) . ' Paise' : '';
    return 'Rupees ' . trim($result) . $paiseWords . ' Only';
}