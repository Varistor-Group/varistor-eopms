# Varistor EOPMS — PHP Backend Deployment Guide
## Complete Beginner Walkthrough (cPanel)

---

## What You Need Before Starting

| Item | Where to get it |
|------|-----------------|
| Your hosting control panel URL | Your hosting provider's welcome email (looks like `https://ytbhai.com:2083`) |
| Your cPanel username & password | Your hosting provider's welcome email |
| FileZilla (free FTP software) | https://filezilla-project.org/download.php |
| Your subdomain | `eopms.ytbhai.com` — this is already assigned to you |

> ✅ **Important:** The company's `public_html` has other websites in it.
> You will **only** work inside `public_html/eopms.ytbhai.com/`.
> Do NOT touch or upload anything into `public_html/` directly.

---

## PART 1 — Install FileZilla and Connect to Your Server

### Step 1.1 — Download FileZilla
1. Go to https://filezilla-project.org/download.php
2. Click **Download FileZilla Client** (free, the one on the left)
3. Install it normally

### Step 1.2 — Get your FTP credentials from cPanel
1. Open your cPanel URL (your hosting provider gave you this — looks like `https://ytbhai.com:2083`)
2. Log in with your cPanel username and password
3. In cPanel, search for **FTP Accounts** in the search bar at the top
4. Click **FTP Accounts**
5. You'll see your main FTP account listed. Note down:
   - **FTP Username** (usually `yourusername@yourdomain.com`)
   - **FTP Server / Host** (usually your domain name e.g. `ftp.ytbhai.com` or just your IP)
   - **Port**: `21`
   - **Password**: This is your cPanel password

### Step 1.3 — Connect FileZilla to your server
1. Open **FileZilla**
2. At the very top, fill in these 4 fields:
   - **Host**: Your FTP host (e.g. `ftp.ytbhai.com`)
   - **Username**: Your FTP username
   - **Password**: Your cPanel password
   - **Port**: `21`
3. Click **Quickconnect**
4. If it asks "Trust this certificate?" — click **OK / Trust**
5. The right side of FileZilla now shows your server's files
6. You'll see a folder called `public_html` — that's your website's root folder

---

## PART 2 — Upload the PHP Backend Files

### Step 2.1 — Navigate to the right place in FileZilla

**Left side (your computer):**
- Navigate to: `C:\Users\ak026\varistor-eopms\php-backend`

**Right side (your server):**
- Double-click `public_html` to open it
- Double-click `eopms.ytbhai.com` to open it
- You are now in the correct subdomain folder

> ⚠️ Do NOT upload anything into `public_html/` directly.
> Everything goes inside `public_html/eopms.ytbhai.com/`.

### Step 2.2 — Create the `eopms-api` folder inside `eopms.ytbhai.com`
1. On the **right side** of FileZilla, make sure you are inside `eopms.ytbhai.com`
2. Right-click in an empty area
3. Click **Create directory**
4. Type: `eopms-api`
5. Click **OK**
6. Double-click `eopms-api` to go inside it

### Step 2.3 — Upload the PHP files
On the **left side** of FileZilla (your computer), you should be inside `php-backend`.

Select ALL files **except** `config.php`:
- `.htaccess`
- `activity.php`
- `attendance_pdf.php`
- `attendance_stubs.php`
- `cl_balances.php`
- `composer.json`
- `config.example.php`
- `db.json` *(copy of your db.json — see note below)*
- `DEPLOYMENT.md`
- `documents.php`
- `employees.php`
- `helpers.php`
- `index.php`
- `leave_notify_employee.php`
- `leave_notify_manager.php`
- `leaves.php`
- `payroll_records.php`
- `payroll_schedule.php`
- `payroll_send_slips.php`
- `payroll_trigger.php`
- `quiz_submit.php`
- `send_credentials.php`
- `send_password_reset.php`
- `test_email.php`

> ⚠️ **DO NOT upload `config.php`** — it has your passwords. You'll create it manually on the server in Part 3.

To select multiple files: hold **Ctrl** and click each file, then right-click → **Upload**

**Also upload `db.json` from your project root:**  
In FileZilla left side, navigate up to `C:\Users\ak026\varistor-eopms\` and upload `db.json` to the same `eopms-api` folder on the server.

### Step 2.4 — Verify upload
After uploading, the right side of FileZilla should show all files inside `eopms.ytbhai.com/eopms-api/`.

---

## PART 3 — Create the Config File on the Server (Passwords)

### Step 3.1 — Open cPanel File Manager
1. Go back to your cPanel (the `:2083` URL)
2. Search for **File Manager** in the search bar
3. Click **File Manager**
4. Navigate to: `public_html` → `eopms.ytbhai.com` → `eopms-api`

### Step 3.2 — Create config.php
1. At the top of File Manager, click **+ File** (or **New File**)
2. Type the filename: `config.php`
3. Click **Create New File**
4. Right-click the new `config.php` → click **Edit**
5. If it asks which editor, click **Edit** again
6. **Delete everything** in the editor and paste this:

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

7. Click **Save Changes**
8. Close the editor tab

---

## PART 4 — Install PHP Libraries (Composer)

The PHP backend needs two libraries: **PHPMailer** (sends emails) and **TCPDF** (creates PDFs). These are installed using a tool called Composer.

### Step 4.1 — Open cPanel Terminal
1. In cPanel, search for **Terminal** in the search bar
2. Click **Terminal**
3. A black command-line window opens inside your browser

### Step 4.2 — Navigate to your folder
Type exactly this and press Enter:
```
cd public_html/eopms.ytbhai.com/eopms-api
```

### Step 4.3 — Download Composer
Type exactly this and press Enter (one long line):
```
curl -sS https://getcomposer.org/installer | php
```
Wait for it to finish. You'll see `Composer successfully installed`.

### Step 4.4 — Install the libraries
Type exactly this and press Enter:
```
php composer.phar install --no-dev
```
This will download PHPMailer and TCPDF into a `vendor/` folder. It takes 1–3 minutes. You'll see a progress bar. When done it says `Generating optimized autoload files`.

### Step 4.5 — Set file permissions
Type each line and press Enter after each:
```
chmod 664 db.json
chmod 644 config.php
```

---

## PART 5 — Test That Everything Works

### Step 5.1 — Test the SMTP email connection

Open a new browser tab and go to:
```
https://eopms.ytbhai.com/eopms-api/api/test-email
```

You should see:
```json
{"success": true, "message": "Test email sent to eopms@varistor.in"}
```

If you see this — **email is working!** Check `eopms@varistor.in` inbox for the test email.

### Step 5.2 — Test the employees endpoint

Open in browser:
```
https://eopms.ytbhai.com/eopms-api/api/employees
```

You should see a JSON list of employees (same as `db.json`).

### Step 5.3 — Test device status stub

Open in browser:
```
https://eopms.ytbhai.com/eopms-api/api/attendance/device-status
```

You should see:
```json
{"ipAddress":"192.168.1.42","online":false,...}
```

---

## PART 6 — Update Your Frontend to Use the PHP Backend

### Step 6.1 — Update your .env file

Open `C:\Users\ak026\varistor-eopms\.env` and change this line:
```
VITE_API_URL=http://localhost:3001
```
To:
```
VITE_API_URL=https://eopms.ytbhai.com/eopms-api
```

### Step 6.2 — Rebuild and deploy the frontend

Run in your project folder:
```
npm run build
```
Then upload the `dist/` folder to your hosting as you normally would.

---

## PART 7 — Set Up the Automatic Payslip Cron Job (Optional)

This replaces the `node-cron` that used to run in `server.js`.

### Step 7.1 — Open Cron Jobs in cPanel
1. In cPanel, search for **Cron Jobs**
2. Click **Cron Jobs**

### Step 7.2 — Add a new cron job
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
