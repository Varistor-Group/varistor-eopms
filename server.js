import express from 'express';
import dotenv from 'dotenv';
import { Resend } from 'resend';
import fs from 'fs/promises';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = 3001;

app.use(express.json());

// Initialize Resend
const resend = new Resend(process.env.VITE_RESEND_API_KEY);

// CORS middleware to allow requests from Vite frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.post('/api/send-credentials', async (req, res) => {
  try {
    const { name, email, employeeId, tempPassword } = req.body;

    if (!name || !email || !employeeId || !tempPassword) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Welcome to Varistor EOPMS - Your Login Credentials',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background-color: #84CC16; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Welcome to Varistor EOPMS!</h1>
          </div>
          <div style="padding: 20px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hi ${name},</p>
            <p>Your account has been successfully created. Here are your login credentials:</p>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <p style="margin: 0 0 10px 0;"><strong>Employee ID:</strong> ${employeeId}</p>
              <p style="margin: 0;"><strong>Temporary Password:</strong> <code style="background: #eee; padding: 2px 6px; border-radius: 3px;">${tempPassword}</code></p>
            </div>
            <p>Please log in using the app URL and change your password as soon as possible.</p>
            <div style="text-align: center; margin-top: 30px;">
              <a href="http://localhost:5173" style="background-color: #84CC16; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-weight: bold;">Log in to EOPMS</a>
            </div>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ success: false, error: 'Failed to send email' });
  }
});

app.post('/api/send-password-reset', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    // Mock reset link
    const resetLink = 'http://localhost:5173/reset?token=MOCK_TOKEN_123';

    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background-color: #84CC16; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Password Reset</h1>
          </div>
          <div style="padding: 20px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hi,</p>
            <p>We received a request to reset the password for your account.</p>
            <p>Click the button below to reset your password. This link is a mock placeholder for development.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="background-color: #84CC16; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-weight: bold;">Reset Password</a>
            </div>
            <p style="font-size: 12px; color: #777;">If you did not request this, you can safely ignore this email.</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ success: false, error: 'Failed to send email' });
  }
});

// ── Task B: Quiz result email ──────────────────────────────────────────────────
app.post('/api/quiz/submit', async (req, res) => {
  try {
    const { employeeEmail, hrEmail, moduleTitle, score, passed } = req.body;

    if (!employeeEmail || !moduleTitle || score === undefined) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const statusColor = passed ? '#84CC16' : '#ef4444';
    const statusLabel = passed ? '✅ PASSED' : '❌ FAILED';

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: #84CC16; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0;">Training Quiz Result</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
          <p>A training quiz has been completed on <strong>Varistor EOPMS</strong>.</p>
          <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
            <tr style="background:#f9f9f9;">
              <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Module</td>
              <td style="padding:10px 12px; border:1px solid #eee;">${moduleTitle}</td>
            </tr>
            <tr>
              <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Score</td>
              <td style="padding:10px 12px; border:1px solid #eee;"><strong style="color:${statusColor};">${score}%</strong></td>
            </tr>
            <tr style="background:#f9f9f9;">
              <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Result</td>
              <td style="padding:10px 12px; border:1px solid #eee;"><strong style="color:${statusColor};">${statusLabel}</strong></td>
            </tr>
            <tr>
              <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Passing score</td>
              <td style="padding:10px 12px; border:1px solid #eee;">70%</td>
            </tr>
          </table>
          ${!passed ? '<p style="color:#ef4444; font-size:13px;">The employee may retry after a 24-hour cooldown.</p>' : '<p style="color:#84CC16; font-size:13px;">The next module has been automatically unlocked.</p>'}
          <p style="font-size:12px; color:#888; margin-top:24px;">This is an automated message from Varistor EOPMS Training.</p>
        </div>
      </div>
    `;

    const recipients = [employeeEmail, hrEmail].filter(Boolean);

    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: recipients,
      subject: `Quiz Result: ${moduleTitle} — ${passed ? 'Passed' : 'Failed'} (${score}%)`,
      html,
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ success: false, error: 'Failed to send quiz result email' });
  }
});

// --- Mock Local Database Routes ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.json');

async function readDB() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to read db.json', err);
    return { employees: [], documents: [], activity_log: [] };
  }
}

async function writeDB(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

// Employees
app.get('/api/employees', async (req, res) => {
  const db = await readDB();
  res.json(db.employees || []);
});

app.post('/api/employees', async (req, res) => {
  const db = await readDB();
  const employee = req.body;
  if (!db.employees) db.employees = [];
  
  const duplicate = db.employees.find(
    e => e.employeeId === employee.employeeId || e.personalEmail === employee.personalEmail
  );
  if (duplicate) {
    return res.status(400).json({ success: false, error: 'Employee ID or email already exists.' });
  }

  db.employees.push(employee);
  
  if (!db.activity_log) db.activity_log = [];
  db.activity_log.push({
    id: Date.now().toString(),
    action: 'CREATE_EMPLOYEE',
    by: 'admin@varistor.in',
    details: `Created employee ${employee.fullName} (${employee.employeeId})`,
    timestamp: new Date().toISOString()
  });

  await writeDB(db);
  res.json({ success: true, employee });
});

app.put('/api/employees/:id', async (req, res) => {
  const db = await readDB();
  const id = req.params.id;
  if (!db.employees) db.employees = [];

  const index = db.employees.findIndex(e => e.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Employee not found.' });
  }

  const safeUpdates = { ...req.body };
  delete safeUpdates.id;
  delete safeUpdates.employeeId;
  delete safeUpdates.personalEmail;
  delete safeUpdates.createdAt;
  delete safeUpdates.tempPassword;

  db.employees[index] = { ...db.employees[index], ...safeUpdates };

  if (!db.activity_log) db.activity_log = [];
  db.activity_log.push({
    id: Date.now().toString(),
    action: 'UPDATE_EMPLOYEE',
    by: 'admin@varistor.in',
    details: `Updated employee ${db.employees[index].fullName} (${id})`,
    timestamp: new Date().toISOString()
  });

  await writeDB(db);
  res.json({ success: true, employee: db.employees[index] });
});

// Documents
app.get('/api/documents/:employeeId', async (req, res) => {
  const db = await readDB();
  const docs = (db.documents || []).filter(d => d.employeeId === req.params.employeeId);
  res.json(docs);
});

// ── Modules 11 & 12: Bulk salary slip emails ──────────────────────────────────
app.post('/api/payroll/send-slips', async (req, res) => {
  const { slips } = req.body;
  if (!Array.isArray(slips) || slips.length === 0) {
    return res.status(400).json({ success: false, error: 'No slip data provided.' });
  }

  const fmt = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  const buildSlipHtml = (slip) => {
    const month = slip.month || new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });
    const netPay = slip.netPay ?? (slip.ctc - slip.deductions);
    return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Salary Slip – ${month}</title></head>
<body style="margin:0;padding:0;background:#f4f6f3;font-family:Arial,Helvetica,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f3;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #d8ded2;">

        <!-- Header -->
        <tr>
          <td style="background:#84cc16;padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;color:#fff;font-size:18px;font-weight:700;letter-spacing:0.5px;">VARISTOR TECHNOLOGIES PVT LTD</p>
                  <p style="margin:4px 0 0;color:#ecfccb;font-size:13px;">Salary Slip &middot; ${month}</p>
                </td>
                <td align="right">
                  <div style="width:44px;height:44px;background:rgba(255,255,255,0.25);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#fff;line-height:44px;text-align:center;">V</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Employee Info -->
        <tr>
          <td style="padding:24px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" style="padding-bottom:8px;">
                  <p style="margin:0;font-size:11px;color:#868e80;text-transform:uppercase;letter-spacing:0.5px;">Employee</p>
                  <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#111;">${slip.name}</p>
                </td>
                <td width="50%" style="padding-bottom:8px;">
                  <p style="margin:0;font-size:11px;color:#868e80;text-transform:uppercase;letter-spacing:0.5px;">Employee ID</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#111;">${slip.employeeId || '—'}</p>
                </td>
              </tr>
              <tr>
                <td style="padding-bottom:8px;">
                  <p style="margin:0;font-size:11px;color:#868e80;text-transform:uppercase;letter-spacing:0.5px;">Department</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#111;">${slip.department || '—'}</p>
                </td>
                <td style="padding-bottom:8px;">
                  <p style="margin:0;font-size:11px;color:#868e80;text-transform:uppercase;letter-spacing:0.5px;">Monthly CTC</p>
                  <p style="margin:4px 0 0;font-size:14px;font-weight:600;color:#111;">${fmt(slip.ctc)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="padding:16px 32px 0;"><hr style="border:none;border-top:1px solid #d8ded2;margin:0;"></td></tr>

        <!-- Earnings & Deductions -->
        <tr>
          <td style="padding:20px 32px 0;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" valign="top" style="padding-right:16px;">
                  <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#868e80;text-transform:uppercase;letter-spacing:0.5px;">Earnings</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#555a52;">Gross Pay</td>
                      <td align="right" style="padding:6px 0;font-size:13px;font-weight:600;color:#111;">${fmt(slip.ctc)}</td>
                    </tr>
                  </table>
                </td>
                <td width="50%" valign="top" style="padding-left:16px;border-left:1px solid #d8ded2;">
                  <p style="margin:0 0 12px;font-size:11px;font-weight:700;color:#868e80;text-transform:uppercase;letter-spacing:0.5px;">Deductions</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:6px 0;font-size:13px;color:#555a52;">Total Deductions</td>
                      <td align="right" style="padding:6px 0;font-size:13px;font-weight:600;color:#b91c1c;">${fmt(slip.deductions)}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Net Pay -->
        <tr>
          <td style="padding:20px 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7fee7;border:1px solid #d9f99d;border-radius:12px;">
              <tr>
                <td style="padding:16px 20px;">
                  <p style="margin:0;font-size:14px;font-weight:700;color:#365314;">Net Pay</p>
                </td>
                <td align="right" style="padding:16px 20px;">
                  <p style="margin:0;font-size:24px;font-weight:900;color:#3f6212;">${fmt(netPay)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #d8ded2;text-align:center;">
            <p style="margin:0;font-size:11px;color:#868e80;">This is a system-generated salary slip from Varistor EOPMS. No signature required.</p>
            <p style="margin:6px 0 0;font-size:11px;color:#868e80;">&#9993; Auto-dispatched on the 15th of each month &middot; 10:00 IST</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
  };

  const sent = [];
  const failed = [];

  for (const slip of slips) {
    if (!slip.email || !slip.name) {
      failed.push({ email: slip.email || '(no email)', name: slip.name || '(no name)', error: 'Missing name or email' });
      continue;
    }
    try {
      const month = slip.month || new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      const { data, error } = await resend.emails.send({
        from: 'onboarding@resend.dev',
        to: slip.email,
        subject: `Your Salary Slip – ${month} | Varistor Technologies`,
        html: buildSlipHtml(slip),
      });
      if (error) throw new Error(error.message);
      sent.push(slip.email);
      console.log(`[Payroll] Slip sent to ${slip.name} <${slip.email}>`);
    } catch (err) {
      console.error(`[Payroll] Failed for ${slip.email}:`, err.message);
      failed.push({ email: slip.email, name: slip.name, error: err.message });
    }
    // Small delay between sends to respect Resend rate limits
    await new Promise(r => setTimeout(r, 120));
  }

  console.log(`[Payroll] Bulk dispatch complete: ${sent.length} sent, ${failed.length} failed`);
  res.json({ success: true, sent: sent.length, failed });
});

// Activity
app.post('/api/activity', async (req, res) => {
  const db = await readDB();
  const log = req.body;
  if (!db.activity_log) db.activity_log = [];
  db.activity_log.push({
    id: Date.now().toString(),
    ...log,
    timestamp: new Date().toISOString()
  });
  await writeDB(db);
  res.json({ success: true });
});

app.listen(port, () => {
  console.log(`[Email Server] running on http://localhost:${port}`);
});
