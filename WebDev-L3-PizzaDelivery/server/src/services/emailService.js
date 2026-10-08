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
  // Automated tests must never reach a real mail server, even when server/.env holds real SMTP settings:
  // they inject a fake transport, and without one sending fails instead of using the real credentials.
  if (env.nodeEnv === 'test') return null;
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

const STATUS_LABEL = { LOW: 'Low stock', OUT_OF_STOCK: 'Out of stock' };

// One email listing every item that newly needs attention. `items` is [{ name, category, stock, unit, lowStockThreshold, status }].
const sendLowStockDigest = (to, items) => {
  const count = `${items.length} ingredient${items.length === 1 ? '' : 's'}`;
  const lines = items.map(
    (i) => `- ${i.name} (${i.category}): ${i.stock} ${i.unit} left, threshold ${i.lowStockThreshold} - ${STATUS_LABEL[i.status]}`
  );
  const text = [
    `Low-stock alert: ${count} need${items.length === 1 ? 's' : ''} attention.`,
    '',
    ...lines,
    '',
    `Restock in the admin inventory: ${env.clientUrl}/admin/inventory`,
    '',
    '- Slice & Co.',
  ].join('\n');
  const cell = 'padding:6px 10px;border-bottom:1px solid #eadfce;text-align:left';
  const rows = items
    .map(
      (i) =>
        `<tr><td style="${cell}">${escapeHtml(i.name)}</td><td style="${cell}">${escapeHtml(i.category)}</td>` +
        `<td style="${cell}">${escapeHtml(i.stock)} ${escapeHtml(i.unit)}</td><td style="${cell}">${escapeHtml(i.lowStockThreshold)}</td>` +
        `<td style="${cell};font-weight:bold;color:${i.status === 'OUT_OF_STOCK' ? '#b42318' : '#b7791f'}">${STATUS_LABEL[i.status]}</td></tr>`
    )
    .join('');
  const html =
    `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#2b2118"><h2 style="color:#c0392b">Slice &amp; Co. low-stock alert</h2>` +
    `<p>${escapeHtml(count)} need${items.length === 1 ? 's' : ''} attention.</p>` +
    `<table style="border-collapse:collapse;width:100%"><thead><tr><th style="${cell}">Item</th><th style="${cell}">Category</th><th style="${cell}">Stock</th><th style="${cell}">Threshold</th><th style="${cell}">Status</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<p><a href="${escapeHtml(env.clientUrl)}/admin/inventory">Open the inventory</a></p></div>`;
  return sendEmail({ to, subject: `Low stock alert: ${count} - Slice & Co.`, text, html });
};

module.exports = { sendEmail, sendVerificationEmail, sendPasswordResetEmail, sendLowStockDigest, setTransport, isSmtpConfigured };
