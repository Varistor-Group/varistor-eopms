<?php
/**
 * EOPMS PHP Backend — Real Credentials
 * Generated from config.example.php — DO NOT COMMIT.
 */

// ── SMTP ──────────────────────────────────────────────────────────────────────
define('SMTP_HOST',   'mail.varistor.in');
define('SMTP_PORT',   587);
define('SMTP_SECURE', 'tls');
define('SMTP_USER',   'eopms@varistor.in');
define('SMTP_PASS',   'Vtpl231!@#');
define('SMTP_FROM',   'eopms@varistor.in');
define('SMTP_NAME',   'Varistor EOPMS');

// ── App URL ───────────────────────────────────────────────────────────────────
define('APP_URL',     'https://eopms.ytbhai.com');

// ── MySQL ─────────────────────────────────────────────────────────────────────
define('DB_HOST', 'localhost');
define('DB_NAME', 'adminbhai_eopmsdata');
define('DB_USER', 'REPLACE_WITH_YOUR_MYSQL_USERNAME');
define('DB_PASS', 'REPLACE_WITH_YOUR_MYSQL_PASSWORD');

// ── db.json path (legacy — safe to remove once all handlers confirmed off it) ──
define('DB_PATH', __DIR__ . '/db.json');