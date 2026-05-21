const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.MAIL_PORT) || 587,
  secure: false,
  family: 4,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
  pool: true,
  maxConnections: 3,
  rateDelta: 1000,
  rateLimit: 3,
});

const FROM = process.env.MAIL_FROM ||
  `Klavio <${process.env.MAIL_USER || 'klavio.app@gmail.com'}>`;

/**
 * Send an email with default anti-spam headers applied.
 * Options are the same as nodemailer's sendMail, but `from`
 * defaults to the configured sender and common headers are added.
 */
async function send(options) {
  const msgId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@klavio.app>`;
  return transporter.sendMail({
    from: FROM,
    ...options,
    headers: {
      'X-Mailer': 'Klavio Mailer 1.0',
      'X-Priority': '3',
      'Importance': 'Normal',
      'Message-ID': msgId,
      ...(options.headers || {}),
    },
  });
}

module.exports = { transporter, send };
