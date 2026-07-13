import express from 'express';
import dotenv from 'dotenv';
import { Resend } from 'resend';
import PDFDocument from 'pdfkit';
import fs from 'fs/promises';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import cron from 'node-cron';

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
          Array.isArray(slip.deductionHeads) && Array.isArray(slip.deductionValues)) {
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
          { label: 'Salary', val: slip.monthlySalary },
          { label: 'Basic', val: slip.basic },
          { label: 'HRA', val: slip.hra },
          { label: 'Medical', val: slip.medical },
          { label: 'TA', val: slip.ta },
          { label: 'LTA', val: slip.lta },
          { label: 'Special Allowance', val: slip.specialAllowance },
          { label: 'Reimbursement', val: slip.reimbursement },
          { label: 'Incentives', val: slip.incentives },
          { label: 'OT Hours', val: slip.overtime },
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

      let maxPdfRows = 0;
      for (let i = 0; i < 10; i++) {
        if (earnings[i].label || deductions[i].label) {
          maxPdfRows = i + 1;
        }
      }
      if (maxPdfRows === 0) maxPdfRows = 10;

      let currentY = 204;
      for (let idx = 0; idx < maxPdfRows; idx++) {
        const earn = earnings[idx];
        doc.fillColor('#111111').fontSize(8.5).font('Helvetica');
        if (earn.label) {
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
      doc.text('Total CTC', 45, currentY + 5);
      doc.text(fmt(slip.ctc), 210, currentY + 5, { align: 'right', width: 82 });
      
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

      const finalPay = slip.netPay - (slip.deduction || 0);

      // Net Pay Row
      doc.rect(40, currentY, 257.5, 36).fill('#e2e8f0');
      doc.rect(297.5, currentY, 257.5, 36).fill('#f1f5f9');
      
      doc.fillColor('#111111').fontSize(10).font('Helvetica-Bold');
      
      if (slip.deduction && slip.deduction > 0) {
        doc.text('Final Pay [In-Hand]', 45, currentY + 13);
        doc.fontSize(14).font('Helvetica-Bold');
        doc.text(fmt(finalPay), 150, currentY + 11, { align: 'right', width: 140 });

        const words = numberToWords(finalPay);
        doc.fillColor('#111111').fontSize(7.5).font('Helvetica-Bold');
        doc.text(`Net Pay: ${fmt(slip.netPay)} | Deduction: ${fmt(slip.deduction)}\n${words}`, 305, currentY + 7, { width: 242, align: 'center' });
      } else {
        doc.text('NetPay [In-Hand]', 45, currentY + 13);
        doc.fontSize(14).font('Helvetica-Bold');
        doc.text(fmt(slip.netPay), 150, currentY + 11, { align: 'right', width: 140 });

        const words = numberToWords(slip.netPay);
        doc.fillColor('#111111').fontSize(7.5).font('Helvetica-Bold');
        doc.text(words, 305, currentY + 14, { width: 242, align: 'center' });
      }

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
    console.log(`[Payroll] Resend API key present: ${!!process.env.VITE_RESEND_API_KEY}`);

    const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 });

    const buildSlipHtml = (slip) => {
      const month = slip.month || new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      const finalPay = slip.netPay - (slip.deduction || 0);
      const words = numberToWords(finalPay);

      let rowsHtml = '';
      if (Array.isArray(slip.additionHeads) && Array.isArray(slip.additionValues) &&
          Array.isArray(slip.deductionHeads) && Array.isArray(slip.deductionValues)) {
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
      } else {
        rowsHtml = `
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
        `;
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
              ${rowsHtml}
              <tr bgcolor="#f1f5f9" style="font-weight:bold;">
                <td style="border:1px solid #cccccc;">Total CTC</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.ctc)}</td>
                <td style="border:1px solid #cccccc;">Total Deduction</td>
                <td style="text-align:right;border:1px solid #cccccc;">${fmt(slip.deductions)}</td>
              </tr>
              <tr>
                <td bgcolor="#e2e8f0" style="font-weight:bold;font-size:13px;border:1px solid #cccccc;">
                  ${slip.deduction && slip.deduction > 0 ? 'Final Pay [In-Hand]' : 'NetPay [In-Hand]'}
                </td>
                <td bgcolor="#e2e8f0" style="font-weight:bold;font-size:14px;text-align:right;border:1px solid #cccccc;">
                  ${fmt(finalPay)}
                </td>
                <td bgcolor="#f1f5f9" colspan="2" style="font-weight:bold;font-size:10px;text-align:center;border:1px solid #cccccc;">
                  ${slip.deduction && slip.deduction > 0 ? `Net Pay: ${fmt(slip.netPay)} | Deduction: ${fmt(slip.deduction)}<br/>` : ''}${words}
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

    for (const slip of slips) {
      if (!slip.email || !slip.name) {
        failed.push({ email: slip.email || '(no email)', name: slip.name || '(no name)', error: 'Missing name or email' });
        continue;
      }
      try {
        const month = slip.month || new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });
        const pdfBuffer = await generateSalarySlipPDF(slip);

        const result = await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: slip.email,
          subject: `Your Salary Slip – ${month} | Varistor Technologies`,
          html: buildSlipHtml(slip),
          attachments: [
            {
              filename: `Salary_Slip_${month.replace(/\s+/g, '_')}.pdf`,
              content: pdfBuffer.toString('base64'),
            }
          ]
        });
        // Resend SDK can return { data, error } or throw
        const resendError = result?.error;
        if (resendError) {
          const msg = resendError.message || JSON.stringify(resendError);
          console.error(`[Payroll] Resend error for ${slip.email}:`, msg);
          failed.push({ email: slip.email, name: slip.name, error: msg });
        } else {
          sent.push(slip.email);
          console.log(`[Payroll] ✓ Sent to ${slip.name} <${slip.email}>`);
        }
      } catch (err) {
        console.error(`[Payroll] Exception for ${slip.email}:`, err.message);
        failed.push({ email: slip.email, name: slip.name, error: err.message });
      }
      await new Promise(r => setTimeout(r, 120));
    }

    console.log(`[Payroll] Done — ${sent.length} sent, ${failed.length} failed`);
    return res.json({ success: true, sent: sent.length, failed });
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

    const slips = [];
    for (const rec of payrollRecords) {
      if (!rec.slipReleased && rec.status !== 'approved') continue; // Only send approved/released slips
      const emp = employees.find(e => e.employeeId === rec.employeeId);
      if (!emp || !emp.personalEmail) continue;

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
        totalDays: rec.totalDays || 30,
        payDays: rec.payDays || 30,
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
        deductions: (c.pfEmployee || 0) + (c.pfEmployer || 0) + (c.esi || 0) + (c.pt || 0) + (c.tds || 0) + (c.otherDeductions || 0),
        netPay: rec.netPay || 0,
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
  console.log(`[Payroll Cron] Scheduled: '${cronExpr}' (day=${day}, ${hour.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')})`);

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
    const newTotal = parseInt(req.body.total, 10);
    if (isNaN(newTotal) || newTotal < 0) {
      return res.status(400).json({ success: false, error: 'Invalid total value.' });
    }
    db.employee_cl_balances[empId] = { ...existing, total: newTotal };
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
    // Enforce mandatory reason
    const reason = (req.body.reason || '').trim();
    if (!reason || reason.length < 10) {
      return res.status(400).json({ success: false, error: 'A reason of at least 10 characters is required.' });
    }

    const db = await readDB();
    if (!db.leaves) db.leaves = [];
    const newLeave = {
      id: 'leave-' + Date.now().toString(),
      ...req.body,
      reason,
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

    const leave = db.leaves[index];
    const prevStatus = leave.status;
    const newStatus = req.body.status;
    db.leaves[index].status = newStatus;

    // Track CL used in employee_cl_balances when Casual Leave is approved/unapproved
    if (leave.type === 'Casual Leave' || leave.type === 'Casual') {
      if (!db.employee_cl_balances) db.employee_cl_balances = {};
      const empId = leave.employeeId;
      if (!db.employee_cl_balances[empId]) {
        db.employee_cl_balances[empId] = { total: 12, used: 0 };
      }
      const days = parseInt(leave.days, 10) || 0;
      // Approving: increment used
      if (newStatus === 'Approved' && prevStatus !== 'Approved') {
        db.employee_cl_balances[empId].used = (db.employee_cl_balances[empId].used || 0) + days;
      }
      // Revoking approval (e.g. back to Pending or Rejected): decrement used
      if (prevStatus === 'Approved' && newStatus !== 'Approved') {
        db.employee_cl_balances[empId].used = Math.max(0, (db.employee_cl_balances[empId].used || 0) - days);
      }
    }

    // Log activity
    if (!db.activity_log) db.activity_log = [];
    db.activity_log.push({
      id: Date.now().toString(),
      action: `LEAVE_${newStatus.toUpperCase()}`,
      by: 'hr@varistor.in',
      details: `${newStatus} leave request for ${db.leaves[index].employeeName}`,
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

    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: managerEmail,
      subject: `Leave Request: ${employeeName} – ${leaveType} (${days} day/s)`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background-color: #84CC16; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">New Leave Request</h1>
          </div>
          <div style="padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
            <p>A leave request is awaiting your review on <strong>Varistor EOPMS</strong>.</p>
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
              <a href="http://localhost:5173" style="background-color: #84CC16; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-weight: bold;">Approve / Reject in EOPMS</a>
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

    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: employeeEmail,
      subject: `Your Leave Request ${leaveId} has been ${status}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <div style="background-color: ${statusColor}; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0;">Leave ${status}</h1>
          </div>
          <div style="padding: 24px; border: 1px solid #eee; border-top: none; border-radius: 0 0 8px 8px;">
            <p>Hi ${employeeName || ''},</p>
            <p>Your leave request <strong>${leaveId}</strong> has been <strong style="color:${statusColor};">${status.toLowerCase()}</strong>.</p>
            ${!approved && comment ? `<p style="background:#fef2f2; border:1px solid #fecaca; padding:12px; border-radius:4px; font-size:13px;"><strong>Reviewer comment:</strong> ${comment}</p>` : ''}
            <p style="font-size:12px; color:#888; margin-top:24px;">This is an automated message from Varistor EOPMS Leave Management.</p>
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
      // TODO: Parse ZKTeco ADMS binary packet format
      // Each attendance record: userId(9B) + timestamp(4B) + type(1B) + ...
      // processDevicePacket(buffer);
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
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const bufs = [];
      doc.on('data', d => bufs.push(d));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(bufs);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="attendance_${month.replace(/\s+/g, '_')}.pdf"`);
        res.send(pdfBuffer);
      });

      // Header
      doc.fontSize(18).fillColor('#111111').text(`Varistor EOPMS — Attendance Report`, { align: 'center' });
      doc.fontSize(11).fillColor('#868e80').text(`Month: ${month} · Generated: ${new Date().toLocaleDateString('en-IN')}`, { align: 'center' });
      doc.moveDown(1);

      // Table header
      const cols = type === 'monthly'
        ? ['Employee', 'Dept', 'Present', 'Leaves', 'W.O', 'Holidays', 'Total Hrs', 'Payable Days']
        : ['Employee', 'Dept', 'Date', 'Punch IN', 'Punch OUT', 'Work Hrs', 'Status'];
      const colWidths = type === 'monthly'
        ? [110, 90, 50, 50, 45, 60, 60, 60]
        : [110, 90, 65, 80, 80, 55, 55];

      let x = doc.page.margins.left;
      const rowH = 20;

      // Header row
      doc.rect(x, doc.y, doc.page.width - 80, rowH).fill('#84CC16');
      doc.fillColor('#111111').fontSize(9);
      cols.forEach((col, i) => {
        doc.text(col, x + 4, doc.y - rowH + 5, { width: colWidths[i], lineBreak: false });
        x += colWidths[i];
      });
      doc.moveDown(0.2);

      // Data rows — 25 per page
      rows.forEach((row, idx) => {
        if (idx > 0 && idx % 25 === 0) doc.addPage();
        x = doc.page.margins.left;
        const y = doc.y;
        if (idx % 2 === 0) doc.rect(x, y, doc.page.width - 80, rowH).fill('#f7fee7');
        doc.fillColor('#111111').fontSize(8);
        const values = type === 'monthly'
          ? [row.employeeName, row.department, row.present, row.leaves, row.weekOff, row.holidays, row.totalHrs, row.payableDays]
          : [row.employeeName, row.department, row.date, row.punch_in || '—', row.punch_out || '—', row.work_hours || '—', row.status];
        values.forEach((val, i) => {
          doc.text(String(val ?? ''), x + 4, y + 5, { width: colWidths[i], lineBreak: false });
          x += colWidths[i];
        });
        doc.moveDown(0.2);
      });

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
  console.log(`[Email Server] running on http://localhost:${port}`);
});
