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
$scriptDir   = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
$requestUri  = $_SERVER['REQUEST_URI'];
$path        = parse_url($requestUri, PHP_URL_PATH);

if ($scriptDir !== '' && strpos($path, $scriptDir) === 0) {
    $path = substr($path, strlen($scriptDir));
}
$path   = '/' . ltrim($path, '/');
$method = $_SERVER['REQUEST_METHOD'];

// ── Route table ───────────────────────────────────────────────────────────────
$routes = [
    // Auth
    ['GET',  '#^/api/auth/me$#',                    'me.php'],
    ['POST', '#^/api/auth/update-password$#',       'update_password.php'],
    ['POST', '#^/api/auth/reset-password$#',        'reset_password.php'],
    ['POST', '#^/api/auth/login$#',                 'login.php'],
    // Training
    ['GET',    '#^/api/training-modules$#',                    'training_modules.php'],
    ['POST',   '#^/api/training-modules$#',                    'training_modules.php'],
    ['DELETE', '#^/api/training-modules/(?P<id>[^/]+)$#',      'training_modules.php'],

    ['PUT',    '#^/api/training-progress$#',                   'training_progress.php'],

    ['GET',    '#^/api/quiz-questions/(?P<moduleId>[^/]+)$#',  'quiz_questions.php'],

    ['GET',    '#^/api/quiz-attempts/latest/(?P<moduleId>[^/]+)$#', 'quiz_attempts.php'],
    ['POST',   '#^/api/quiz-attempts$#',                       'quiz_attempts.php'],
    // Attendance Monthly Report
    ['GET', '#^/api/attendance-monthly-report/(?P<month>[^/]+)$#', 'attendance_monthly_report.php'],
    // Attendance Yearly Reports
    ['GET', '#^/api/attendance-yearly-report/(?P<year>[^/]+)/(?P<employeeId>[^/]+)$#', 'attendance_yearly_report.php'],
    ['GET', '#^/api/attendance-yearly-summary/(?P<year>[^/]+)$#',                      'attendance_yearly_summaries.php'],
    // Holidays
    ['GET',    '#^/api/holidays/(?P<year>[^/]+)$#', 'holidays.php'],
    ['POST',   '#^/api/holidays$#',                 'holidays.php'],
    ['DELETE', '#^/api/holidays/(?P<id>[^/]+)$#',   'holidays.php'],
    // Field Attendance
    ['POST', '#^/api/attendance/field-punch$#',          'field_punch.php'],
    ['GET',  '#^/api/attendance/field-punch/status$#',   'field_punch.php'],
    ['GET',  '#^/api/attendance/field-photos/pending$#', 'field_photos_hr.php'],
    ['POST', '#^/api/attendance/field-photos/verify$#',  'field_photos_hr.php'],
    // Email
    ['POST', '#^/api/send-credentials$#',          'send_credentials.php'],
    ['POST', '#^/api/send-password-reset$#',        'send_password_reset.php'],
    ['GET',  '#^/api/test-email$#',                 'test_email.php'],
    ['POST', '#^/api/quiz/submit$#',                'quiz_submit.php'],
    ['POST', '#^/api/leave/notify-manager$#',       'leave_notify_manager.php'],
    ['POST', '#^/api/leave/notify-employee$#',      'leave_notify_employee.php'],

    // Payroll (legacy akash endpoints — kept as-is, still functional)
    ['POST', '#^/api/payroll/send-slips$#',         'payroll_send_slips.php'],
    ['GET',  '#^/api/payroll/schedule$#',           'payroll_schedule.php'],
    ['PUT',  '#^/api/payroll/schedule$#',           'payroll_schedule.php'],
    ['POST', '#^/api/payroll/records$#',            'payroll_records.php'],
    ['POST', '#^/api/payroll/trigger-send$#',       'payroll_trigger.php'],

    // Payroll Records (new MySQL-backed API)
    ['GET',    '#^/api/payroll-records$#',                                'payroll_records.php'],
    ['PUT',    '#^/api/payroll-records/(?P<id>[^/]+)$#',                  'payroll_records.php'],
    ['POST',   '#^/api/payroll-records/(?P<id>[^/]+)/(?P<action>approve)$#',  'payroll_records.php'],
    ['POST',   '#^/api/payroll-records/(?P<id>[^/]+)/(?P<action>revision)$#', 'payroll_records.php'],

    // Payroll Settings (formula/config, replaces localStorage)
    ['GET', '#^/api/payroll-settings$#',                     'payroll_settings.php'],
    ['PUT', '#^/api/payroll-settings/(?P<key>[^/]+)$#',      'payroll_settings.php'],

    // Employees
    ['GET',  '#^/api/employees$#',                  'employees.php'],
    ['POST', '#^/api/employees$#',                  'employees.php'],
    ['PUT',  '#^/api/employees/(?P<id>[^/]+)$#',    'employees.php'],
    ['DELETE','#^/api/employees/(?P<id>[^/]+)$#',   'employees.php'],

   // Documents
    ['GET',    '#^/api/documents/single/(?P<id>[^/]+)$#',      'documents.php'],
    ['GET',    '#^/api/documents/(?P<id>[^/]+)/download$#',    'documents.php'],
    ['PUT',    '#^/api/documents/(?P<id>[^/]+)/status$#',      'documents.php'],
    ['PUT',    '#^/api/documents/(?P<id>[^/]+)$#',             'documents.php'],
    ['POST',   '#^/api/documents$#',                           'documents.php'],
    ['GET',    '#^/api/documents/(?P<employeeId>[^/]+)$#',     'documents.php'],

    // Document Templates
    ['GET',    '#^/api/document-templates$#',                  'document_templates.php'],
    ['POST',   '#^/api/document-templates$#',                  'document_templates.php'],
    ['PUT',    '#^/api/document-templates/(?P<id>[^/]+)$#',    'document_templates.php'],
    ['DELETE', '#^/api/document-templates/(?P<id>[^/]+)$#',    'document_templates.php'],
    // Attendance Edits & Field History
    ['GET', '#^/api/attendance-edits$#',         'attendance_edits.php'],
    ['GET', '#^/api/field-attendance-history$#', 'field_attendance_history.php'],

    // Employee Document Slots
    ['GET',    '#^/api/employee-document-slots-pending-summary$#',                 'employee_document_slots.php'],
    ['POST',   '#^/api/employee-document-slots/(?P<employeeId>[^/]+)/seed$#',      'employee_document_slots.php'],
    ['GET',    '#^/api/employee-document-slots/(?P<employeeId>[^/]+)$#',           'employee_document_slots.php'],
    ['POST',   '#^/api/employee-document-slots$#',                                 'employee_document_slots.php'],
    ['PUT',    '#^/api/employee-document-slots/(?P<id>[^/]+)/link$#',              'employee_document_slots.php'],
    ['PUT',    '#^/api/employee-document-slots/sync/(?P<templateId>[^/]+)$#',      'employee_document_slots.php'],
    ['PUT',    '#^/api/employee-document-slots/(?P<id>[^/]+)$#',                   'employee_document_slots.php'],
    ['DELETE', '#^/api/employee-document-slots/(?P<id>[^/]+)$#',                   'employee_document_slots.php'],

    // CL Balances
    ['GET',  '#^/api/cl-balances$#',                'cl_balances.php'],
    ['GET',  '#^/api/cl-balances/(?P<id>[^/]+)$#',  'cl_balances.php'],
    ['PUT',  '#^/api/cl-balances/(?P<id>[^/]+)$#',  'cl_balances.php'],

    // Leaves
    ['GET',  '#^/api/leaves$#',                     'leaves.php'],
    ['POST', '#^/api/leaves$#',                     'leaves.php'],
    ['PUT',  '#^/api/leaves/(?P<id>[^/]+)$#',       'leaves.php'],
    
    // Attendance Settings
    ['GET', '#^/api/attendance-settings$#',              'attendance_settings.php'],
    ['PUT', '#^/api/attendance-settings/(?P<key>[^/]+)$#', 'attendance_settings.php'],

    // Attendance Self-Punch
    ['POST', '#^/api/attendance/punch$#',        'attendance_punch.php'],
    ['GET',  '#^/api/attendance/punch/status$#', 'attendance_punch.php'],
    
    // Leave Types
    ['GET',    '#^/api/leave-types$#',                    'leave_types.php'],
    ['POST',   '#^/api/leave-types$#',                    'leave_types.php'],
    ['DELETE', '#^/api/leave-types/(?P<id>[^/]+)$#',      'leave_types.php'],

    // Employee Leave Balances
    ['GET', '#^/api/employee-leave-balances$#',                       'employee_leave_balances.php'],
    ['GET', '#^/api/employee-leave-balances/(?P<employeeId>[^/]+)$#', 'employee_leave_balances.php'],
    ['PUT', '#^/api/employee-leave-balances/(?P<employeeId>[^/]+)$#', 'employee_leave_balances.php'],

    // Policies
    ['GET',    '#^/api/policies$#',                 'policies.php'],
    ['POST',   '#^/api/policies$#',                 'policies.php'],
    ['PUT',    '#^/api/policies/(?P<id>[^/]+)$#',   'policies.php'],
    ['DELETE', '#^/api/policies/(?P<id>[^/]+)$#',   'policies.php'],

    // Tasks
    ['GET',    '#^/api/tasks$#',                 'tasks.php'],
    ['POST',   '#^/api/tasks$#',                 'tasks.php'],
    ['PUT',    '#^/api/tasks/(?P<id>[^/]+)$#',   'tasks.php'],
    ['DELETE', '#^/api/tasks/(?P<id>[^/]+)$#',   'tasks.php'],

    // Chat
    ['GET',    '#^/api/chat/channels$#',                                'chat_channels.php'],
    ['POST',   '#^/api/chat/channels$#',                                'chat_channels.php'],
    ['PUT',    '#^/api/chat/channels/(?P<id>[^/]+)$#',                  'chat_channels.php'],
    ['DELETE', '#^/api/chat/channels/(?P<id>[^/]+)$#',                  'chat_channels.php'],
    ['POST',   '#^/api/chat/channels/(?P<channelId>[^/]+)/read$#',      'chat_messages.php'],

    ['GET',    '#^/api/chat/unread$#',                                  'chat_messages.php'],
    ['GET',    '#^/api/chat/messages/(?P<channelId>[^/]+)$#',           'chat_messages.php'],
    ['POST',   '#^/api/chat/messages$#',                                'chat_messages.php'],
    ['PUT',    '#^/api/chat/messages/(?P<id>[^/]+)$#',                  'chat_messages.php'],
    ['DELETE', '#^/api/chat/messages/(?P<id>[^/]+)$#',                  'chat_messages.php'],
    ['POST',   '#^/api/chat/messages/(?P<id>[^/]+)/(?P<action>react)$#','chat_messages.php'],

    // Announcements
    ['GET',    '#^/api/announcements$#',                                 'announcements.php'],
    ['POST',   '#^/api/announcements$#',                                 'announcements.php'],
    ['DELETE', '#^/api/announcements/(?P<id>[^/]+)$#',                   'announcements.php'],
    ['POST',   '#^/api/announcements/(?P<id>[^/]+)/(?P<action>react)$#', 'announcements.php'],
    ['POST',   '#^/api/announcements/(?P<id>[^/]+)/(?P<action>read)$#',  'announcements.php'],

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
        $params  = $m;
        $matched = true;
        require __DIR__ . '/' . $handler;
        exit;
    }
}

if (!$matched) {
    json_error("Endpoint not found: {$method} {$path}", 404);
}