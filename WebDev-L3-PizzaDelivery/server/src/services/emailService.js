const nodemailer = require('nodemailer');
const { env } = require('../config/env');

let transport = null;

const isSmtpConfigured = () => Boolean(env.email.user && env.email.password);

// Tests inject a fake transport ({ sendMail }) so no real email is ever sent.
function setTransport(custom) {
  transport = custom;
}

function getTransport() {
  if (transport) return transport;
  if (isSmtpConfigured()) {
    transport = nodemailer.createTransport({
      host: env.email.host,
      port: env.email.port,
      secure: env.email.port === 465,
      auth: { user: env.email.user, pass: env.email.password },
    });
    return transport;
  }
  return null;
}

// Sends one email. Throws if delivery is impossible; callers decide how to degrade.
async function sendEmail({ to, subject, text, html }) {
  const t = getTransport();
  if (t) {
    await t.sendMail({ from: env.email.from, to, subject, text, html });
    return;
  }
  // Development-only convenience: without SMTP the message (including its link) is printed
  // to this console. Never enabled in production or tests.
  if (env.nodeEnv === 'development') {
    console.warn(`[email:dev-fallback] SMTP not configured. Would send to ${to}: ${subject}\n${text}`);
    return;
  }
  throw new Error('Email delivery is not configured.');
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function layout(name, intro, buttonLabel, link, outro) {
  const safeLink = escapeHtml(link);
  return {
    text: `Hi ${name},\n\n${intro}\n\n${link}\n\n${outro}\n\n- Slice & Co.`,
    html:
      `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#2b2118">` +
      `<h2 style="color:#c0392b">Slice &amp; Co.</h2><p>Hi ${escapeHtml(name)},</p><p>${escapeHtml(intro)}</p>` +
      `<p><a href="${safeLink}" style="display:inline-block;background:#c0392b;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">${escapeHtml(buttonLabel)}</a></p>` +
      `<p style="font-size:13px;color:#6b5d50">Or paste this link into your browser:<br>${safeLink}</p>` +
      `<p style="font-size:13px;color:#6b5d50">${escapeHtml(outro)}</p></div>`,
  };
}

const sendVerificationEmail = (user, token) =>
  sendEmail({
    to: user.email,
    subject: 'Verify your email - Slice & Co.',
    ...layout(
      user.name,
      'Welcome! Please confirm your email address to activate your account.',
      'Verify my email',
      `${env.clientUrl}/verify-email?token=${token}`,
      'This link expires in 24 hours. If you did not create an account, you can ignore this email.'
    ),
  });

const sendPasswordResetEmail = (user, token) =>
  sendEmail({
    to: user.email,
    subject: 'Reset your password - Slice & Co.',
    ...layout(
      user.name,
      'We received a request to reset your password.',
      'Reset my password',
      `${env.clientUrl}/reset-password?token=${token}`,
      'This link expires in 1 hour. If you did not request this, you can ignore this email; your password will not change.'
    ),
  });

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail, setTransport, isSmtpConfigured };
