<?php
/**
 * EOPMS PHP Backend — Main Router
 * All requests arrive here via .htaccess rewrite.
 * Dispatches to handler files based on method + path.
 */

require_once __DIR__ . '/vendor/autoload.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/helpers.php';

// Apply CORS on every request
cors_headers();

// ── Parse path ───────────────────────────────────────────────────────────────
// Strip script directory prefix so this works whether deployed at /  or /eopms-api/
$scriptDir   = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
$requestUri  = $_SERVER['REQUEST_URI'];
$path        = parse_url($requestUri, PHP_URL_PATH);

if ($scriptDir !== '' && strpos($path, $scriptDir) === 0) {
    $path = substr($path, strlen($scriptDir));
}
$path   = '/' . ltrim($path, '/');
$method = $_SERVER['REQUEST_METHOD'];

// ── Route table ───────────────────────────────────────────────────────────────
// Format: [METHOD, regex pattern, handler file]
$routes = [
    // Email
    ['POST', '#^/api/send-credentials$#',          'send_credentials.php'],
    ['POST', '#^/api/send-password-reset$#',        'send_password_reset.php'],
    ['GET',  '#^/api/test-email$#',                 'test_email.php'],
    ['POST', '#^/api/quiz/submit$#',                'quiz_submit.php'],
    ['POST', '#^/api/leave/notify-manager$#',       'leave_notify_manager.php'],
    ['POST', '#^/api/leave/notify-employee$#',      'leave_notify_employee.php'],

    // Payroll
    ['POST', '#^/api/payroll/send-slips$#',         'payroll_send_slips.php'],
    ['GET',  '#^/api/payroll/schedule$#',           'payroll_schedule.php'],
    ['PUT',  '#^/api/payroll/schedule$#',           'payroll_schedule.php'],
    ['POST', '#^/api/payroll/records$#',            'payroll_records.php'],
    ['POST', '#^/api/payroll/trigger-send$#',       'payroll_trigger.php'],

    // Employees
    ['GET',  '#^/api/employees$#',                  'employees.php'],
    ['POST', '#^/api/employees$#',                  'employees.php'],
    ['PUT',  '#^/api/employees/(?P<id>[^/]+)$#',    'employees.php'],
    ['DELETE','#^/api/employees/(?P<id>[^/]+)$#',   'employees.php'],

    // Documents
    ['GET',  '#^/api/documents/(?P<employeeId>[^/]+)$#', 'documents.php'],

    // CL Balances
    ['GET',  '#^/api/cl-balances$#',                'cl_balances.php'],
    ['GET',  '#^/api/cl-balances/(?P<id>[^/]+)$#',  'cl_balances.php'],
    ['PUT',  '#^/api/cl-balances/(?P<id>[^/]+)$#',  'cl_balances.php'],

    // Leaves
    ['GET',  '#^/api/leaves$#',                     'leaves.php'],
    ['POST', '#^/api/leaves$#',                     'leaves.php'],
    ['PUT',  '#^/api/leaves/(?P<id>[^/]+)$#',       'leaves.php'],

    // Activity log
    ['POST', '#^/api/activity$#',                   'activity.php'],

    // Attendance
    ['POST', '#^/api/attendance/export-pdf$#',      'attendance_pdf.php'],
    ['GET',  '#^/api/attendance/live-feed$#',       'attendance_stubs.php'],
    ['GET',  '#^/api/attendance/device-status$#',   'attendance_stubs.php'],
    ['POST', '#^/api/attendance/force-resync$#',    'attendance_stubs.php'],

    // Field Attendance
    ['POST', '#^/api/attendance/field-punch$#',       'field_punch.php'],
    ['GET',  '#^/api/attendance/field-punch/status$#', 'field_punch.php'],
    ['GET',  '#^/api/attendance/field-photos/pending$#', 'field_photos_hr.php'],
    ['POST', '#^/api/attendance/field-photos/verify$#', 'field_photos_hr.php'],
    ['POST', '#^/api/employees/location$#',           'field_locations.php'],
    ['GET',  '#^/api/employees/locations$#',          'field_locations.php'],
    
    // Biometric ADMS
    ['POST', '#^/api/biometric$#',                    'biometric.php'],
];

$params = [];
$matched = false;

foreach ($routes as [$routeMethod, $pattern, $handler]) {
    if ($routeMethod !== $method) continue;
    if (preg_match($pattern, $path, $m)) {
        $params  = $m;   // named capture groups (id, employeeId, etc.)
        $matched = true;
        require __DIR__ . '/' . $handler;
        exit;
    }
}

if (!$matched) {
    json_error("Endpoint not found: {$method} {$path}", 404);
}
