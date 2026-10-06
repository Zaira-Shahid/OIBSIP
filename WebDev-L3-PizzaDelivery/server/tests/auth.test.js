// Run with: npm test  (uses the separate "pizza-delivery-test" database; rate limits are skipped)
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const { env, assertEnv } = require('../src/config/env');
const { connectDB } = require('../src/config/db');
const { authenticateUser, requireAdmin } = require('../src/middleware/auth');
const { errorHandler } = require('../src/middleware/errorHandler');
const { setTransport } = require('../src/services/emailService');
const app = require('../src/app');
const User = require('../src/models/User');

const DOMAIN = '@test.invalid';
const PASSWORD = 'Passw0rdTest';
const ADMIN_EMAIL = `admin-seed${DOMAIN}`;
const ADMIN_PASSWORD = 'AdminPass123';

let server;
let base;

const call = async (method, url, { body, token, root = base } = {}) => {
  const res = await fetch(root + url, {
    method,
    headers: {
      ...(body && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
};

const cleanup = () => User.deleteMany({ email: { $regex: `${DOMAIN.replace('.', '\\.')}$` } });
const register = (email, extra = {}) =>
  call('POST', '/api/auth/register', { body: { name: 'Test User', email, password: PASSWORD, ...extra } });

test.before(async () => {
  assertEnv();
  env.requireVerified = true; // pin the default regardless of the developer .env
  setTransport({ sendMail: async () => {} });
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

test('register: valid user is created as an unverified normal user, with no secrets in the response', async () => {
  const res = await register(`valid${DOMAIN}`);
  assert.equal(res.status, 201);
  assert.equal(res.json.success, true);
  const { user } = res.json.data;
  assert.equal(user.email, `valid${DOMAIN}`);
  assert.equal(user.role, 'user');
  assert.equal(user.isEmailVerified, false);
  const text = JSON.stringify(res.json);
  for (const leaked of ['passwordHash', 'verificationToken', 'passwordResetToken', PASSWORD]) {
    assert.ok(!text.includes(leaked), `response leaks ${leaked}`);
  }
});

test('register: password is stored hashed, never as plain text', async () => {
  const stored = await User.findOne({ email: `valid${DOMAIN}` }).select('+passwordHash +verificationTokenHash');
  assert.notEqual(stored.passwordHash, PASSWORD);
  assert.ok(await bcrypt.compare(PASSWORD, stored.passwordHash));
  assert.match(stored.verificationTokenHash, /^[a-f0-9]{64}$/);
});

test('register: rejects invalid input with a clear message', async () => {
  const cases = [
    [{ email: 'not-an-email' }, /valid email/i],
    [{ password: 'short1' }, /8-72 characters/],
    [{ password: 'onlyletters' }, /letter and one number/],
    [{ password: '12345678' }, /letter and one number/],
    [{ name: 'A' }, /at least 2/],
  ];
  for (const [override, pattern] of cases) {
    const res = await register(`invalid${DOMAIN}`, override);
    assert.equal(res.status, 400, JSON.stringify(override));
    assert.equal(res.json.success, false);
    assert.match(res.json.message, pattern);
  }
  const missing = await call('POST', '/api/auth/register', { body: {} });
  assert.equal(missing.status, 400);
  assert.equal(await User.countDocuments({ email: `invalid${DOMAIN}` }), 0);
});

test('register: cannot self-assign a role (admin escalation attempt is rejected)', async () => {
  const res = await register(`escalate${DOMAIN}`, { role: 'admin' });
  assert.equal(res.status, 400);
  assert.equal(await User.countDocuments({ email: `escalate${DOMAIN}` }), 0);
});

test('register: duplicate email is rejected, case-insensitively', async () => {
  const res = await register(`VALID${DOMAIN}`.toUpperCase().replace('@TEST.INVALID', DOMAIN));
  assert.equal(res.status, 409);
  assert.match(res.json.message, /already exists/);
});

test('login: unverified account is refused with 403 when verification is required', async () => {
  assert.equal(env.requireVerified, true);
  const res = await call('POST', '/api/auth/login', { body: { email: `valid${DOMAIN}`, password: PASSWORD } });
  assert.equal(res.status, 403);
  assert.match(res.json.message, /verify your email/i);
  assert.equal(res.json.data, undefined);
});

test('login: verified user receives a JWT and /me returns the profile', async () => {
  await User.updateOne({ email: `valid${DOMAIN}` }, { isEmailVerified: true });
  const login = await call('POST', '/api/auth/login', { body: { email: `valid${DOMAIN}`, password: PASSWORD } });
  assert.equal(login.status, 200);
  const { token, user } = login.json.data;
  assert.equal(user.role, 'user');
  assert.ok(!JSON.stringify(login.json).includes('passwordHash'));

  const decoded = jwt.verify(token, env.jwtSecret);
  assert.equal(decoded.role, 'user');
  assert.ok(decoded.exp > decoded.iat, 'token has an expiry');

  const me = await call('GET', '/api/auth/me', { token });
  assert.equal(me.status, 200);
  assert.equal(me.json.data.user.email, `valid${DOMAIN}`);
});

test('login: wrong password and unknown email give the same generic 401', async () => {
  const wrong = await call('POST', '/api/auth/login', { body: { email: `valid${DOMAIN}`, password: 'WrongPass123' } });
  const unknown = await call('POST', '/api/auth/login', { body: { email: `nobody${DOMAIN}`, password: PASSWORD } });
  assert.equal(wrong.status, 401);
  assert.equal(unknown.status, 401);
  assert.equal(wrong.json.message, unknown.json.message);
});

test('login: admin accounts are rejected on the user endpoint with the generic message', async () => {
  await User.create({
    name: 'Admin Tester',
    email: `adminlogin${DOMAIN}`,
    passwordHash: await bcrypt.hash(PASSWORD, 4),
    role: 'admin',
    isEmailVerified: true,
  });
  const admin = await call('POST', '/api/auth/login', { body: { email: `adminlogin${DOMAIN}`, password: PASSWORD } });
  const wrong = await call('POST', '/api/auth/login', { body: { email: `valid${DOMAIN}`, password: 'WrongPass123' } });
  assert.equal(admin.status, 401);
  assert.equal(admin.json.message, wrong.json.message);
  assert.equal(admin.json.data, undefined);
});

test('protected route: missing, malformed, tampered, expired and orphaned tokens get 401', async () => {
  const user = await User.findOne({ email: `valid${DOMAIN}` });
  const sign = (payload, secret = env.jwtSecret, opts = {}) => jwt.sign(payload, secret, opts);

  const results = await Promise.all([
    call('GET', '/api/auth/me'),
    call('GET', '/api/auth/me', { token: 'garbage' }),
    call('GET', '/api/auth/me', { token: sign({ sub: String(user._id) }, 'x'.repeat(40)) }),
    call('GET', '/api/auth/me', { token: sign({ sub: String(user._id) }, env.jwtSecret, { expiresIn: -10 }) }),
    call('GET', '/api/auth/me', { token: sign({ sub: String(new mongoose.Types.ObjectId()) }) }),
  ]);
  for (const res of results) {
    assert.equal(res.status, 401);
    assert.equal(res.json.success, false);
  }
});

test('requireAdmin: a normal user gets 403, an admin gets through (isolated test app)', async () => {
  const probe = express();
  probe.get('/admin-only', authenticateUser, requireAdmin, (req, res) => res.json({ success: true }));
  probe.use(errorHandler);
  const probeServer = probe.listen(0);
  const root = `http://127.0.0.1:${probeServer.address().port}`;
  try {
    const userLogin = await call('POST', '/api/auth/login', { body: { email: `valid${DOMAIN}`, password: PASSWORD } });
    const adminUser = await User.findOne({ email: `adminlogin${DOMAIN}` });
    const adminToken = jwt.sign({ sub: String(adminUser._id), role: 'admin' }, env.jwtSecret);

    assert.equal((await call('GET', '/admin-only', { root })).status, 401);
    assert.equal((await call('GET', '/admin-only', { root, token: userLogin.json.data.token })).status, 403);
    // A forged "admin" claim in a user's token is ignored: role comes from the database.
    const forged = jwt.sign({ sub: String((await User.findOne({ email: `valid${DOMAIN}` }))._id), role: 'admin' }, env.jwtSecret);
    assert.equal((await call('GET', '/admin-only', { root, token: forged })).status, 403);
    assert.equal((await call('GET', '/admin-only', { root, token: adminToken })).status, 200);
  } finally {
    probeServer.close();
  }
});

test('rate limits do not block automated tests', async () => {
  const results = await Promise.all(
    Array.from({ length: 30 }, () => call('POST', '/api/auth/login', { body: { email: `nobody${DOMAIN}`, password: 'x' } }))
  );
  assert.ok(results.every((r) => r.status === 401));
});

test('AUTH_REQUIRE_VERIFIED=false is ignored in production', () => {
  const run = (nodeEnv) =>
    spawnSync(process.execPath, ['-e', "console.log(require('./src/config/env').env.requireVerified)"], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, NODE_ENV: nodeEnv, AUTH_REQUIRE_VERIFIED: 'false' },
      encoding: 'utf8',
    }).stdout.trim();
  assert.equal(run('development'), 'false');
  assert.equal(run('production'), 'true');
});

test('seed:admin is idempotent, creates a verified admin and never overwrites the password', async () => {
  const seed = (password) =>
    spawnSync(process.execPath, ['src/scripts/seedAdmin.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'test', ADMIN_EMAIL: ADMIN_EMAIL, ADMIN_PASSWORD: password },
      encoding: 'utf8',
    });

  const first = seed(ADMIN_PASSWORD);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /created/);
  const created = await User.findOne({ email: ADMIN_EMAIL }).select('+passwordHash');
  assert.equal(created.role, 'admin');
  assert.equal(created.isEmailVerified, true);

  const second = seed('DifferentPass456');
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /already exists.*not overwritten/);
  assert.equal(await User.countDocuments({ email: ADMIN_EMAIL }), 1);
  const after = await User.findOne({ email: ADMIN_EMAIL }).select('+passwordHash');
  assert.equal(after.passwordHash, created.passwordHash);
  assert.ok(await bcrypt.compare(ADMIN_PASSWORD, after.passwordHash));

  const weak = seed('weak');
  assert.notEqual(weak.status, 0);
  assert.ok(!weak.stderr.includes('weak') || /ADMIN_PASSWORD:/.test(weak.stderr));
});
