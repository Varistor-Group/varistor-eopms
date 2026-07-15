import express from 'express';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import PDFDocument from 'pdfkit';
import fs from 'fs/promises';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// ── Supabase Admin client (service role — server-side only) ───────────────────
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

// ── Nodemailer SMTP transporter ────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

transporter.verify((error) => {
  if (error) {
    console.error('[SMTP] Connection failed:', error.message);
  } else {
    console.log('[SMTP] Server ready — sending from', process.env.SMTP_USER);
  }
});

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

    await transporter.sendMail({
      from: `"Varistor EOPMS" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Welcome to Varistor EOPMS — Your Login Credentials',
      html: `
        <div style="font-family: Inter, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <div style="background: #84CC16; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #000; margin: 0; font-size: 20px; font-weight: 700;">Varistor EOPMS</h1>
          </div>
          <div style="background: #ffffff; padding: 32px; border: 1px solid #D8DED2; border-radius: 0 0 8px 8px;">
            <h2 style="font-size: 18px; font-weight: 600; color: #111;">Welcome, ${name}!</h2>
            <p style="color: #444; line-height: 1.6;">Your account has been created on Varistor EOPMS. Here are your login credentials:</p>
            <div style="background: #f9fafb; border: 1px solid #D8DED2; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="margin: 0 0 8px 0; color: #444;"><strong>Employee ID:</strong> ${employeeId}</p>
              <p style="margin: 0 0 8px 0; color: #444;"><strong>Email:</strong> ${email}</p>
              <p style="margin: 0; color: #444;"><strong>Temporary Password:</strong> ${tempPassword}</p>
            </div>
            <p style="color: #444; line-height: 1.6;">Please log in and change your password immediately.</p>
            <a href="${process.env.APP_URL || 'http://localhost:5173'}" style="display: inline-block; background: #84CC16; color: #000; font-weight: 600; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 8px;">Log In to EOPMS →</a>
            <p style="color: #888; font-size: 12px; margin-top: 32px;">If you did not expect this email, please contact HR immediately.</p>
          </div>
        </div>
      `,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[send-credentials] Error:', err);
    res.json({ success: false, error: err.message });
  }
});

app.post('/api/send-password-reset', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    // Generate a real Supabase password reset link via Admin API
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: `${process.env.APP_URL || 'http://localhost:5173'}/reset-password`,
      },
    });

    if (linkError) {
      console.error('[send-password-reset] generateLink error:', linkError);
      return res.status(400).json({ success: false, error: linkError.message || 'Could not generate reset link. Check that this email exists in the system.' });
    }

    const resetLink = linkData.properties?.action_link;
    if (!resetLink) {
      return res.status(500).json({ success: false, error: 'Reset link generation failed — no link returned.' });
    }

    await transporter.sendMail({
      from: `"Varistor EOPMS" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Varistor EOPMS — Password Reset Request',
      html: `
        <div style="font-family: Inter, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <div style="background: #84CC16; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #000; margin: 0; font-size: 20px; font-weight: 700;">Varistor EOPMS</h1>
          </div>
          <div style="background: #ffffff; padding: 32px; border: 1px solid #D8DED2; border-radius: 0 0 8px 8px;">
            <h2 style="font-size: 18px; font-weight: 600; color: #111;">Password Reset Requested</h2>
            <p style="color: #444; line-height: 1.6;">We received a request to reset the password for your Varistor EOPMS account.</p>
            <a href="${resetLink}" style="display: inline-block; background: #84CC16; color: #000; font-weight: 600; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 8px;">Reset My Password →</a>
            <p style="color: #444; line-height: 1.6; margin-top: 24px;">If you did not request this, please ignore this email. Your password will not be changed.</p>
            <p style="color: #888; font-size: 12px; margin-top: 32px;">This link expires in 1 hour.</p>
          </div>
        </div>
      `,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('[send-password-reset] Error:', err);
    res.json({ success: false, error: err.message });
  }
});

// ── Dev-only: test SMTP connection (remove in production) ──────────────────────
app.get('/api/test-email', async (req, res) => {
  try {
    await transporter.sendMail({
      from: `"Varistor EOPMS" <${process.env.SMTP_USER}>`,
      to: process.env.SMTP_USER,
      subject: 'EOPMS Email Test',
      html: '<p>SMTP is working correctly.</p>',
    });
    res.json({ success: true, message: 'Test email sent to ' + process.env.SMTP_USER });
  } catch (err) {
    res.json({ success: false, error: err.message });
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

    await transporter.sendMail({
      from: `"Varistor EOPMS" <${process.env.SMTP_USER}>`,
      to: recipients,
      subject: `Quiz Result: ${moduleTitle} — ${passed ? 'Passed' : 'Failed'} (${score}%)`,
      html,
    });

    res.json({ success: true });
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

const numberToWords = (num) => {
  if (num === 0) return 'Rupees Zero Only';

  const singleDigits = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const doubleDigits = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tensPlace = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n) {
    if (n < 10) return singleDigits[n];
    if (n < 20) return doubleDigits[n - 10];
    const unit = n % 10;
    const ten = Math.floor(n / 10);
    return tensPlace[ten] + (unit ? '-' + singleDigits[unit] : '');
  }

  function convertThreeDigits(n) {
    const hundred = Math.floor(n / 100);
    const rest = n % 100;
    let str = '';
    if (hundred) {
      str += singleDigits[hundred] + ' Hundred';
    }
    if (rest) {
      if (str) str += ' and ';
      str += convertTwoDigits(rest);
    }
    return str;
  }

  const parts = Number(num).toFixed(2).split('.');
  const rupeesVal = parseInt(parts[0], 10);
  const paiseVal = parseInt(parts[1], 10);

  let rupeesStr = '';
  if (rupeesVal === 0) {
    rupeesStr = 'Zero';
  } else {
    let tempVal = rupeesVal;

    // Crores
    const crores = Math.floor(tempVal / 10000000);
    tempVal %= 10000000;
    if (crores) {
      rupeesStr += convertThreeDigits(crores) + ' Crore ';
    }

    // Lakhs
    const lakhs = Math.floor(tempVal / 100000);
    tempVal %= 100000;
    if (lakhs) {
      rupeesStr += convertTwoDigits(lakhs) + ' Lakh ';
    }

    // Thousands
    const thousands = Math.floor(tempVal / 1000);
    tempVal %= 1000;
    if (thousands) {
      rupeesStr += convertTwoDigits(thousands) + ' Thousand ';
    }

    if (tempVal) {
      rupeesStr += convertThreeDigits(tempVal);
    }
  }

  let paiseStr = '';
  if (paiseVal > 0) {
    paiseStr = ' and ' + convertTwoDigits(paiseVal) + ' Paise';
  }

  return `Rupees ${rupeesStr.trim()}${paiseStr} Only`;
};

// Generate A4 Salary Slip PDF buffer using pdfkit
const generateSalarySlipPDF = (slip) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      // Green checkmark logo
      doc.lineWidth(3).strokeColor('#84cc16');
      doc.moveTo(145, 52).lineTo(152, 59).lineTo(167, 43).stroke();
      doc.fillColor('#111111')
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('Varistor Technologies Pvt. Ltd.', 180, 40);

      // Company details
      doc.fillColor('#555555')
        .fontSize(8)
        .font('Helvetica')
        .text('No. F-1107, Block-1, First Floor Ardente Office One, Hoodi Circle, ITPL Main Rd, Bengaluru, Karnataka 560048', 40, 70, { align: 'center', width: 515 });
      doc.text('Email - hr@varistor.in, Telephone - 080 4117 8911', 40, 82, { align: 'center', width: 515 });

      // Yellow banner
      doc.rect(40, 96, 515, 18).fill('#fef08a');
      doc.fillColor('#000000')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(`Pay Slip for the Month of ${slip.month || 'June 2026'}`, 40, 101, { align: 'center', width: 515 });

      // Employee Grid Lines
      doc.lineWidth(1).strokeColor('#cccccc');
      doc.moveTo(40, 114).lineTo(555, 114).stroke();
      doc.moveTo(40, 132).lineTo(555, 132).stroke();
      doc.moveTo(40, 150).lineTo(555, 150).stroke();
      doc.moveTo(40, 168).lineTo(555, 168).stroke();
      doc.moveTo(40, 186).lineTo(555, 186).stroke();

      doc.moveTo(40, 114).lineTo(40, 186).stroke();
      doc.moveTo(150, 114).lineTo(150, 186).stroke();
      doc.moveTo(297.5, 114).lineTo(297.5, 186).stroke();
      doc.moveTo(400, 114).lineTo(400, 186).stroke();
      doc.moveTo(555, 114).lineTo(555, 186).stroke();

      // Employee Details Values
      doc.fillColor('#111111').fontSize(9);

      // Row 1
      doc.font('Helvetica-Bold').text('Emp ID.', 45, 120);
      doc.font('Helvetica').text(slip.employeeId || '—', 155, 120);
      doc.font('Helvetica-Bold').text('Designation', 302, 120);
      doc.font('Helvetica').text(slip.designation || '—', 405, 120);

      // Row 2
      doc.font('Helvetica-Bold').text('Employee Name', 45, 138);
      doc.font('Helvetica').text(slip.name || '—', 155, 138);
      doc.font('Helvetica-Bold').text('Department', 302, 138);
      doc.font('Helvetica').text(slip.department || '—', 405, 138);

      // Row 3
      doc.font('Helvetica-Bold').text('No. of Days', 45, 156);
      doc.font('Helvetica').text(String(slip.totalDays || 30), 155, 156);
      doc.font('Helvetica-Bold').text('Paid No. of Days', 302, 156);
      doc.font('Helvetica').text(String(slip.payDays || 30), 405, 156);

      // Row 4
      doc.font('Helvetica-Bold').text('PF UAN No.', 45, 174);
      doc.font('Helvetica').text(slip.pfUan || '—', 155, 174);
      doc.font('Helvetica-Bold').text('CL Balance', 302, 174);
      doc.font('Helvetica').text(String(slip.clBalance || 0), 405, 174);

      // Table Header Background
      doc.rect(40, 186, 515, 18).fill('#bfdbfe');

      // Table Header Text
      doc.fillColor('#111111').fontSize(9).font('Helvetica-Bold');
      doc.text('Earnings', 45, 191);
      doc.text('Amount (Rs.)', 210, 191, { align: 'right', width: 82 });
      doc.text('Deductions', 302, 191);
      doc.text('Amount (Rs.)', 470, 191, { align: 'right', width: 80 });

      // Table Row Content
      let earnings = [];
      let deductions = [];

      if (Array.isArray(slip.additionHeads) && Array.isArray(slip.additionValues) &&
        Array.isArray(slip.deductionHeads) && Array.isArray(slip.deductionValues) &&
        (slip.additionHeads.length > 0 || slip.deductionHeads.length > 0)) {
        for (let i = 0; i < 10; i++) {
          earnings.push({
            label: slip.additionHeads[i] || '',
            val: (slip.additionHeads[i] && slip.additionValues[i] !== undefined) ? slip.additionValues[i] : null
          });
          deductions.push({
            label: slip.deductionHeads[i] || '',
            val: (slip.deductionHeads[i] && slip.deductionValues[i] !== undefined) ? slip.deductionValues[i] : null
          });
        }
      } else {
        earnings = [
          { label: 'Basic', val: slip.basic },
          { label: 'HRA', val: slip.hra },
          { label: 'Medical', val: slip.medical },
          { label: 'TA', val: slip.ta },
          { label: 'LTA', val: slip.lta },
          { label: 'Special Allowance', val: slip.specialAllowance },
          { label: 'Travel Allowance', val: slip.reimbursement },
          { label: 'Overtime', val: slip.overtime },
          { label: 'Incentives', val: slip.incentives },
          { label: '', val: null },
        ];

        deductions = [
          { label: 'PF Employee', val: slip.pfEmployee },
          { label: 'PF Employer', val: slip.pfEmployer },
          { label: 'ESI', val: slip.esi },
          { label: 'PT', val: slip.pt },
          { label: 'TDS', val: slip.tds },
          { label: 'Other Deductions', val: slip.otherDeductions },
          { label: '', val: null },
          { label: '', val: null },
          { label: '', val: null },
          { label: '', val: null },
        ];
      }

      // ── Draw earnings / deductions table (runs for both branches) ───────────
      let currentY = 204;
      for (let idx = 0; idx < 10; idx++) {
        const earn = earnings[idx];
        doc.fillColor('#111111').fontSize(8.5).font('Helvetica');
        if (earn && earn.label) {
          doc.text(earn.label, 45, currentY + 3);
          if (earn.val !== null && earn.val !== undefined) {
            doc.text(fmt(earn.val), 210, currentY + 3, { align: 'right', width: 82 });
          }
        }

        const deduct = deductions[idx];
        if (deduct && deduct.label) {
          doc.text(deduct.label, 302, currentY + 3);
          if (deduct.val !== null && deduct.val !== undefined) {
            doc.text(fmt(deduct.val), 470, currentY + 3, { align: 'right', width: 80 });
          }
        }

        // Draw divider
        doc.lineWidth(1).strokeColor('#e5e7eb');
        doc.moveTo(40, currentY + 16).lineTo(555, currentY + 16).stroke();
        currentY += 16;
      }

      // Vertical lines for the table grid
      doc.lineWidth(1).strokeColor('#cccccc');
      doc.moveTo(40, 186).lineTo(40, currentY).stroke();
      doc.moveTo(210, 186).lineTo(210, currentY).stroke();
      doc.moveTo(297.5, 186).lineTo(297.5, currentY).stroke();
      doc.moveTo(470, 186).lineTo(470, currentY).stroke();
      doc.moveTo(555, 186).lineTo(555, currentY).stroke();

      // Totals Row
      doc.rect(40, currentY, 515, 20).fill('#f1f5f9');

      doc.fillColor('#111111').fontSize(9).font('Helvetica-Bold');
      doc.text('Total Earnings', 45, currentY + 5);
      doc.text(fmt(pdfTotalCtc), 210, currentY + 5, { align: 'right', width: 82 });

      doc.text('Total Deduction', 302, currentY + 5);
      doc.text(fmt(slip.deductions), 470, currentY + 5, { align: 'right', width: 80 });

      // Outlines for Totals row
      doc.moveTo(40, currentY).lineTo(555, currentY).stroke();
      doc.moveTo(40, currentY + 20).lineTo(555, currentY + 20).stroke();
      doc.moveTo(40, currentY).lineTo(40, currentY + 20).stroke();
      doc.moveTo(210, currentY).lineTo(210, currentY + 20).stroke();
      doc.moveTo(297.5, currentY).lineTo(297.5, currentY + 20).stroke();
      doc.moveTo(470, currentY).lineTo(470, currentY + 20).stroke();
      doc.moveTo(555, currentY).lineTo(555, currentY + 20).stroke();

      currentY += 20;

      // Net Pay Row
      doc.rect(40, currentY, 257.5, 36).fill('#e2e8f0');
      doc.rect(297.5, currentY, 257.5, 36).fill('#f1f5f9');

      doc.fillColor('#111111').fontSize(10).font('Helvetica-Bold');
      doc.text('Final Pay [In-Hand]', 45, currentY + 13);

      doc.fontSize(14).font('Helvetica-Bold');
      doc.text(fmt(slip.netPay), 150, currentY + 11, { align: 'right', width: 140 });

      // Number to Words
      const words = numberToWords(slip.netPay);
      doc.fillColor('#111111').fontSize(7.5).font('Helvetica-Bold');
      doc.text(words, 305, currentY + 8, { width: 242, align: 'center' });

      // Borders for Net Pay row
      doc.moveTo(40, currentY + 36).lineTo(555, currentY + 36).stroke();
      doc.moveTo(40, currentY).lineTo(40, currentY + 36).stroke();
      doc.moveTo(297.5, currentY).lineTo(297.5, currentY + 36).stroke();
      doc.moveTo(555, currentY).lineTo(555, currentY + 36).stroke();

      currentY += 36;

      // Footer
      doc.fillColor('#555555')
        .fontSize(8.5)
        .font('Helvetica-Bold')
        .text('This is a computer generated payslip no signature is required.', 40, currentY + 12, { align: 'center', width: 515 });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
};

// ── Modules 11 & 12: Bulk salary slip emails ──────────────────────────────────
app.post('/api/payroll/send-slips', async (req, res) => {
  try {
    const { slips } = req.body;
    if (!Array.isArray(slips) || slips.length === 0) {
      return res.status(400).json({ success: false, error: 'No slip data provided.' });
    }

    console.log(`[Payroll] Received request to send ${slips.length} slips`);
    console.log(`[Payroll] SMTP host: ${process.env.SMTP_HOST || '(not configured)'}`);

    const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

    const buildSlipHtml = (slip) => {
      const month = slip.month || new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      const finalPay = slip.finalPay !== undefined ? slip.finalPay : (slip.netPay + (slip.reimbursement || 0) + (slip.overtime || 0) + (slip.incentives || 0) - (slip.deduction || 0));
      const words = numberToWords(finalPay);

      let rowsHtml = '';
      if (Array.isArray(slip.additionHeads) && Array.isArray(slip.additionValues) &&
        Array.isArray(slip.deductionHeads) && Array.isArray(slip.deductionValues) &&
        (slip.additionHeads.length > 0 || slip.deductionHeads.length > 0)) {
        let maxRows = 0;
        for (let i = 0; i < 10; i++) {
          if (slip.additionHeads[i] || slip.deductionHeads[i]) {
            maxRows = i + 1;
          }
        }
        for (let i = 0; i < maxRows; i++) {
          const addHead = slip.additionHeads[i] || '';
          const addVal = addHead ? fmt(slip.additionValues[i]) : '';
          const dedHead = slip.deductionHeads[i] || '';
          const dedVal = dedHead ? fmt(slip.deductionValues[i]) : '';

          rowsHtml += `
            <tr>
              <td style="border:1px solid #cccccc;">${addHead || '&nbsp;'}</td>
              <td style="text-align:right;border:1px solid #cccccc;">${addVal || '&nbsp;'}</td>
              <td style="border:1px solid #cccccc;">${dedHead || '&nbsp;'}</td>
              <td style="text-align:right;border:1px solid #cccccc;">${dedVal || '&nbsp;'}</td>
            </tr>
          `;
        }

        // Append post-tax earnings
        const postEarnings = [];
        if (slip.reimbursement) postEarnings.push({ label: 'Travel Allowance', val: slip.reimbursement });
        if (slip.overtime) postEarnings.push({ label: 'Overtime', val: slip.overtime });
        if (slip.incentives) postEarnings.push({ label: 'Incentives', val: slip.incentives });

        postEarnings.forEach((e) => {
          rowsHtml += `
            <tr>
              <td style="border:1px solid #cccccc;">${e.label}</td>
              <td style="text-align:right;border:1px solid #cccccc;">${fmt(e.val)}</td>
              <td style="border:1px solid #cccccc;">&nbsp;</td>
              <td style="text-align:right;border:1px solid #cccccc;">&nbsp;</td>
            </tr>
          `;
        });

        let finalTotalCtc = 0;
        let finalTotalDeductions = 0;
        slip.additionValues.forEach(v => { if (v) finalTotalCtc += v; });
        postEarnings.forEach(e => { finalTotalCtc += e.val; });
        slip.deductionValues.forEach(v => { if (v) finalTotalDeductions += v; });
        if (finalTotalCtc === 0 && slip.ctc) finalTotalCtc = slip.ctc;
        if (finalTotalDeductions === 0 && slip.deductions) finalTotalDeductions = slip.deductions;

        // Save these so we can use them in the rows below
        slip.finalTotalCtc = finalTotalCtc;
        slip.finalTotalDeductions = finalTotalDeductions;
      } else {
        rowsHtml = `
              <tr>
                <td style="border:1px solid #cccccc;">Basic</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.basic)}</td>
                <td style="border:1px solid #cccccc;">PF Employee</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.pfEmployee)}</td>
              </tr>
              <tr>
                <td style="border:1px solid #cccccc;">HRA</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.hra)}</td>
                <td style="border:1px solid #cccccc;">PF Employer</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.pfEmployer)}</td>
              </tr>
              <tr>
                <td style="border:1px solid #cccccc;">Medical</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.medical)}</td>
                <td style="border:1px solid #cccccc;">ESI</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.esi)}</td>
              </tr>
              <tr>
                <td style="border:1px solid #cccccc;">TA</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.ta)}</td>
                <td style="border:1px solid #cccccc;">PT</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.pt)}</td>
              </tr>
              <tr>
                <td style="border:1px solid #cccccc;">LTA</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.lta)}</td>
                <td style="border:1px solid #cccccc;">TDS</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.tds)}</td>
              </tr>
              <tr>
                <td style="border:1px solid #cccccc;">Special Allowance</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.specialAllowance)}</td>
                <td style="border:1px solid #cccccc;">Other Deductions</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.otherDeductions)}</td>
              </tr>
              <tr>
                <td style="border:1px solid #cccccc;">Travel Allowance</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.reimbursement)}</td>
                <td style="border:1px solid #cccccc;">&nbsp;</td>
                <td style="text-align:right;border:1px solid #cccccc;">&nbsp;</td>
              </tr>
              <tr>
                <td style="border:1px solid #cccccc;">Incentives</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.incentives)}</td>
                <td style="border:1px solid #cccccc;">&nbsp;</td>
                <td style="text-align:right;border:1px solid #cccccc;">&nbsp;</td>
              </tr>
              <tr>
                <td style="border:1px solid #cccccc;">Overtime</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.overtime)}</td>
                <td style="border:1px solid #cccccc;">&nbsp;</td>
                <td style="text-align:right;border:1px solid #cccccc;">&nbsp;</td>
              </tr>
        `;

        const ctcSum = (slip.basic || 0) + (slip.hra || 0) + (slip.medical || 0) + (slip.ta || 0) + (slip.lta || 0) + (slip.specialAllowance || 0) + (slip.reimbursement || 0) + (slip.incentives || 0) + (slip.overtime || 0);
        const dedSum = (slip.pfEmployee || 0) + (slip.pfEmployer || 0) + (slip.esi || 0) + (slip.pt || 0) + (slip.tds || 0) + (slip.otherDeductions || 0);

        slip.finalTotalCtc = ctcSum || slip.ctc;
        slip.finalTotalDeductions = dedSum || slip.deductions;
      }

      return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Salary Slip – ${month}</title></head>
<body style="margin:0;padding:0;background:#f4f6f3;font-family:Arial,Helvetica,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f3;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #d8ded2;">
        <tr>
          <td style="padding:24px 32px;text-align:center;border-bottom:1px solid #d8ded2;">
            <p style="margin:0;color:#111;font-size:22px;font-weight:700;">Varistor Technologies Pvt. Ltd.</p>
            <p style="margin:6px 0 0;color:#555;font-size:11px;">No. F-1107, Block-1, First Floor Ardente Office One, Hoodi Circle, ITPL Main Rd, Bengaluru, Karnataka 560048</p>
            <p style="margin:2px 0 0;color:#555;font-size:11px;">Email - hr@varistor.in, Telephone - 080 4117 8911</p>
          </td>
        </tr>
        <tr bgcolor="#fef08a">
          <td style="padding:10px;text-align:center;font-weight:bold;font-size:13px;color:#111;">
            Pay Slip for the Month of ${month}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 0;">
            <table width="100%" cellpadding="6" cellspacing="0" style="font-size:12px;border-collapse:collapse;border:1px solid #cccccc;">
              <tr>
                <td width="20%" style="font-weight:bold;border:1px solid #cccccc;background:#f9f9f9;">Emp ID.</td>
                <td width="30%" style="border:1px solid #cccccc;">${slip.employeeId || '—'}</td>
                <td width="20%" style="font-weight:bold;border:1px solid #cccccc;background:#f9f9f9;">Designation</td>
                <td width="30%" style="border:1px solid #cccccc;">${slip.designation || '—'}</td>
              </tr>
              <tr>
                <td style="font-weight:bold;border:1px solid #cccccc;background:#f9f9f9;">Employee Name</td>
                <td style="border:1px solid #cccccc;">${slip.name}</td>
                <td style="font-weight:bold;border:1px solid #cccccc;background:#f9f9f9;">Department</td>
                <td style="border:1px solid #cccccc;">${slip.department || '—'}</td>
              </tr>
              <tr>
                <td style="font-weight:bold;border:1px solid #cccccc;background:#f9f9f9;">No. of Days</td>
                <td style="border:1px solid #cccccc;">${slip.totalDays || 30}</td>
                <td style="font-weight:bold;border:1px solid #cccccc;background:#f9f9f9;">Paid No. of Days</td>
                <td style="border:1px solid #cccccc;">${slip.payDays || 30}</td>
              </tr>
              <tr>
                <td style="font-weight:bold;border:1px solid #cccccc;background:#f9f9f9;">PF UAN No.</td>
                <td style="border:1px solid #cccccc;">${slip.pfUan || '—'}</td>
                <td style="font-weight:bold;border:1px solid #cccccc;background:#f9f9f9;">CL Balance</td>
                <td style="border:1px solid #cccccc;">${slip.clBalance || 0}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;">
            <table width="100%" cellpadding="6" cellspacing="0" style="font-size:12px;border-collapse:collapse;border:1px solid #cccccc;">
              <tr bgcolor="#bfdbfe" style="font-weight:bold;">
                <td width="35%" style="border:1px solid #cccccc;">Earnings</td>
                <td width="15%" style="text-align:right;border:1px solid #cccccc;">Amount (Rs.)</td>
                <td width="35%" style="border:1px solid #cccccc;">Deductions</td>
                <td width="15%" style="text-align:right;border:1px solid #cccccc;">Amount (Rs.)</td>
              </tr>
              <tr>
                <td style="border:1px solid #cccccc;">Salary</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.monthlySalary)}</td>
                <td style="border:1px solid #cccccc;">PF Employee</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.pfEmployee)}</td>
              </tr>
              <tr>
                <td style="border:1px solid #cccccc;">Basic</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.basic)}</td>
                <td style="border:1px solid #cccccc;">PF Employer</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.pfEmployer)}</td>
              </tr>
              <tr>
                <td style="border:1px solid #cccccc;">HRA</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.hra)}</td>
                <td style="border:1px solid #cccccc;">ESI</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.esi)}</td>
              </tr>
              <tr>
                <td style="border:1px solid #cccccc;">Medical</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.medical)}</td>
                <td style="border:1px solid #cccccc;">PT</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.pt)}</td>
              </tr>
              <tr>
                <td style="border:1px solid #cccccc;">TA</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.ta)}</td>
                <td style="border:1px solid #cccccc;">TDS</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.tds)}</td>
              </tr>
              <tr>
                <td style="border:1px solid #cccccc;">LTA</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.lta)}</td>
                <td style="border:1px solid #cccccc;">Other Deductions</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.otherDeductions)}</td>
              </tr>
              <tr>
                <td style="border:1px solid #cccccc;">Special Allowance</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.specialAllowance)}</td>
                <td style="border:1px solid #cccccc;">&nbsp;</td>
                <td style="text-align:right;border:1px solid #cccccc;">&nbsp;</td>
              </tr>
              <tr>
                <td style="border:1px solid #cccccc;">Reimbursement</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.reimbursement)}</td>
                <td style="border:1px solid #cccccc;">&nbsp;</td>
                <td style="text-align:right;border:1px solid #cccccc;">&nbsp;</td>
              </tr>
              <tr>
                <td style="border:1px solid #cccccc;">Incentives</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.incentives)}</td>
                <td style="border:1px solid #cccccc;">&nbsp;</td>
                <td style="text-align:right;border:1px solid #cccccc;">&nbsp;</td>
              </tr>
              <tr>
                <td style="border:1px solid #cccccc;">OT Hours</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.overtime)}</td>
                <td style="border:1px solid #cccccc;">&nbsp;</td>
                <td style="text-align:right;border:1px solid #cccccc;">&nbsp;</td>
              </tr>
              <tr bgcolor="#f1f5f9" style="font-weight:bold;">
                <td style="border:1px solid #cccccc;">Total Earnings</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.finalTotalCtc)}</td>
                <td style="border:1px solid #cccccc;">Total Deduction</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.finalTotalDeductions)}</td>
              </tr>
              <tr>
                <td bgcolor="#e2e8f0" colspan="3" style="font-weight:bold;font-size:13px;border:1px solid #cccccc;">
                  Final Pay [In-Hand]
                </td>
                <td bgcolor="#e2e8f0" style="font-weight:bold;font-size:14px;text-align:right;border:1px solid #cccccc;">
                  ${fmt(finalPay)}
                </td>
              </tr>
              <tr>
                <td bgcolor="#f1f5f9" colspan="4" style="font-weight:bold;font-size:10px;text-align:center;border:1px solid #cccccc;">
                  ${words}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #d8ded2;text-align:center;font-size:11px;color:#868e80;">
            <p style="margin:0;font-weight:bold;">This is a computer generated payslip no signature is required.</p>
            <p style="margin:6px 0 0;">&#9993; Auto-dispatched via EOPMS Payroll System</p>
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

    const db = await readDB();
    const employees = db.employees || [];

    for (const slip of slips) {
      if (!slip.email || !slip.name) {
        failed.push({ email: slip.email || '(no email)', name: slip.name || '(no name)', error: 'Missing name or email' });
        continue;
      }
      const emp = employees.find(e => e.personalEmail === slip.email || e.employeeId === slip.employeeId);
      if (!emp || emp.status !== 'Active') {
        failed.push({ email: slip.email, name: slip.name, error: 'Employee is inactive or not found' });
        continue;
      }
      try {
        const month = slip.month || new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });
        const pdfBuffer = await generateSalarySlipPDF(slip);

        await transporter.sendMail({
          from: `"Varistor EOPMS" <${process.env.SMTP_USER}>`,
          to: slip.email,
          subject: `Your Salary Slip – ${month} | Varistor Technologies`,
          html: buildSlipHtml(slip),
          attachments: [
            {
              filename: `Salary_Slip_${month.replace(/\s+/g, '_')}.pdf`,
              content: pdfBuffer,
              contentType: 'application/pdf',
            }
          ],
        });
        sent.push({ email: slip.email, name: slip.name });
        console.log(`[Payroll] ✓ Sent to ${slip.name} <${slip.email}>`);
      } catch (err) {
        console.error(`[Payroll] Exception for ${slip.email}:`, err.message);
        failed.push({ email: slip.email, name: slip.name, error: err.message });
      }
      await new Promise(r => setTimeout(r, 120));
    }

    console.log(`[Payroll] Done — ${sent.length} sent, ${failed.length} failed`);
    return res.json({ success: true, sent: sent.length, sentList: sent, failed });
  } catch (outerErr) {
    console.error('[Payroll] ROUTE CRASHED:', outerErr);
    return res.status(500).json({ success: false, error: outerErr.message || 'Internal server error' });
  }
});

// ── Payroll Schedule & Records Routes ────────────────────────────────────────

// In-memory cron task handle (so we can reschedule when config changes)
let _payslipCronTask = null;

/**
 * Build slip data for an employee from db records.
 * Used by the cron auto-send to construct SlipRow objects server-side.
 */
async function buildSlipsFromDb() {
  try {
    const db = await readDB();
    const employees = db.employees || [];
    const payrollRecords = db.payroll_records || [];

    if (payrollRecords.length === 0) {
      console.log('[Payroll Cron] No payroll records found in db.json — skipping send.');
      return [];
    }

    // Keep only the latest revision for each employee to prevent duplicates and stale revisions
    const latestRecordsMap = {};
    for (const rec of payrollRecords) {
      const existing = latestRecordsMap[rec.employeeId];
      if (!existing || rec.revision > existing.revision) {
        latestRecordsMap[rec.employeeId] = rec;
      }
    }
    const filteredRecords = Object.values(latestRecordsMap);

    const slips = [];
    for (const rec of filteredRecords) {
      // rec.status !== 'approved' check removed so drafts are also sent
      const emp = employees.find(e => e.employeeId === rec.employeeId);
      if (!emp || !emp.personalEmail || emp.status !== 'Active') continue;

      const c = rec.components || {};
      slips.push({
        name: rec.employeeName,
        email: emp.personalEmail,
        employeeId: rec.employeeId,
        department: rec.department,
        designation: rec.designation,
        month: rec.month,
        monthlySalary: rec.monthlySalary || rec.ctc || 0,
        ctc: rec.ctc || rec.monthlySalary || 0,
        totalDays: rec.totalDays || getDaysInMonth(rec.month || 'June 2026'),
        payDays: rec.payDays || getDaysInMonth(rec.month || 'June 2026'),
        clBalance: rec.clBalance || 0,
        pfUan: rec.pfUan || '—',
        basic: c.basic || 0,
        hra: c.hra || 0,
        medical: c.medical || 0,
        ta: c.ta || 0,
        lta: c.lta || 0,
        specialAllowance: c.specialAllowance || 0,
        pfEmployee: c.pfEmployee || 0,
        pfEmployer: c.pfEmployer || 0,
        esi: c.esi || 0,
        pt: c.pt || 0,
        tds: c.tds || 0,
        reimbursement: c.reimbursement || 0,
        incentives: c.incentives || 0,
        overtime: c.overtime || 0,
        otherDeductions: c.otherDeductions || 0,
        deductions: (c.pfEmployee || 0) + (c.esi || 0) + (c.pt || 0) + (c.tds || 0) + (c.otherDeductions || 0),
        netPay: rec.netPay || 0,
        finalPay: rec.finalPay || 0,
        deduction: rec.deduction || 0,
        additionHeads: rec.additionHeads || [],
        deductionHeads: rec.deductionHeads || [],
        additionValues: rec.additionValues || [],
        deductionValues: rec.deductionValues || [],
      });
    }
    return slips;
  } catch (err) {
    console.error('[Payroll Cron] Error building slips:', err);
    return [];
  }
}

/**
 * Core dispatch function — used by both cron and manual trigger.
 * Builds slips from db, calls send-slips logic, updates lastRun.
 */
async function dispatchPayslips() {
  console.log('[Payroll Cron] Starting auto-dispatch...');
  const slips = await buildSlipsFromDb();
  if (slips.length === 0) {
    console.log('[Payroll Cron] No slips to send.');
    return { sent: 0, failed: [], skipped: true };
  }

  // Reuse internal send logic by making an internal HTTP request
  try {
    const result = await fetch('http://localhost:3001/api/payroll/send-slips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slips }),
    });
    const data = await result.json();

    // Update lastRun in db
    const db = await readDB();
    if (!db.payroll_schedule) db.payroll_schedule = {};
    db.payroll_schedule.lastRun = new Date().toISOString();
    await writeDB(db);

    console.log(`[Payroll Cron] Done — ${data.sent} sent, ${(data.failed || []).length} failed.`);
    return data;
  } catch (err) {
    console.error('[Payroll Cron] Dispatch error:', err);
    return { sent: 0, failed: [{ error: err.message }] };
  }
}

/**
 * Schedule or re-schedule the cron job based on the schedule config.
 */
function scheduleCronJob(schedule) {
  if (_payslipCronTask) {
    _payslipCronTask.stop();
    _payslipCronTask = null;
    console.log('[Payroll Cron] Previous cron task stopped.');
  }

  if (!schedule || !schedule.enabled) {
    console.log('[Payroll Cron] Scheduling is disabled.');
    return;
  }

  const day = Math.min(28, Math.max(1, parseInt(schedule.day) || 10));
  const hour = Math.min(23, Math.max(0, parseInt(schedule.hour) || 10));
  const minute = Math.min(59, Math.max(0, parseInt(schedule.minute) || 0));

  const cronExpr = `${minute} ${hour} ${day} * *`;
  console.log(`[Payroll Cron] Scheduled: '${cronExpr}' (day=${day}, ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')})`);

  _payslipCronTask = cron.schedule(cronExpr, async () => {
    console.log('[Payroll Cron] Cron triggered — dispatching payslips...');
    await dispatchPayslips();
  }, { timezone: 'Asia/Kolkata' });
}

// Bootstrap cron on server start
(async () => {
  try {
    const db = await readDB();
    const schedule = db.payroll_schedule;
    if (schedule) {
      scheduleCronJob(schedule);
    }
  } catch (err) {
    console.error('[Payroll Cron] Failed to load schedule on startup:', err);
  }
})();

// GET /api/payroll/schedule — return current schedule config
app.get('/api/payroll/schedule', async (req, res) => {
  try {
    const db = await readDB();
    res.json(db.payroll_schedule || { day: 10, hour: 10, minute: 0, enabled: true, lastRun: null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/payroll/schedule — update schedule config and reschedule cron
app.put('/api/payroll/schedule', async (req, res) => {
  try {
    const { day, hour, minute, enabled } = req.body;
    const db = await readDB();
    const existing = db.payroll_schedule || {};
    const newSchedule = {
      ...existing,
      day: parseInt(day) || 10,
      hour: parseInt(hour) || 10,
      minute: parseInt(minute) || 0,
      enabled: enabled !== false,
    };
    db.payroll_schedule = newSchedule;
    await writeDB(db);
    scheduleCronJob(newSchedule);
    console.log('[Payroll Schedule] Updated:', newSchedule);
    res.json({ success: true, schedule: newSchedule });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/payroll/records — sync latest payroll records from client to server
app.post('/api/payroll/records', async (req, res) => {
  try {
    const { records } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ success: false, error: 'records must be an array.' });
    }
    const db = await readDB();
    db.payroll_records = records;
    await writeDB(db);
    console.log(`[Payroll Records] Synced ${records.length} records from client.`);
    res.json({ success: true, count: records.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/payroll/trigger-send — manually trigger payslip dispatch now
app.post('/api/payroll/trigger-send', async (req, res) => {
  try {
    console.log('[Payroll] Manual trigger-send requested');
    const result = await dispatchPayslips();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── CL Balance Routes ─────────────────────────────────────────────────────────

// GET all CL balances (HR view)
app.get('/api/cl-balances', async (req, res) => {
  const db = await readDB();
  res.json(db.employee_cl_balances || {});
});

// GET one employee's CL balance
app.get('/api/cl-balances/:employeeId', async (req, res) => {
  const db = await readDB();
  const balances = db.employee_cl_balances || {};
  const bal = balances[req.params.employeeId];
  if (!bal) {
    return res.json({ total: 12, used: 0 }); // default
  }
  res.json(bal);
});

// PUT — HR sets total CL days for an employee
app.put('/api/cl-balances/:employeeId', async (req, res) => {
  try {
    const db = await readDB();
    if (!db.employee_cl_balances) db.employee_cl_balances = {};
    const empId = req.params.employeeId;
    const existing = db.employee_cl_balances[empId] || { total: 12, used: 0 };

    let newTotal = existing.total;
    let newUsed = existing.used;

    if (req.body.total !== undefined) {
      newTotal = parseInt(req.body.total, 10);
      if (isNaN(newTotal) || newTotal < 0) return res.status(400).json({ success: false, error: 'Invalid total value.' });
    }

    if (req.body.used !== undefined) {
      newUsed = parseInt(req.body.used, 10);
      if (isNaN(newUsed) || newUsed < 0) return res.status(400).json({ success: false, error: 'Invalid used value.' });
    }

    db.employee_cl_balances[empId] = { total: newTotal, used: newUsed };
    await writeDB(db);
    res.json({ success: true, balance: db.employee_cl_balances[empId] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Leaves Routes
app.get('/api/leaves', async (req, res) => {
  const db = await readDB();
  res.json(db.leaves || []);
});

app.post('/api/leaves', async (req, res) => {
  try {
    const db = await readDB();
    if (!db.leaves) db.leaves = [];
    const newLeave = {
      id: 'leave-' + Date.now().toString(),
      ...req.body,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    db.leaves.push(newLeave);

    // Also add to activity log
    if (!db.activity_log) db.activity_log = [];
    db.activity_log.push({
      id: Date.now().toString(),
      action: 'APPLY_LEAVE',
      by: newLeave.employeeName,
      details: `${newLeave.employeeName} applied for ${newLeave.type} from ${newLeave.startDate} to ${newLeave.endDate}`,
      timestamp: new Date().toISOString()
    });

    await writeDB(db);
    res.json({ success: true, leave: newLeave });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/leaves/:id', async (req, res) => {
  try {
    const db = await readDB();
    if (!db.leaves) db.leaves = [];
    const index = db.leaves.findIndex(l => l.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Leave request not found.' });
    }
    db.leaves[index].status = req.body.status;

    // Log activity
    if (!db.activity_log) db.activity_log = [];
    db.activity_log.push({
      id: Date.now().toString(),
      action: `LEAVE_${req.body.status.toUpperCase()}`,
      by: 'hr@varistor.in',
      details: `${req.body.status} leave request for ${db.leaves[index].employeeName}`,
      timestamp: new Date().toISOString()
    });

    await writeDB(db);
    res.json({ success: true, leave: db.leaves[index] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/leave/notify-manager
// Sends an email to the reporting manager when an employee submits a leave request
app.post('/api/leave/notify-manager', async (req, res) => {
  try {
    const { employeeName, leaveType, from, to, days, reason, managerEmail } = req.body;

    if (!employeeName || !leaveType || !from || !to || !managerEmail) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    await transporter.sendMail({
      from: `"Varistor EOPMS" <${process.env.SMTP_USER}>`,
      to: managerEmail,
      subject: `Leave Request: ${employeeName} – ${leaveType} (${days} day/s)`,
      html: `
        <div style="font-family: Inter, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <div style="background: #84CC16; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #000; margin: 0; font-size: 20px; font-weight: 700;">Varistor EOPMS</h1>
          </div>
          <div style="background: #ffffff; padding: 32px; border: 1px solid #D8DED2; border-radius: 0 0 8px 8px;">
            <h2 style="font-size: 18px; font-weight: 600; color: #111;">New Leave Request</h2>
            <p style="color: #444; line-height: 1.6;">A leave request is awaiting your review on <strong>Varistor EOPMS</strong>.</p>
            <table style="width:100%; border-collapse:collapse; margin: 20px 0;">
              <tr style="background:#f9f9f9;">
                <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Employee</td>
                <td style="padding:10px 12px; border:1px solid #eee;">${employeeName}</td>
              </tr>
              <tr>
                <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Type</td>
                <td style="padding:10px 12px; border:1px solid #eee;">${leaveType}</td>
              </tr>
              <tr style="background:#f9f9f9;">
                <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Dates</td>
                <td style="padding:10px 12px; border:1px solid #eee;">${from} → ${to} (${days} working day/s)</td>
              </tr>
              <tr>
                <td style="padding:10px 12px; font-weight:600; border:1px solid #eee;">Reason</td>
                <td style="padding:10px 12px; border:1px solid #eee;">${reason || '—'}</td>
              </tr>
            </table>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${process.env.APP_URL || 'http://localhost:5173'}" style="display: inline-block; background: #84CC16; color: #000; font-weight: 600; padding: 12px 24px; border-radius: 6px; text-decoration: none;">Review in EOPMS →</a>
            </div>
          </div>
        </div>
      `,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ success: false, error: 'Failed to send leave notification email' });
  }
});

// POST /api/leave/notify-employee
// Sends email to employee when their leave is approved or rejected
app.post('/api/leave/notify-employee', async (req, res) => {
  try {
    const { employeeEmail, employeeName, leaveId, status, comment } = req.body;

    if (!employeeEmail || !leaveId || !status) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const approved = status === 'Approved';
    const statusColor = approved ? '#84CC16' : '#ef4444';

    await transporter.sendMail({
      from: `"Varistor EOPMS" <${process.env.SMTP_USER}>`,
      to: employeeEmail,
      subject: `Your Leave Request ${leaveId} has been ${status}`,
      html: `
        <div style="font-family: Inter, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <div style="background: ${statusColor}; padding: 16px 24px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #000; margin: 0; font-size: 20px; font-weight: 700;">Varistor EOPMS</h1>
          </div>
          <div style="background: #ffffff; padding: 32px; border: 1px solid #D8DED2; border-radius: 0 0 8px 8px;">
            <h2 style="font-size: 18px; font-weight: 600; color: #111;">Leave ${status}</h2>
            <p style="color: #444; line-height: 1.6;">Hi ${employeeName || ''},</p>
            <p style="color: #444; line-height: 1.6;">Your leave request <strong>${leaveId}</strong> has been <strong style="color:${statusColor};">${status.toLowerCase()}</strong>.</p>
            ${!approved && comment ? `<p style="background:#fef2f2; border:1px solid #fecaca; padding:12px; border-radius:4px; font-size:13px;"><strong>Reviewer comment:</strong> ${comment}</p>` : ''}
            <p style="color: #888; font-size: 12px; margin-top: 32px;">This is an automated message from Varistor EOPMS Leave Management.</p>
          </div>
        </div>
      `,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ success: false, error: 'Failed to send leave status email' });
  }
});




const MOCK_EMPLOYEE_NAMES = {
  'VAR-024': 'Aarav Patel',
  'VAR-001': 'Admin User',
  'VAR-002': 'HR User'
};

// BIO PARK D-01 DEVICE BRIDGE — Attendance Module
// ZKTeco ADMS protocol over TCP port 4370 at 192.168.1.42
// Gracefully falls back to mock data when device is offline.
// ═══════════════════════════════════════════════════════════════════════

// ─── In-memory cache ───────────────────────────────────────────────────────

const MAX_FEED_EVENTS = 20;
const DEVICE_IP = '192.168.1.42';
const DEVICE_PORT = 4370;
const POLL_INTERVAL_MS = 60000;

// Punch dedup: map of employeeId → last punch timestamp (ms)
const lastPunchTs = new Map();
const DEDUP_WINDOW_MS = 30000; // 30-second guard

let _liveFeed = [];
let _deviceStatus = {
  ipAddress: DEVICE_IP,
  enrolledFaces: 40,
  lastSync: null,
  firmware: 'ZKTeco v6.60',
  uptime: '—',
  online: false,
};

// ─── Seed mock feed on startup (device offline) ────────────────────────────

async function seedMockFeed() {
  try {
    const data = await fs.readFile(path.join(process.cwd(), 'db.json'), 'utf-8');
    const db = JSON.parse(data);
    const emps = db.employees || [];
    const now = Date.now();
    _liveFeed = emps.slice(0, 15).map((emp, i) => ({
      id: `pev-seed-${i}`,
      timestamp: new Date(now - (15 - i) * 13 * 60000).toISOString(),
      employeeId: emp.employeeId,
      employeeName: emp.fullName,
      type: i % 3 === 2 ? 'out' : 'in',
      confidence: parseFloat((85 + Math.random() * 12).toFixed(1)),
      success: true,
    }));
  } catch (err) {
    console.warn('[Device Bridge] Could not seed mock feed from db.json:', err.message);
  }
}

seedMockFeed();

// ─── ZKTeco ADMS TCP punch pull ────────────────────────────────────────────

/**
 * ZKTeco ADMS protocol handshake and attendance record pull over TCP.
 * If the device is unreachable, marks device as offline and logs the error.
 * TODO: Implement full ZKTeco ADMS command set for production:
 *   CMD_CONNECT (0x03E8) → CMD_ATTLOG (0x000D) → parse binary attendance records
 */
function pollDevice() {
  const socket = new net.Socket();
  let connected = false;
  let buffer = Buffer.alloc(0);

  socket.setTimeout(5000);

  socket.connect(DEVICE_PORT, DEVICE_IP, () => {
    connected = true;
    console.log(`[Device Bridge] Connected to Bio Park D-01 at ${DEVICE_IP}:${DEVICE_PORT}`);
    // TODO: Send ZKTeco CMD_CONNECT handshake packet
    // TODO: Request attendance log via CMD_ATTLOG
    // For now: mark device online and update status
    _deviceStatus = {
      ipAddress: DEVICE_IP,
      enrolledFaces: 40,
      lastSync: new Date().toISOString(),
      firmware: 'ZKTeco v6.60',
      uptime: '—',
      online: true,
    };
    socket.end();
  });

  socket.on('data', (data) => {
    buffer = Buffer.concat([buffer, data]);
    // Parse ZKTeco ADMS binary packet format
    // Format (simplified): 
    // bytes 0-3: Magic Header
    // bytes 4-5: Size
    // bytes 6-7: Command ID
    // bytes 8-24: Employee ID (String/Null terminated)
    // byte 25: Punch type (0 = In, 1 = Out)
    // bytes 26-29: Timestamp

    try {
      // While we have enough bytes for a complete packet (assume 30 bytes for simplified parser)
      while (buffer.length >= 30) {
        const packetData = buffer.slice(0, 30);
        buffer = buffer.slice(30);

        let empIdRaw = packetData.slice(8, 24).toString('ascii').replace(/\0/g, '').trim();
        let punchTypeRaw = packetData.readUInt8(25);
        let type = punchTypeRaw === 0 ? 'in' : 'out';

        let employeeId = empIdRaw;
        if (/^\d+$/.test(empIdRaw)) {
          employeeId = `VAR-${empIdRaw.padStart(3, '0')}`;
        }

        console.log(`[Device Bridge] Parsed Punch Event => Emp: ${employeeId}, Type: ${type}`);

        // Calculate a dummy confidence for the mock/hardware mix
        const confidence = parseFloat((85 + Math.random() * 12).toFixed(1));

        processPunchEvent(employeeId, type, confidence);
      }
    } catch (err) {
      console.error('[Device Bridge] Packet parsing error:', err.message);
    }
  });

  socket.on('timeout', () => {
    console.warn(`[Device Bridge] TCP timeout — ${DEVICE_IP}:${DEVICE_PORT}`);
    socket.destroy();
    markDeviceOffline();
  });

  socket.on('error', (err) => {
    if (connected) return;
    // Expected in dev — device not on this LAN
    console.warn(`[Device Bridge] ${DEVICE_IP}:${DEVICE_PORT} unreachable — running in mock mode. (${err.code})`);
    markDeviceOffline();
  });

  socket.on('close', () => {
    // nothing
  });
}

function markDeviceOffline() {
  _deviceStatus = {
    ..._deviceStatus,
    online: false,
    lastSync: new Date().toISOString(),
  };
}

/**
 * Process a parsed punch event from the device.
 * Guards against duplicate punches within 30 seconds.
 */
function processPunchEvent(employeeId, type, confidence) {
  const now = Date.now();
  const lastTs = lastPunchTs.get(employeeId);
  if (lastTs && now - lastTs < DEDUP_WINDOW_MS) {
    console.log(`[Device Bridge] Dedup: ignored punch for ${employeeId} (within 30s window)`);
    return;
  }
  lastPunchTs.set(employeeId, now);

  const event = {
    id: `pev-${now}-${employeeId}`,
    timestamp: new Date().toISOString(),
    employeeId,
    employeeName: MOCK_EMPLOYEE_NAMES[employeeId] || employeeId,
    type,
    confidence: parseFloat(confidence.toFixed(1)),
    success: true,
  };

  _liveFeed.unshift(event);
  if (_liveFeed.length > MAX_FEED_EVENTS) {
    _liveFeed = _liveFeed.slice(0, MAX_FEED_EVENTS);
  }

  console.log(`[Device Bridge] ✓ ${employeeId} ${type.toUpperCase()} confidence=${confidence}%`);
}

// Start polling on server boot
pollDevice();
setInterval(pollDevice, POLL_INTERVAL_MS);

// ─── Attendance API routes ─────────────────────────────────────────────────

app.get('/api/attendance/live-feed', (req, res) => {
  res.json(_liveFeed);
});

app.get('/api/attendance/device-status', (req, res) => {
  res.json(_deviceStatus);
});

app.post('/api/attendance/force-resync', (req, res) => {
  console.log('[Device Bridge] Force re-sync triggered via API');
  pollDevice();
  res.json({ success: true, message: 'Re-sync triggered', timestamp: new Date().toISOString() });
});

// ─── Attendance PDF export ─────────────────────────────────────────────────

app.post('/api/attendance/export-pdf', (req, res) => {
  try {
    const { rows = [], month = 'Report', type = 'monthly' } = req.body;

    // ── Page setup: A4 landscape for more column space ──────────────────────
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    const bufs = [];
    doc.on('data', d => bufs.push(d));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(bufs);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="attendance_${month.replace(/\s+/g, '_')}.pdf"`);
      res.send(pdfBuffer);
    });

    const pageW = doc.page.width;
    const marginL = doc.page.margins.left;
    const usableW = pageW - marginL - doc.page.margins.right;

    // ── Header ──────────────────────────────────────────────────────────────
    doc.rect(marginL, 36, usableW, 32).fill('#84CC16');
    doc.fillColor('#1a2e05').fontSize(15).font('Helvetica-Bold')
      .text('Varistor EOPMS — Attendance Report', marginL + 10, 45, { lineBreak: false });
    const subtitle = `${type === 'monthly' ? 'Monthly' : 'Daily'}: ${month}  ·  Generated: ${new Date().toLocaleDateString('en-IN')}`;
    doc.fillColor('#1a2e05').fontSize(9).font('Helvetica')
      .text(subtitle, 0, 49, { align: 'right', lineBreak: false });

    doc.y = 36 + 32 + 10; // below header bar

    // ── Column definitions ───────────────────────────────────────────────────
    const cols = type === 'monthly'
      ? [
        { label: 'Emp ID', key: 'employee_id', w: 60 },
        { label: 'Employee', key: 'employeeName', w: 140 },
        { label: 'Dept', key: 'department', w: 90 },
        { label: 'Present', key: 'present', w: 52 },
        { label: 'Leaves', key: 'leaves', w: 48 },
        { label: 'W.O', key: 'weekOff', w: 40 },
        { label: 'Holidays', key: 'holidays', w: 52 },
        { label: 'Half-day', key: 'halfDay', w: 52 },
        { label: 'Absent', key: 'absent', w: 48 },
        { label: 'Total Hrs', key: 'totalHrs', w: 58 },
        { label: 'Payable Days', key: 'payableDays', w: 70 },
      ]
      : [
        { label: 'Emp ID', key: 'employee_id', w: 60 },
        { label: 'Employee', key: 'employeeName', w: 150 },
        { label: 'Dept', key: 'department', w: 100 },
        { label: 'Date', key: 'date', w: 75 },
        { label: 'Punch IN', key: 'punch_in', w: 80 },
        { label: 'Punch OUT', key: 'punch_out', w: 80 },
        { label: 'Work Hrs', key: 'work_hours', w: 60 },
        { label: 'Status', key: 'status', w: 65 },
      ];

    // Scale widths to fill exact usable width
    const totalW = cols.reduce((s, c) => s + c.w, 0);
    const scale = usableW / totalW;
    cols.forEach(c => { c.w = Math.floor(c.w * scale); });

    const rowH = 18;

    function drawRow(y, values, isBg, isHeader) {
      // Row background
      if (isHeader) {
        doc.rect(marginL, y, usableW, rowH).fill('#2d5a00');
      } else if (isBg) {
        doc.rect(marginL, y, usableW, rowH).fill('#f0fce4');
      } else {
        doc.rect(marginL, y, usableW, rowH).fill('#ffffff');
      }

      // Cell text + vertical dividers
      let x = marginL;
      values.forEach((val, i) => {
        const w = cols[i].w;
        const str = String(val ?? '');

        doc
          .fillColor(isHeader ? '#ffffff' : '#111111')
          .fontSize(isHeader ? 8 : 7.5)
          .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
          .text(str, x + 4, y + (rowH - 8) / 2, {
            width: w - 8,
            lineBreak: false,
            ellipsis: true,
          });

        // Vertical separator (except after last col)
        if (i < values.length - 1) {
          doc.strokeColor(isHeader ? '#4d8a00' : '#d0e8b8')
            .lineWidth(0.4)
            .moveTo(x + w, y).lineTo(x + w, y + rowH).stroke();
        }
        x += w;
      });

      // Bottom border for each row
      doc.strokeColor(isHeader ? '#1a4000' : '#c5e0a0')
        .lineWidth(0.4)
        .moveTo(marginL, y + rowH).lineTo(marginL + usableW, y + rowH).stroke();
    }

    // ── Column header ────────────────────────────────────────────────────────
    const headerY = doc.y;
    drawRow(headerY, cols.map(c => c.label), false, true);
    doc.y = headerY + rowH;

    // ── Data rows ────────────────────────────────────────────────────────────
    let pageRowCount = 0;
    const rowsPerPage = Math.floor((doc.page.height - doc.page.margins.top - doc.page.margins.bottom - 80) / rowH);

    rows.forEach((row, idx) => {
      if (pageRowCount > 0 && pageRowCount % rowsPerPage === 0) {
        // Footer on current page
        doc.fontSize(7).fillColor('#888888').font('Helvetica')
          .text(`Page ${Math.ceil(idx / rowsPerPage)}`, 0, doc.page.height - 30, { align: 'center', lineBreak: false });
        doc.addPage();
        // Reprint column headers on new page
        const newHeaderY = doc.page.margins.top;
        doc.y = newHeaderY;
        drawRow(newHeaderY, cols.map(c => c.label), false, true);
        doc.y = newHeaderY + rowH;
        pageRowCount = 0;
      }

      const rowY = doc.y;
      const values = type === 'monthly'
        ? [row.employee_id || '', row.employeeName, row.department, row.present, row.leaves, row.weekOff, row.holidays, row.halfDay ?? 0, row.absent, row.totalHrs, row.payableDays]
        : [row.employee_id || '', row.employeeName, row.department, row.date, row.punch_in || '—', row.punch_out || '—', row.work_hours || '—', row.status];

      drawRow(rowY, values, idx % 2 === 1, false);
      doc.y = rowY + rowH;
      pageRowCount++;
    });

    // Footer on last page
    doc.fontSize(7).fillColor('#888888').font('Helvetica')
      .text('Varistor EOPMS — Confidential', 0, doc.page.height - 30, { align: 'center', lineBreak: false });

    doc.end();
  } catch (err) {
    console.error('[Attendance PDF]', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Expose processPunchEvent for future device integration ───────────────
// When the ZKTeco ADMS parser is complete, call processPunchEvent() with
// parsed data from the binary packet stream.
app._processPunchEvent = processPunchEvent;


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
  console.log(`[Email Server] running on port ${port}`);
});
