<?php
/**
 * EOPMS PHP Backend — Credentials Template
 * Copy this file to config.php and fill in real values.
 * config.php is gitignored and must NEVER be committed.
 */

// ── SMTP (cPanel mail server) ─────────────────────────────────────────────────
define('SMTP_HOST',   'mail.yourdomain.com');
define('SMTP_PORT',   587);
define('SMTP_SECURE', 'tls');   // 'tls' for 587, 'ssl' for 465
define('SMTP_USER',   'eopms@yourdomain.com');
define('SMTP_PASS',   'your-email-password');
define('SMTP_FROM',   'eopms@yourdomain.com');
define('SMTP_NAME',   'Varistor EOPMS');

// ── App URL (used in email links) ─────────────────────────────────────────────
define('APP_URL',     'https://yourdomain.com');

// ── Supabase Admin (server-side only — never expose to browser) ───────────────
define('SUPABASE_URL',              'https://your-project-ref.supabase.co');
define('SUPABASE_SERVICE_ROLE_KEY', 'your-service-role-key');

// ── Path to db.json (absolute server path) ────────────────────────────────────
// On cPanel this is typically: /home/yourusername/public_html/eopms-api/db.json
// Keep db.json in the same folder — it is protected from HTTP access via .htaccess
define('DB_PATH', __DIR__ . '/db.json');
