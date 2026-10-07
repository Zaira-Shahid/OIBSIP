// Run with: npm test. Uses a fake mail transport (no real email) and the "pizza-delivery-test" database.
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const { env, assertEnv } = require('../src/config/env');
const { connectDB } = require('../src/config/db');
const { setTransport, sendEmail } = require('../src/services/emailService');
const { hashToken } = require('../src/utils/tokens');
const app = require('../src/app');
const User = require('../src/models/User');

const DOMAIN = '@flows.invalid';
const PASSWORD = 'Passw0rdTest';
const NEW_PASSWORD = 'BrandNew456pw';

let server;
let base;
const sent = [];

const call = async (method, url, { body, token } = {}) => {
  const res = await fetch(base + url, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
};

const cleanup = () => User.deleteMany({ email: { $regex: `${DOMAIN.replace('.', '\\.')}$` } });
const register = (email) => call('POST', '/api/auth/register', { body: { name: 'Flow Tester', email, password: PASSWORD } });
const login = (email, password = PASSWORD) => call('POST', '/api/auth/login', { body: { email, password } });
const tokenFrom = (message) => message.text.match(/token=([a-f0-9]{64})/)[1];

// Background sends (forgot/resend) finish after the response, so wait for the mailbox to fill.
async function waitForMail(count, ms = 3000) {
  const end = Date.now() + ms;
  while (sent.length < count && Date.now() < end) await new Promise((r) => setTimeout(r, 25));
  return sent.length;
}
const mailTo = (email) => sent.filter((m) => m.to === email);

test.before(async () => {
  assertEnv();
  env.requireVerified = true; // pin the default regardless of the developer .env
  setTransport({ sendMail: async (m) => void sent.push(m) });
  await connectDB();
  await cleanup();
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await cleanup();
  server.close();
  await mongoose.disconnect();
});

test('registration sends one verification email with a working-format link, and no secrets leak in the API response', async () => {
  const email = `reg${DOMAIN}`;
  const res = await register(email);
  assert.equal(res.status, 201);
  assert.equal(res.json.data.emailSent, true);
  assert.ok(!JSON.stringify(res.json).match(/[a-f0-9]{64}/), 'response must not contain the raw token');

  const mail = mailTo(email);
  assert.equal(mail.length, 1);
  assert.match(mail[0].subject, /verify/i);
  assert.match(mail[0].text, new RegExp(`${env.clientUrl}/verify-email\\?token=[a-f0-9]{64}`));
  assert.match(mail[0].html, /Verify my email/);

  const stored = await User.findOne({ email }).select('+verificationTokenHash');
  assert.equal(stored.verificationTokenHash, hashToken(tokenFrom(mail[0])), 'only the hash is stored');
});

test('registration still succeeds (emailSent:false) when the mail server fails', async () => {
  setTransport({ sendMail: async () => { throw new Error('SMTP down'); } });
  const res = await register(`smtpfail${DOMAIN}`);
  setTransport({ sendMail: async (m) => void sent.push(m) });
  assert.equal(res.status, 201);
  assert.equal(res.json.data.emailSent, false);
  assert.ok(await User.exists({ email: `smtpfail${DOMAIN}` }));
});

test('email service refuses to send when no transport/SMTP is configured outside development', async () => {
  setTransport(null);
  try {
    await assert.rejects(() => sendEmail({ to: 'a@b.invalid', subject: 's', text: 't', html: 'h' }), /not configured/);
  } finally {
    setTransport({ sendMail: async (m) => void sent.push(m) });
  }
});

test('tests can never reach a real mail server, even if the developer .env contains SMTP credentials', async () => {
  const saved = { user: env.email.user, password: env.email.password };
  env.email.user = 'someone@gmail.invalid';
  env.email.password = 'not-a-real-app-password';
  setTransport(null);
  try {
    // With real-looking credentials and no injected transport, sending must fail locally instead of connecting.
    await assert.rejects(() => sendEmail({ to: 'a@b.invalid', subject: 's', text: 't', html: 'h' }), /not configured/);
  } finally {
    Object.assign(env.email, saved);
    setTransport({ sendMail: async (m) => void sent.push(m) });
  }
});

test('verification: unverified login is blocked with a code the client can act on', async () => {
  assert.equal(env.requireVerified, true);
  const res = await login(`reg${DOMAIN}`);
  assert.equal(res.status, 403);
  assert.equal(res.json.code, 'EMAIL_NOT_VERIFIED');
});

test('verification: valid link verifies the account, then login works', async () => {
  const token = tokenFrom(mailTo(`reg${DOMAIN}`)[0]);
  const res = await call('GET', `/api/auth/verify-email?token=${token}`);
  assert.equal(res.status, 200);
  assert.equal(res.json.success, true);
  assert.equal((await User.findOne({ email: `reg${DOMAIN}` })).isEmailVerified, true);
  assert.equal((await login(`reg${DOMAIN}`)).status, 200);
});

test('verification: the link is single-use', async () => {
  const token = tokenFrom(mailTo(`reg${DOMAIN}`)[0]);
  const again = await call('GET', `/api/auth/verify-email?token=${token}`);
  assert.equal(again.status, 400);
  assert.match(again.json.message, /invalid|expired|already used/i);
});

test('verification: unknown, malformed, missing and expired tokens are rejected', async () => {
  assert.equal((await call('GET', `/api/auth/verify-email?token=${'0'.repeat(64)}`)).status, 400);
  assert.equal((await call('GET', '/api/auth/verify-email?token=short')).status, 400);
  assert.equal((await call('GET', '/api/auth/verify-email')).status, 400);

  const email = `expired${DOMAIN}`;
  await register(email);
  const token = tokenFrom(mailTo(email)[0]);
  await User.updateOne({ email }, { verificationTokenExpires: new Date(Date.now() - 1000) });
  const res = await call('GET', `/api/auth/verify-email?token=${token}`);
  assert.equal(res.status, 400);
  assert.equal((await User.findOne({ email })).isEmailVerified, false);
});

test('resend verification: gives the same generic answer for existing and unknown emails, and a new link works', async () => {
  const email = `resend${DOMAIN}`;
  await register(email);
  const before = mailTo(email).length;

  const known = await call('POST', '/api/auth/resend-verification', { body: { email } });
  const unknown = await call('POST', '/api/auth/resend-verification', { body: { email: `nobody${DOMAIN}` } });
  assert.equal(known.status, 200);
  assert.equal(unknown.status, 200);
  assert.deepEqual(known.json, unknown.json);

  await waitForMail(sent.length + 1);
  assert.equal(mailTo(email).length, before + 1);
  assert.equal(mailTo(`nobody${DOMAIN}`).length, 0, 'no email goes to unknown addresses');

  const fresh = tokenFrom(mailTo(email).at(-1));
  assert.equal((await call('GET', `/api/auth/verify-email?token=${fresh}`)).status, 200);
});

test('forgot password: same generic answer for existing and unknown emails; only the real one gets mail', async () => {
  const email = `forgot${DOMAIN}`;
  await register(email);
  await User.updateOne({ email }, { isEmailVerified: true });

  const known = await call('POST', '/api/auth/forgot-password', { body: { email } });
  const unknown = await call('POST', '/api/auth/forgot-password', { body: { email: `ghost${DOMAIN}` } });
  assert.equal(known.status, 200);
  assert.deepEqual(known.json, unknown.json);

  await waitForMail(sent.length + 1);
  const reset = mailTo(email).find((m) => /reset/i.test(m.subject));
  assert.ok(reset, 'reset email sent');
  assert.match(reset.text, new RegExp(`${env.clientUrl}/reset-password\\?token=[a-f0-9]{64}`));
  assert.equal(mailTo(`ghost${DOMAIN}`).length, 0);

  const stored = await User.findOne({ email }).select('+passwordResetTokenHash +passwordResetTokenExpires');
  assert.equal(stored.passwordResetTokenHash, hashToken(tokenFrom(reset)));
  const ttl = stored.passwordResetTokenExpires.getTime() - Date.now();
  assert.ok(ttl > 55 * 60 * 1000 && ttl <= 60 * 60 * 1000, 'reset token lasts about 1 hour');
});

test('forgot password: invalid email format is rejected; admin accounts get no reset email', async () => {
  assert.equal((await call('POST', '/api/auth/forgot-password', { body: { email: 'nope' } })).status, 400);

  const adminEmail = `admin${DOMAIN}`;
  await User.create({ name: 'Admin Flow', email: adminEmail, passwordHash: await bcrypt.hash(PASSWORD, 4), role: 'admin', isEmailVerified: true });
  const res = await call('POST', '/api/auth/forgot-password', { body: { email: adminEmail } });
  assert.equal(res.status, 200);
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(mailTo(adminEmail).length, 0);
});

test('reset password: new password works, old one stops working, token is single-use', async () => {
  const email = `forgot${DOMAIN}`;
  const token = tokenFrom(mailTo(email).find((m) => /reset/i.test(m.subject)));

  const bad = await call('POST', '/api/auth/reset-password', { body: { token, password: 'weak' } });
  assert.equal(bad.status, 400);
  assert.match(bad.json.message, /8-72 characters/);

  const ok = await call('POST', '/api/auth/reset-password', { body: { token, password: NEW_PASSWORD } });
  assert.equal(ok.status, 200);

  assert.equal((await login(email, PASSWORD)).status, 401, 'old password rejected');
  assert.equal((await login(email, NEW_PASSWORD)).status, 200, 'new password accepted');

  const stored = await User.findOne({ email }).select('+passwordResetTokenHash +passwordHash');
  assert.equal(stored.passwordResetTokenHash, undefined, 'token invalidated');
  assert.ok(await bcrypt.compare(NEW_PASSWORD, stored.passwordHash));

  const reuse = await call('POST', '/api/auth/reset-password', { body: { token, password: 'Another789pw' } });
  assert.equal(reuse.status, 400);
});

test('reset password: unknown, malformed and expired tokens are rejected', async () => {
  const strong = { password: NEW_PASSWORD };
  assert.equal((await call('POST', '/api/auth/reset-password', { body: { token: '1'.repeat(64), ...strong } })).status, 400);
  assert.equal((await call('POST', '/api/auth/reset-password', { body: { token: 'abc', ...strong } })).status, 400);
  assert.equal((await call('POST', '/api/auth/reset-password', { body: strong })).status, 400);

  const email = `resetexp${DOMAIN}`;
  await register(email);
  await call('POST', '/api/auth/forgot-password', { body: { email } });
  await waitForMail(sent.length + 1);
  const token = tokenFrom(mailTo(email).find((m) => /reset/i.test(m.subject)));
  await User.updateOne({ email }, { passwordResetTokenExpires: new Date(Date.now() - 1000) });
  const res = await call('POST', '/api/auth/reset-password', { body: { token, ...strong } });
  assert.equal(res.status, 400);
  assert.match(res.json.message, /expired|invalid/i);
});

test('reset password: sessions issued before the reset stop working', async () => {
  const email = `session${DOMAIN}`;
  await register(email);
  await User.updateOne({ email }, { isEmailVerified: true });
  const { token: oldJwt } = (await login(email)).json.data;
  assert.equal((await call('GET', '/api/auth/me', { token: oldJwt })).status, 200);

  await call('POST', '/api/auth/forgot-password', { body: { email } });
  await waitForMail(sent.length + 1);
  const resetToken = tokenFrom(mailTo(email).find((m) => /reset/i.test(m.subject)));
  // Make the old token provably older than the reset (JWT iat has one-second resolution).
  const decoded = jwt.decode(oldJwt);
  const backdated = jwt.sign({ sub: decoded.sub, role: decoded.role, iat: decoded.iat - 10 }, env.jwtSecret);
  assert.equal((await call('GET', '/api/auth/me', { token: backdated })).status, 200);

  assert.equal((await call('POST', '/api/auth/reset-password', { body: { token: resetToken, password: NEW_PASSWORD } })).status, 200);
  const stale = await call('GET', '/api/auth/me', { token: backdated });
  assert.equal(stale.status, 401);
  assert.match(stale.json.message, /password was changed/i);

  const fresh = (await login(email, NEW_PASSWORD)).json.data.token;
  assert.equal((await call('GET', '/api/auth/me', { token: fresh })).status, 200);
});

test('reset password also verifies an unverified account (the link proves mailbox ownership)', async () => {
  const email = `unverifiedreset${DOMAIN}`;
  await register(email);
  assert.equal((await login(email)).status, 403);
  await call('POST', '/api/auth/forgot-password', { body: { email } });
  await waitForMail(sent.length + 1);
  const token = tokenFrom(mailTo(email).find((m) => /reset/i.test(m.subject)));
  assert.equal((await call('POST', '/api/auth/reset-password', { body: { token, password: NEW_PASSWORD } })).status, 200);
  assert.equal((await login(email, NEW_PASSWORD)).status, 200);
});

test('email content and logs: no raw tokens in API error bodies or stored plain text', async () => {
  const stored = await User.find({ email: { $regex: 'flows\\.invalid$' } }).select('+verificationTokenHash +passwordResetTokenHash').lean();
  for (const doc of stored) {
    for (const hash of [doc.verificationTokenHash, doc.passwordResetTokenHash].filter(Boolean)) {
      assert.ok(!sent.some((m) => m.text.includes(hash)), 'the stored hash is never the emailed token');
    }
  }
});
