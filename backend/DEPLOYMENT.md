# Varistor EOPMS — PHP Backend Deployment Guide
## Complete Beginner Walkthrough (cPanel)

---

## What You Need Before Starting

| Item | Where to get it |
|------|-----------------|
| Your hosting control panel URL | Your hosting provider's welcome email (looks like `https://ytbhai.com:2083`) |
| Your cPanel username & password | Your hosting provider's welcome email |
| Your subdomain | `eopms.ytbhai.com` — this is already assigned to you |

> ✅ **Important:** The company's `public_html` has other websites in it.
> You will **only** work inside `public_html/eopms.ytbhai.com/`.
> Do NOT touch or upload anything into `public_html/` directly.

---

## PART 1 — Upload the PHP Backend (via cPanel File Manager)

Since you have direct cPanel access, you don't need FileZilla at all! We have created a zip file to make this easy.

### Step 1.1 — Open cPanel File Manager
1. Log into your cPanel (`https://ytbhai.com:2083`)
2. Search for **File Manager** and click it.
3. In File Manager, navigate to: `public_html` → `eopms.ytbhai.com`

> ⚠️ Do NOT upload anything into `public_html/` directly.
> Everything goes inside `public_html/eopms.ytbhai.com/`.

### Step 1.2 — Create the API folder
1. At the top of File Manager, click **+ Folder** (Create New Folder).
2. Name it: `eopms-api`
3. Click **Create New Folder**.
4. Double-click the `eopms-api` folder to go inside it.

### Step 1.3 — Upload the backend zip and extract
1. Inside `eopms-api`, click the **Upload** button at the top of File Manager (a new tab will open).
2. Click **Select File**.
3. Choose the `php-backend.zip` file that is in your project folder (`C:\Users\ak026\varistor-eopms\php-backend.zip`).
4. Wait for the upload bar to turn green (100%), then close that tab.
5. Back in the File Manager, click **Reload** at the top. You should see `php-backend.zip`.
6. Right-click `php-backend.zip` and click **Extract**. Then click **Extract Files**.
7. Delete the `php-backend.zip` file to save space.

### Step 1.4 — Upload db.json
1. In the same `eopms-api` folder, click **Upload** again.
2. Select your `db.json` file from your project folder (`C:\Users\ak026\varistor-eopms\db.json`).
3. (You must upload this directly as we didn't include it in the zip to prevent accidental overwrites later).

---

## PART 2 — Create the Config File on the Server (Passwords)

### Step 2.1 — Create config.php
1. You should still be in `public_html/eopms.ytbhai.com/eopms-api` in File Manager.
2. At the top, click **+ File** (New File).
3. Name it: `config.php`
4. Click **Create New File**.
5. Right-click the new `config.php` → click **Edit** (click Edit again on the popup).
6. **Paste the following code** exactly:

```php
<?php
define('SMTP_HOST',   'mail.varistor.in');
define('SMTP_PORT',   587);
define('SMTP_SECURE', 'tls');
define('SMTP_USER',   'eopms@varistor.in');
define('SMTP_PASS',   'Vtpl231!@#');
define('SMTP_FROM',   'eopms@varistor.in');
define('SMTP_NAME',   'Varistor EOPMS');
define('APP_URL',     'https://eopms.ytbhai.com');
define('SUPABASE_URL',              'https://vghttoqhflmbjztsphjy.supabase.co');
define('SUPABASE_SERVICE_ROLE_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnaHR0b3FoZmxtYmp6dHNwaGp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjg4NDk3NywiZXhwIjoyMDk4NDYwOTc3fQ.AGjNkEvuB5K4HoavfaSCjhDxt8rKrWJxV2NfFZgrRiw');
define('DB_PATH', __DIR__ . '/db.json');
```

7. Click **Save Changes** in the top right.
8. Close the editor tab.

---

## PART 3 — Install PHP Libraries (Composer)

The PHP backend needs two libraries: **PHPMailer** (sends emails) and **TCPDF** (creates PDFs). These are installed using a tool called Composer.

### Step 3.1 — Open cPanel Terminal
1. In cPanel, search for **Terminal** in the search bar
2. Click **Terminal**
3. A black command-line window opens inside your browser

### Step 3.2 — Navigate to your folder
Type exactly this and press Enter:
```
cd public_html/eopms.ytbhai.com/eopms-api
```

### Step 3.3 — Download Composer
Type exactly this and press Enter (one long line):
```
curl -sS https://getcomposer.org/installer | php -d allow_url_fopen=On
```
Wait for it to finish. You'll see `Composer successfully installed`.

### Step 3.4 — Install the libraries
Type exactly this and press Enter:
```
php -d allow_url_fopen=On composer.phar install --no-dev
```
This will download PHPMailer and TCPDF into a `vendor/` folder. It takes 1–3 minutes. You'll see a progress bar. When done it says `Generating optimized autoload files`.

### Step 3.5 — Set file permissions
Type each line and press Enter after each:
```
chmod 664 db.json
chmod 644 config.php
```

---

## PART 4 — Test That Everything Works

### Step 4.1 — Test the SMTP email connection

Open a new browser tab and go to:
```
https://eopms.ytbhai.com/eopms-api/api/test-email
```

You should see:
```json
{"success": true, "message": "Test email sent to eopms@varistor.in"}
```

If you see this — **email is working!** Check `eopms@varistor.in` inbox for the test email.

### Step 4.2 — Test the employees endpoint

Open in browser:
```
https://eopms.ytbhai.com/eopms-api/api/employees
```

You should see a JSON list of employees (same as `db.json`).

### Step 4.3 — Test device status stub

Open in browser:
```
https://eopms.ytbhai.com/eopms-api/api/attendance/device-status
```

You should see:
```json
{"ipAddress":"192.168.1.42","online":false,...}
```

---

## PART 5 — Upload Your Frontend (React App)

We already built your frontend app and put it in a zip file too!

### Step 5.1 — Upload the frontend zip
1. In cPanel File Manager, go to: `public_html` → `eopms.ytbhai.com` (Do not go into `eopms-api`).
2. Click **Upload** at the top.
3. Select `dist.zip` from your project folder (`C:\Users\ak026\varistor-eopms\dist.zip`).
4. Wait for it to upload fully, then close the tab.
5. In File Manager, click **Reload**. You will see `dist.zip`.
6. Right-click `dist.zip` and click **Extract**. 
7. Important: The files must sit directly inside `eopms.ytbhai.com`, not inside a `dist/` subfolder. 
8. Delete `dist.zip`.

---

## PART 6 — Set Up the Automatic Payslip Cron Job (Optional)

This replaces the `node-cron` that used to run in `server.js`.

### Step 6.1 — Open Cron Jobs in cPanel
1. In cPanel, search for **Cron Jobs**
2. Click **Cron Jobs**

### Step 6.2 — Add a new cron job
Scroll down to **Add New Cron Job**.

Fill in the fields:
| Field | Value | Meaning |
|-------|-------|---------|
| Minute | `0` | At minute 0 |
| Hour | `10` | At 10 AM |
| Day | `10` | On the 10th of the month |
| Month | `*` | Every month |
| Weekday | `*` | Any day |
| Command | *(see below)* | |

For the **Command** field, paste:
```
curl -s -X POST "https://eopms.ytbhai.com/eopms-api/api/payroll/trigger-send" -H "Content-Type: application/json" > /dev/null 2>&1
```

Click **Add New Cron Job**.

This will automatically send payslips on the 10th of every month at 10:00 AM. You can change the day/hour to match your payroll schedule.

---

## TROUBLESHOOTING

| Problem | What to check |
|---------|---------------|
| Page shows "404 Not Found" | The `.htaccess` file wasn't uploaded, or `mod_rewrite` is off. Contact your host and ask them to enable `mod_rewrite` |
| Page shows blank / white | Go to cPanel → File Manager → `eopms-api` folder → look for a file called `error_log` → open it to see the PHP error |
| "SMTP connect() failed" | Your SMTP credentials are wrong in `config.php`. Double-check host, port, user and password |
| "composer: command not found" | Use `php composer.phar install` instead of `composer install` |
| "Permission denied" on db.json | In Terminal type: `chmod 664 db.json` |
| PDF download doesn't work | Composer didn't finish. Go to Terminal, `cd public_html/eopms-api`, run `php composer.phar install --no-dev` again |
| Email test works but frontend can't reach API | Check that `VITE_API_URL` in `.env` exactly matches your PHP folder URL. Make sure you rebuilt with `npm run build` after changing `.env` |

---

## Quick Reference: Files Uploaded to Server

```
public_html/
├── (other company websites — DO NOT TOUCH)
└── eopms.ytbhai.com/        ← your subdomain folder
    └── eopms-api/           ← all your PHP files go here
        ├── .htaccess
        ├── index.php         ← router (entry point)
        ├── config.php        ← created manually (passwords)
        ├── db.json           ← your data file
        ├── composer.json
        ├── helpers.php
        ├── vendor/           ← created by composer install
        ├── send_credentials.php
        ├── send_password_reset.php
        ├── test_email.php
        ├── quiz_submit.php
        ├── leave_notify_manager.php
        ├── leave_notify_employee.php
        ├── payroll_send_slips.php
        ├── payroll_schedule.php
        ├── payroll_records.php
        ├── payroll_trigger.php
        ├── employees.php
        ├── documents.php
        ├── cl_balances.php
        ├── leaves.php
        ├── activity.php
        ├── attendance_pdf.php
        └── attendance_stubs.php
```

**Your API base URL after deployment:**
```
https://eopms.ytbhai.com/eopms-api
```

**Set this in your `.env` file:**
```
VITE_API_URL=https://eopms.ytbhai.com/eopms-api
```
