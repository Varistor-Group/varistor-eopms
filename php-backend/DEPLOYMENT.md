# Varistor EOPMS — PHP Backend Deployment Guide

## Overview
The `php-backend/` folder replaces `server.js` entirely.
Upload it to cPanel and point `VITE_API_URL` to it.

---

## Prerequisites
- cPanel hosting with PHP ≥ 7.4
- SSH / Terminal access in cPanel (for Composer)
- FileZilla (or cPanel File Manager) for upload
- The `mod_rewrite` Apache module (enabled on most cPanel hosts)

---

## Step 1 — Upload files

Upload the entire `php-backend/` folder to your cPanel server, for example:

```
public_html/eopms-api/
```

**Do NOT upload:**
- `config.php` (you'll create this manually on the server)
- `vendor/` (you'll run Composer on the server)

Upload everything else including `.htaccess`, `db.json`, `composer.json`.

---

## Step 2 — Create config.php on the server

In cPanel File Manager, create `public_html/eopms-api/config.php` from the template:

```php
<?php
define('SMTP_HOST',   'mail.varistor.in');
define('SMTP_PORT',   587);
define('SMTP_SECURE', 'tls');
define('SMTP_USER',   'eopms@varistor.in');
define('SMTP_PASS',   'YourActualPassword');
define('SMTP_FROM',   'eopms@varistor.in');
define('SMTP_NAME',   'Varistor EOPMS');
define('APP_URL',     'https://yourdomain.com');
define('SUPABASE_URL',              'https://vghttoqhflmbjztsphjy.supabase.co');
define('SUPABASE_SERVICE_ROLE_KEY', 'your-service-role-key');
define('DB_PATH', __DIR__ . '/db.json');
```

> ⚠️ Never commit `config.php` — it is in `.gitignore`.

---

## Step 3 — Install Composer dependencies

Open cPanel **Terminal** (or SSH):

```bash
cd ~/public_html/eopms-api
curl -sS https://getcomposer.org/installer | php
php composer.phar install --no-dev --optimize-autoloader
```

This installs PHPMailer and TCPDF into `vendor/`.

---

## Step 4 — Set permissions

```bash
chmod 644 db.json
chmod 644 config.php
chmod 755 vendor/
```

---

## Step 5 — Test SMTP

Visit in your browser:

```
https://yourdomain.com/eopms-api/api/test-email
```

Expected response:
```json
{"success": true, "message": "Test email sent to eopms@varistor.in"}
```

---

## Step 6 — Update frontend environment

In your Vite build environment (CI/CD or `.env.production`):

```
VITE_API_URL=https://yourdomain.com/eopms-api
```

For local development (if you want to point to the PHP server directly):
```
VITE_API_URL=http://localhost:3001
```
(run the old server.js during local dev, or use PHP's built-in server: `php -S localhost:3001 index.php`)

---

## Step 7 — Set up the payslip cron job (replaces node-cron)

In cPanel → **Cron Jobs**, add a new job:

| Field    | Value |
|----------|-------|
| Minute   | `0`   |
| Hour     | `10`  |
| Day      | `10`  |
| Month    | `*`   |
| Weekday  | `*`   |
| Command  | `curl -s "https://yourdomain.com/eopms-api/api/payroll/trigger-send" -X POST -H "Content-Type: application/json"` |

Adjust day/hour to match your payroll schedule.

---

## Step 8 — Verify endpoints

| Test | URL |
|------|-----|
| SMTP test | `GET /api/test-email` |
| Employees list | `GET /api/employees` |
| CL Balances | `GET /api/cl-balances` |
| Device status (stub) | `GET /api/attendance/device-status` |

---

## ZKTeco Device Note
The live-feed / device-status / force-resync endpoints return stub data on PHP hosting.
The physical ZKTeco TCP connection requires a persistent server process (Node.js or similar).
If real-time punch events are needed in future, deploy a small Node microservice alongside.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| 404 on any endpoint | Confirm `mod_rewrite` is on and `.htaccess` was uploaded |
| SMTP auth failed | Double-check `SMTP_PASS` and port in `config.php` |
| PDF not downloading | Ensure TCPDF installed (`vendor/` present) |
| db.json permission denied | `chmod 664 db.json` |
| Blank page | Check PHP error log in cPanel → `public_html/eopms-api/error_log` |
