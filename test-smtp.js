import net from 'net';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

console.log('SMTP Config:');
console.log('  HOST:', process.env.SMTP_HOST);
console.log('  PORT:', process.env.SMTP_PORT);
console.log('  USER:', process.env.SMTP_USER);
console.log('  PASS:', process.env.SMTP_PASS ? '(set)' : '(NOT SET)');
console.log('');

// Test raw TCP connectivity
console.log('Testing TCP connection to', process.env.SMTP_HOST, 'port', process.env.SMTP_PORT, '...');
const sock = net.createConnection({ host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT || '587') });
sock.setTimeout(8000);
sock.on('connect', () => {
  console.log('[TCP] CONNECTED OK');
  sock.destroy();
  testSmtp();
});
sock.on('timeout', () => {
  console.log('[TCP] TIMEOUT - server not reachable');
  sock.destroy();
});
sock.on('error', (e) => {
  console.log('[TCP] FAILED:', e.message);
  testSmtp();
});

async function testSmtp() {
  console.log('\nTesting Nodemailer SMTP auth...');
  const pass = (process.env.SMTP_PASS || '').replace(/^"(.*)"$/, '$1');

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    requireTLS: true,
    auth: { user: process.env.SMTP_USER, pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
  });

  transporter.verify((err) => {
    if (err) {
      console.log('[SMTP] FAILED:', err.message);
      console.log('\nFull error:', err);
    } else {
      console.log('[SMTP] SUCCESS - server ready!');
    }
    process.exit(0);
  });
}
