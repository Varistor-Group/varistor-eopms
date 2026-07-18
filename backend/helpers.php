<?php
/**
 * EOPMS PHP Backend — Shared Helpers
 * Included by index.php before dispatching to handlers.
 */

// ── CORS ──────────────────────────────────────────────────────────────────────
function cors_headers(): void {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
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

// ── db.json CRUD ──────────────────────────────────────────────────────────────
function read_db(): array {
    if (!file_exists(DB_PATH)) {
        return ['employees' => [], 'documents' => [], 'activity_log' => [],
                'leaves' => [], 'payroll_records' => [], 'employee_cl_balances' => []];
    }
    $raw = file_get_contents(DB_PATH);
    return json_decode($raw, true) ?? [];
}

function write_db(array $data): void {
    file_put_contents(DB_PATH, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
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

// ── Supabase Admin REST call (cURL) ───────────────────────────────────────────
function supabase_admin_post(string $endpoint, array $payload): array {
    $url = rtrim(SUPABASE_URL, '/') . $endpoint;
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'apikey: '         . SUPABASE_SERVICE_ROLE_KEY,
            'Authorization: Bearer ' . SUPABASE_SERVICE_ROLE_KEY,
        ],
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT        => 15,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $json = json_decode($body, true) ?? [];
    $json['__http_code'] = $code;
    return $json;
}

function supabase_admin_get(string $endpoint): array {
    $url = rtrim(SUPABASE_URL, '/') . $endpoint;
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPGET        => true,
        CURLOPT_HTTPHEADER     => [
            'apikey: '         . SUPABASE_SERVICE_ROLE_KEY,
            'Authorization: Bearer ' . SUPABASE_SERVICE_ROLE_KEY,
        ],
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT        => 15,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $json = json_decode($body, true) ?? [];
    if (!is_array($json)) $json = ['raw' => $body];
    $json['__http_code'] = $code;
    return $json;
}

function supabase_admin_patch(string $endpoint, array $payload): array {
    $url = rtrim(SUPABASE_URL, '/') . $endpoint;
    $ch  = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => 'PATCH',
        CURLOPT_POSTFIELDS     => json_encode($payload),
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'apikey: '         . SUPABASE_SERVICE_ROLE_KEY,
            'Authorization: Bearer ' . SUPABASE_SERVICE_ROLE_KEY,
        ],
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT        => 15,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $json = json_decode($body, true) ?? [];
    if (!is_array($json)) $json = ['raw' => $body];
    $json['__http_code'] = $code;
    return $json;
}
