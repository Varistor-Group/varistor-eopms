import PDFDocument from 'pdfkit';
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
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
      to: 'akash@varistor.in', // Forced to verified testing email for Resend free tier
      subject: `Welcome to Varistor EOPMS - Your Login Credentials (To: ${email})`,
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
      to: 'akash@varistor.in', // Forced to verified testing email for Resend free tier
      subject: `Password Reset Request (To: ${email})`,
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
      to: 'akash@varistor.in', // Forced to verified testing email for Resend free tier
      subject: `Quiz Result: ${moduleTitle} — ${passed ? 'Passed' : 'Failed'} (${score}%) (To: ${recipients.join(', ')})`,
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

app.delete('/api/employees/:id', async (req, res) => {
  const db = await readDB();
  const id = req.params.id;
  if (!db.employees) db.employees = [];

  const index = db.employees.findIndex(e => e.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Employee not found.' });
  }

  const deletedEmployee = db.employees.splice(index, 1)[0];

  if (!db.activity_log) db.activity_log = [];
  db.activity_log.push({
    id: Date.now().toString(),
    action: 'DELETE_EMPLOYEE',
    by: 'admin@varistor.in',
    details: `Deleted employee ${deletedEmployee.fullName} (${id})`,
    timestamp: new Date().toISOString()
  });

  await writeDB(db);
  res.json({ success: true });
});

// Documents
app.get('/api/documents/:employeeId', async (req, res) => {
  const db = await readDB();
  const docs = (db.documents || []).filter(d => d.employeeId === req.params.employeeId);
  res.json(docs);
});

// Upload new document (Employee)
app.post('/api/documents', async (req, res) => {
  const db = await readDB();
  const { employeeId, filename, type, size } = req.body;
  if (!employeeId || !filename) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }

  if (!db.documents) db.documents = [];
  
  const newDoc = {
    id: `doc-${Date.now()}`,
    employeeId,
    filename,
    type: type || 'PDF',
    size: size || '1.2 MB',
    status: 'Pending',
    uploadedAt: new Date().toISOString()
  };

  db.documents.push(newDoc);

  if (!db.activity_log) db.activity_log = [];
  db.activity_log.push({
    id: Date.now().toString(),
    action: 'document_uploaded',
    by: employeeId,
    details: `Uploaded document ${filename}`,
    metadata: { documentId: newDoc.id },
    timestamp: new Date().toISOString()
  });

  await writeDB(db);
  res.json({ success: true, document: newDoc });
});

// Update document status (HR / Admin)
app.put('/api/documents/:id', async (req, res) => {
  const db = await readDB();
  const id = req.params.id;
  const { status, performedBy } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, error: 'status is required' });
  }

  const index = (db.documents || []).findIndex(d => d.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Document not found.' });
  }

  db.documents[index].status = status;

  if (!db.activity_log) db.activity_log = [];
  db.activity_log.push({
    id: Date.now().toString(),
    action: 'document_status_changed',
    by: performedBy || 'hr@varistor.in',
    details: `Document ${id} status changed to ${status}`,
    metadata: { documentId: id, newStatus: status },
    timestamp: new Date().toISOString()
  });

  await writeDB(db);
  res.json({ success: true, document: db.documents[index] });
});

// Upload/Replace specific document file (Employee) with Encryption Payload
app.post('/api/documents/:id/upload', async (req, res) => {
  const db = await readDB();
  const id = req.params.id;
  const { filename, type, size, payload } = req.body;

  const index = (db.documents || []).findIndex(d => d.id === id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Document not found.' });
  }

  db.documents[index].filename = filename || db.documents[index].filename;
  db.documents[index].type = type || db.documents[index].type;
  db.documents[index].size = size || db.documents[index].size;
  db.documents[index].payload = payload || db.documents[index].payload; // Base64 ciphertext
  db.documents[index].status = 'Pending';
  db.documents[index].uploadedAt = new Date().toISOString();

  if (!db.activity_log) db.activity_log = [];
  db.activity_log.push({
    id: Date.now().toString(),
    action: 'document_replaced',
    by: db.documents[index].employeeId,
    details: `Uploaded new encrypted file ${filename} for document slot`,
    metadata: { documentId: id },
    timestamp: new Date().toISOString()
  });

  await writeDB(db);
  res.json({ success: true, document: db.documents[index] });
});

// Download specific document payload
app.get('/api/documents/:id/download', async (req, res) => {
  const db = await readDB();
  const id = req.params.id;
  const doc = (db.documents || []).find(d => d.id === id);
  
  if (!doc || !doc.payload) {
    return res.status(404).json({ success: false, error: 'Encrypted payload not found for this document.' });
  }
  
  res.json({ success: true, payload: doc.payload, filename: doc.filename });
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

// ── Field Tracker (mock endpoints for future real location pings) ─────────────

// POST /api/field/location
// Body: { employeeId, lat, lng, accuracy, batteryLevel, status }
app.post('/api/field/location', (req, res) => {
  const { employeeId, lat, lng, accuracy, batteryLevel, status } = req.body;
  if (!employeeId || lat === undefined || lng === undefined) {
    return res.status(400).json({ success: false, error: 'Missing required fields' });
  }
  // In production this would write to Supabase
  console.log(`[Field Tracker] Location ping from ${employeeId}: (${lat}, ${lng})`);
  res.json({ success: true, message: 'Location recorded (mock)' });
});

// GET /api/field/locations
app.get('/api/field/locations', (req, res) => {
  // Mock response — in production fetch from Supabase
  res.json({ success: true, locations: [] });
});

// Policies — GET all
app.get('/api/policies', async (req, res) => {
  const db = await readDB();
  res.json(db.policies || []);
});

// Policies — POST (add new)
app.post('/api/policies', async (req, res) => {
  const db = await readDB();
  const policy = req.body;
  if (!policy.title || !policy.content) {
    return res.status(400).json({ success: false, error: 'title and content are required' });
  }
  if (!db.policies) db.policies = [];
  const newPolicy = {
    id: `pol-${Date.now()}`,
    title: policy.title,
    category: policy.category || 'General',
    severity: policy.severity || 'standard',
    content: policy.content,
    effectiveDate: policy.effectiveDate || new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString()
  };
  db.policies.push(newPolicy);
  await writeDB(db);
  res.json({ success: true, policy: newPolicy });
});

// Policies — PUT (update by id)
app.put('/api/policies/:id', async (req, res) => {
  const db = await readDB();
  const id = req.params.id;
  const index = (db.policies || []).findIndex(p => p.id === id);
  if (index === -1) return res.status(404).json({ success: false, error: 'Policy not found.' });
  db.policies[index] = { ...db.policies[index], ...req.body, id, updatedAt: new Date().toISOString() };
  await writeDB(db);
  res.json({ success: true, policy: db.policies[index] });
});

// Policies — DELETE
app.delete('/api/policies/:id', async (req, res) => {
  const db = await readDB();
  const id = req.params.id;
  if (!db.policies) return res.status(404).json({ success: false, error: 'Policy not found.' });
  db.policies = db.policies.filter(p => p.id !== id);
  await writeDB(db);
  res.json({ success: true });
});

// ── Leave Management email notifications ─────────────────────────────────────

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


app.listen(port, () => {
  console.log
  // Payroll route imported from Task-D
  // Generate A4 Salary Slip PDF buffer using pdfkit
  const generateSalarySlipPDF = (slip) => {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        const month = slip.month || new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });
        const netPay = slip.netPay ?? (slip.ctc - slip.deductions);
        const fmt = (n) => 'Rs ' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

        // 1. Header Banner (Lime green)
        doc.rect(40, 40, 515, 60).fill('#84cc16');
        doc.fillColor('#ffffff')
          .fontSize(16)
          .font('Helvetica-Bold')
          .text('VARISTOR TECHNOLOGIES PVT LTD', 55, 52);
        doc.fontSize(10)
          .font('Helvetica')
          .text(`Salary Slip - ${month}`, 55, 75);

        // V Logo Badge inside banner
        doc.circle(510, 70, 20).fill('#ffffff');
        doc.fillColor('#84cc16')
          .fontSize(18)
          .font('Helvetica-Bold')
          .text('V', 504, 63);

        // 2. Employee Info Grid
        doc.fillColor('#111111').fontSize(10);

        const infoY1 = 125;
        const infoY2 = 145;

        doc.font('Helvetica-Bold').text('Employee:', 55, infoY1).font('Helvetica').text(slip.name, 140, infoY1);
        doc.font('Helvetica-Bold').text('Employee ID:', 300, infoY1).font('Helvetica').text(slip.employeeId || 'ΓÇö', 390, infoY1);

        doc.font('Helvetica-Bold').text('Department:', 55, infoY2).font('Helvetica').text(slip.department || 'ΓÇö', 140, infoY2);
        doc.font('Helvetica-Bold').text('Monthly CTC:', 300, infoY2).font('Helvetica').text(fmt(slip.ctc), 390, infoY2);

        // Divider line
        doc.moveTo(40, 175).lineTo(555, 175).strokeColor('#d8ded2').lineWidth(1).stroke();

        // 3. Earnings & Deductions Headers
        doc.fillColor('#868e80')
          .fontSize(9)
          .font('Helvetica-Bold')
          .text('EARNINGS', 55, 195)
          .text('DEDUCTIONS', 300, 195);

        // 4. Details
        doc.fillColor('#111111').fontSize(10).font('Helvetica');

        // Earnings Row 1
        doc.text('Gross Pay', 55, 215)
          .font('Helvetica-Bold').text(fmt(slip.ctc), 200, 215, { align: 'right', width: 60 });

        // Deductions Row 1
        doc.font('Helvetica').text('Total Deductions', 300, 215)
          .font('Helvetica-Bold').fillColor('#b91c1c').text(fmt(slip.deductions), 450, 215, { align: 'right', width: 60 });

        // Vertical separator
        doc.moveTo(280, 195).lineTo(280, 240).strokeColor('#d8ded2').stroke();

        // Divider line
        doc.moveTo(40, 260).lineTo(555, 260).strokeColor('#d8ded2').stroke();

        // 5. Net Pay Block
        doc.rect(40, 275, 515, 45).fill('#f7fee7');
        doc.rect(40, 275, 515, 45).strokeColor('#d9f99d').stroke();

        doc.fillColor('#365314')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('Net Pay', 55, 292);

        doc.fillColor('#3f6212')
          .fontSize(18)
          .font('Helvetica-Bold')
          .text(fmt(netPay), 420, 287, { align: 'right', width: 110 });

        // 6. Footer
        doc.fillColor('#868e80')
          .fontSize(8)
          .font('Helvetica')
          .text('This is a system-generated salary slip from Varistor EOPMS. No signature required.', 40, 350, { align: 'center', width: 515 });
        doc.text('Auto-dispatched via scheduled cron - Resend', 40, 365, { align: 'center', width: 515 });

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  };

  // ΓöÇΓöÇ Modules 11 & 12: Bulk salary slip emails ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
  app.post('/api/payroll/send-slips', async (req, res) => {
    try {
      const { slips } = req.body;
      if (!Array.isArray(slips) || slips.length === 0) {
        return res.status(400).json({ success: false, error: 'No slip data provided.' });
      }

      console.log(`[Payroll] Received request to send ${slips.length} slips`);
      console.log(`[Payroll] Resend API key present: ${!!process.env.VITE_RESEND_API_KEY}`);

      const fmt = (n) => 'Γé╣' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

      const buildSlipHtml = (slip) => {
        const month = slip.month || new Date().toLocaleString('en-IN', { month: 'short', year: 'numeric' });
        const netPay = slip.netPay ?? (slip.ctc - slip.deductions);
        return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Salary Slip ΓÇô ${month}</title></head>
<body style="margin:0;padding:0;background:#f4f6f3;font-family:Arial,Helvetica,sans-serif;color:#111;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f3;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #d8ded2;">
        <tr>
          <td style="background:#84cc16;padding:24px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">VARISTOR TECHNOLOGIES PVT LTD</p>
                  <p style="margin:4px 0 0;color:#ecfccb;font-size:13px;">Salary Slip &middot; ${month}</p>
                </td>
                <td align="right">
                  <div style="width:44px;height:44px;background:rgba(255,255,255,0.25);border-radius:50%;text-align:center;line-height:44px;font-size:22px;font-weight:900;color:#fff;">V</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 0;">
            <table width="100%" cellpadding="6" cellspacing="0" style="font-size:13px;">
              <tr><td style="color:#868e80;width:120px;">Employee</td><td style="font-weight:700;">${slip.name}</td><td style="color:#868e80;">Employee ID</td><td style="font-weight:600;">${slip.employeeId || 'ΓÇö'}</td></tr>
              <tr><td style="color:#868e80;">Department</td><td>${slip.department || 'ΓÇö'}</td><td style="color:#868e80;">Monthly CTC</td><td style="font-weight:600;">${fmt(slip.ctc)}</td></tr>
            </table>
          </td>
        </tr>
        <tr><td style="padding:16px 32px 0;"><hr style="border:none;border-top:1px solid #d8ded2;"></td></tr>
        <tr>
          <td style="padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" valign="top" style="padding-right:16px;">
                  <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#868e80;text-transform:uppercase;">Earnings</p>
                  <table width="100%" cellpadding="4" cellspacing="0" style="font-size:13px;">
                    <tr><td style="color:#555;">Gross Pay</td><td align="right" style="font-weight:600;">${fmt(slip.ctc)}</td></tr>
                  </table>
                </td>
                <td width="50%" valign="top" style="padding-left:16px;border-left:1px solid #d8ded2;">
                  <p style="margin:0 0 10px;font-size:11px;font-weight:700;color:#868e80;text-transform:uppercase;">Deductions</p>
                  <table width="100%" cellpadding="4" cellspacing="0" style="font-size:13px;">
                    <tr><td style="color:#555;">Total Deductions</td><td align="right" style="font-weight:600;color:#b91c1c;">${fmt(slip.deductions)}</td></tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 24px;">
            <table width="100%" cellpadding="16" cellspacing="0" style="background:#f7fee7;border:1px solid #d9f99d;border-radius:12px;">
              <tr>
                <td style="font-size:14px;font-weight:700;color:#365314;">Net Pay</td>
                <td align="right" style="font-size:24px;font-weight:900;color:#3f6212;">${fmt(netPay)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #d8ded2;text-align:center;font-size:11px;color:#868e80;">
            <p style="margin:0;">System-generated salary slip ΓÇö Varistor EOPMS</p>
            <p style="margin:6px 0 0;">&#9993; Auto-dispatched ┬╖ 15th of each month ┬╖ 10:00 IST</p>
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
            subject: `Your Salary Slip ΓÇô ${month} | Varistor Technologies`,
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
            console.log(`[Payroll] Γ£ô Sent to ${slip.name} <${slip.email}>`);
          }
        } catch (err) {
          console.error(`[Payroll] Exception for ${slip.email}:`, err.message);
          failed.push({ email: slip.email, name: slip.name, error: err.message });
        }
        await new Promise(r => setTimeout(r, 120));
      }

      console.log(`[Payroll] Done ΓÇö ${sent.length} sent, ${failed.length} failed`);
      return res.json({ success: true, sent: sent.length, failed });
    } catch (outerErr) {
      console.error('[Payroll] ROUTE CRASHED:', outerErr);
      return res.status(500).json({ success: false, error: outerErr.message || 'Internal server error' });
    }
  });

  // Activity

  (`[Email Server] running on http://localhost:${port}`);
});
