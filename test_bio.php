<?php
// Mock server environment
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['SCRIPT_NAME'] = '/eopms-api/index.php';
$_SERVER['REQUEST_URI'] = '/api/biometric';

// Override file_get_contents to return our mock JSON when called with php://input
$_POST = [
    'device_id' => 'D01-TEST',
    'user_id'   => 'VAR-003',
    'time'      => date('Y-m-d H:i:s'),
    'type'      => '0'
];

require_once __DIR__ . '/php-backend/vendor/autoload.php';
require_once __DIR__ . '/php-backend/config.php';
require_once __DIR__ . '/php-backend/helpers.php';

require __DIR__ . '/php-backend/biometric.php';
