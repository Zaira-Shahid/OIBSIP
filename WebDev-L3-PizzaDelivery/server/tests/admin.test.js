// Run with: npm test. Uses the "pizza-delivery-test" database (never the dev data).
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const { assertEnv } = require('../src/config/env');
const { connectDB } = require('../src/config/db');
const { signToken } = require('../src/utils/jwt');
const app = require('../src/app');
const adminRouter = require('../src/routes/admin.routes');
const Order = require('../src/models/Order');
const User = require('../src/models/User');

const USER_FILTER = { email: { $regex: 'admin-test\\.invalid$' } };
const ADMIN_EMAIL = 'boss@admin-test.invalid';
const ADMIN_PASSWORD = 'AdminPass123';
let server;
let base;
let admin;
let alice;
let bob;

const call = async (method, url, { body, token } = {}) => {
  const res = await fetch(base + url, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
};
const makeUser = async (name, { role = 'user', password = 'Passw0rdTest', verified = true } = {}) => {
  const user = await User.create({
    name,
    email: `${name}@admin-test.invalid`,
    passwordHash: await bcrypt.hash(password, 4),
    role,
    isEmailVerified: verified,
  });
  return { user, token: signToken(user) };
};
const line = (name, price) => ({ ingredientId: new mongoose.Types.ObjectId(), name, price });
const makeOrder = (user, extra = {}) =>
  Order.create({
    userId: user._id,
    customPizza: {
      base: line('Classic', 80),
      sauce: line('Classic Tomato', 20),
      cheese: line('Mozzarella', 40),
      vegetables: [line('Onion', 10)],
    },
    unitPrice: 150,
    quantity: 2,
    amount: 300,
    paymentStatus: 'PAID',
    orderStatus: 'ORDER_RECEIVED',
    ...extra,
  });
const setStatus = (id, status, token = admin.token) =>
  call('PATCH', `/api/admin/orders/${id}/status`, { token, body: { status } });
const loginAdmin = (email, password) => call('POST', '/api/admin/login', { body: { email, password } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test.before(async () => {
  assertEnv();
  await connectDB();
  await Promise.all([Order.deleteMany({}), User.deleteMany(USER_FILTER)]);
  // Not email-verified on purpose: admin login must not depend on verification.
  admin = await makeUser('boss', { role: 'admin', password: ADMIN_PASSWORD, verified: false });
  alice = await makeUser('alice');
  bob = await makeUser('bob');
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

test.beforeEach(() => Order.deleteMany({}));

test.after(async () => {
  await Promise.all([Order.deleteMany({}), User.deleteMany(USER_FILTER)]);
  server.close();
  await mongoose.disconnect();
});

test('admin login: an admin gets a working token and no secrets, even when not email-verified', async () => {
  const res = await loginAdmin(ADMIN_EMAIL, ADMIN_PASSWORD);
  assert.equal(res.status, 200);
  assert.equal(res.json.data.user.role, 'admin');
  assert.ok(!JSON.stringify(res.json).match(/passwordHash|verificationToken|passwordResetToken/));
  const me = await call('GET', '/api/admin/me', { token: res.json.data.token });
  assert.equal(me.status, 200);
  assert.equal(me.json.data.user.email, ADMIN_EMAIL);
});

test('admin login: customers, wrong passwords and unknown emails all get the identical generic 401', async () => {
  const bad = [
    await loginAdmin('alice@admin-test.invalid', 'Passw0rdTest'), // right customer credentials
    await loginAdmin(ADMIN_EMAIL, 'WrongPass123'),
    await loginAdmin('nobody@admin-test.invalid', 'Passw0rdTest'),
  ];
  for (const res of bad) {
    assert.equal(res.status, 401);
    assert.deepEqual(res.json, bad[0].json);
  }
  assert.equal(bad[0].json.message, 'Invalid email or password.');
});

test('admin login validates its body and has no registration counterpart', async () => {
  assert.equal((await call('POST', '/api/admin/login', { body: { email: ADMIN_EMAIL } })).status, 400);
  assert.equal((await call('POST', '/api/admin/login', { body: { email: ADMIN_EMAIL, password: 'x', role: 'admin' } })).status, 400);
  assert.equal((await call('POST', '/api/admin/register', { body: { email: 'x@admin-test.invalid' } })).status, 401);
  assert.equal((await call('POST', '/api/auth/register', {
    body: { name: 'Mallory', email: 'mallory@admin-test.invalid', password: 'Passw0rdTest', role: 'admin' },
  })).status, 400);
  assert.equal(await User.countDocuments({ email: 'mallory@admin-test.invalid' }), 0);
});

test('every route on the admin router (except login) rejects no token, bad tokens and customers', async () => {
  const guarded = adminRouter.stack
    .filter((layer) => layer.route)
    .flatMap((layer) => Object.keys(layer.route.methods).map((method) => ({ method: method.toUpperCase(), path: layer.route.path })))
    .filter((r) => !(r.method === 'POST' && r.path === '/login'));
  assert.ok(guarded.length >= 3, 'router crawl found the routes');

  const id = new mongoose.Types.ObjectId().toString();
  for (const { method, path: routePath } of guarded) {
    const url = `/api/admin${routePath.replace(':id', id)}`;
    const body = method === 'GET' ? undefined : { status: 'IN_KITCHEN' };
    assert.equal((await call(method, url, { body })).status, 401, `${method} ${url} without token`);
    assert.equal((await call(method, url, { body, token: 'garbage.token.value' })).status, 401, `${method} ${url} bad token`);
    assert.equal((await call(method, url, { body, token: alice.token })).status, 403, `${method} ${url} as customer`);
  }
});

test('authorization is checked against the database on every request', async () => {
  const temp = await makeUser('temp', { role: 'admin' });
  assert.equal((await call('GET', '/api/admin/me', { token: temp.token })).status, 200);

  await User.updateOne({ _id: temp.user._id }, { role: 'user' }); // demoted after login
  assert.equal((await call('GET', '/api/admin/me', { token: temp.token })).status, 403);

  await User.updateOne({ _id: temp.user._id }, { role: 'admin' });
  await User.deleteOne({ _id: temp.user._id }); // account removed
  assert.equal((await call('GET', '/api/admin/me', { token: temp.token })).status, 401);
});

test('admin accounts cannot use the customer-only order and payment routes', async () => {
  const order = await makeOrder(alice.user);
  const attempts = [
    ['POST', '/api/orders', { base: 'x', sauce: 'x', cheese: 'x' }],
    ['GET', '/api/orders'],
    ['GET', `/api/orders/${order.id}`],
    ['POST', `/api/orders/${order.id}/payment`],
    ['POST', '/api/payments/verify', { orderId: order.id, razorpay_order_id: 'a', razorpay_payment_id: 'b', razorpay_signature: 'c' }],
  ];
  for (const [method, url, body] of attempts) {
    const res = await call(method, url, { token: admin.token, body });
    assert.equal(res.status, 403, `${method} ${url}`);
    assert.match(res.json.message, /Admin accounts/);
  }
  // Customers are unaffected.
  assert.equal((await call('GET', '/api/orders', { token: alice.token })).status, 200);
});

test('an admin and a customer can be signed in at the same time with separate tokens', async () => {
  const order = await makeOrder(alice.user);
  const [adminRes, customerRes] = await Promise.all([
    call('GET', '/api/admin/orders', { token: admin.token }),
    call('GET', `/api/orders/${order.id}`, { token: alice.token }),
  ]);
  assert.equal(adminRes.status, 200);
  assert.equal(customerRes.status, 200);
  assert.equal((await call('GET', '/api/admin/orders', { token: alice.token })).status, 403);
  assert.equal((await call('GET', `/api/orders/${order.id}`, { token: admin.token })).status, 403);
});

test('GET /api/admin/orders lists confirmed orders only, newest first, with customer and order details', async () => {
  const first = await makeOrder(alice.user, { orderStatus: 'IN_KITCHEN' });
  await sleep(15);
  const second = await makeOrder(bob.user);
  await makeOrder(alice.user, { paymentStatus: 'PENDING', orderStatus: undefined }); // unpaid
  await makeOrder(bob.user, { orderStatus: undefined, needsRefund: true }); // paid, awaiting refund

  const res = await call('GET', '/api/admin/orders', { token: admin.token });
  assert.equal(res.status, 200);
  const { orders } = res.json.data;
  assert.deepEqual(orders.map((o) => o.id), [second.id, first.id]);
  assert.deepEqual(orders[0].customer, { name: 'bob', email: 'bob@admin-test.invalid' });
  assert.deepEqual(orders[1].customer, { name: 'alice', email: 'alice@admin-test.invalid' });
  const o = orders[1];
  assert.equal(o.orderStatus, 'IN_KITCHEN');
  assert.equal(o.paymentStatus, 'PAID');
  assert.equal(o.quantity, 2);
  assert.equal(o.amount, 300);
  assert.equal(o.customPizza.base.name, 'Classic');
  assert.equal(o.customPizza.vegetables.length, 1);
  assert.equal(o.userId, undefined);
  assert.ok(!JSON.stringify(res.json).match(/passwordHash|stockDeducted|stock/i));
});

test('GET /api/admin/orders copes with an order whose customer was deleted', async () => {
  const ghost = await makeUser('ghost');
  await makeOrder(ghost.user);
  await User.deleteOne({ _id: ghost.user._id });
  const res = await call('GET', '/api/admin/orders', { token: admin.token });
  assert.equal(res.status, 200);
  assert.equal(res.json.data.orders[0].customer, null);
});

test('status moves forward one step at a time: RECEIVED -> IN_KITCHEN -> SENT_TO_DELIVERY', async () => {
  const order = await makeOrder(alice.user);
  const kitchen = await setStatus(order.id, 'IN_KITCHEN');
  assert.equal(kitchen.status, 200);
  assert.equal(kitchen.json.data.order.orderStatus, 'IN_KITCHEN');
  assert.deepEqual(kitchen.json.data.order.customer, { name: 'alice', email: 'alice@admin-test.invalid' });

  const sent = await setStatus(order.id, 'SENT_TO_DELIVERY');
  assert.equal(sent.status, 200);
  assert.equal((await Order.findById(order.id)).orderStatus, 'SENT_TO_DELIVERY');

  // The customer sees the change.
  const seen = await call('GET', `/api/orders/${order.id}`, { token: alice.token });
  assert.equal(seen.json.data.order.orderStatus, 'SENT_TO_DELIVERY');
});

test('skips, backwards moves, repeats and moves after delivery are rejected and change nothing', async () => {
  const fresh = await makeOrder(alice.user); // ORDER_RECEIVED
  const skip = await setStatus(fresh.id, 'SENT_TO_DELIVERY');
  assert.equal(skip.status, 409);
  assert.equal(skip.json.code, 'INVALID_TRANSITION');
  assert.equal((await setStatus(fresh.id, 'ORDER_RECEIVED')).status, 409); // repeat

  const kitchen = await makeOrder(alice.user, { orderStatus: 'IN_KITCHEN' });
  assert.equal((await setStatus(kitchen.id, 'ORDER_RECEIVED')).status, 409); // backwards
  assert.equal((await setStatus(kitchen.id, 'IN_KITCHEN')).status, 409); // repeat

  const done = await makeOrder(alice.user, { orderStatus: 'SENT_TO_DELIVERY' });
  for (const status of ['ORDER_RECEIVED', 'IN_KITCHEN', 'SENT_TO_DELIVERY']) {
    assert.equal((await setStatus(done.id, status)).status, 409, `from delivered to ${status}`);
  }

  assert.equal((await Order.findById(fresh.id)).orderStatus, 'ORDER_RECEIVED');
  assert.equal((await Order.findById(kitchen.id)).orderStatus, 'IN_KITCHEN');
  assert.equal((await Order.findById(done.id)).orderStatus, 'SENT_TO_DELIVERY');
});

test('unknown, malformed or extra status input is rejected with 400', async () => {
  const order = await makeOrder(alice.user);
  for (const body of [{ status: 'DELIVERED' }, { status: 'in_kitchen' }, { status: '' }, { status: 5 }, {}, { status: 'IN_KITCHEN', amount: 1 }]) {
    const res = await call('PATCH', `/api/admin/orders/${order.id}/status`, { token: admin.token, body });
    assert.equal(res.status, 400, JSON.stringify(body));
  }
  assert.equal((await Order.findById(order.id)).orderStatus, 'ORDER_RECEIVED');
});

test('orders without a status (unpaid or awaiting refund) cannot be advanced; bad ids are 404', async () => {
  const unpaid = await makeOrder(alice.user, { paymentStatus: 'PENDING', orderStatus: undefined });
  const refund = await makeOrder(alice.user, { orderStatus: undefined, needsRefund: true });
  for (const order of [unpaid, refund]) {
    const res = await setStatus(order.id, 'IN_KITCHEN');
    assert.equal(res.status, 409);
    assert.equal(res.json.code, 'ORDER_NOT_CONFIRMED');
    assert.equal((await Order.findById(order.id)).orderStatus, undefined);
  }
  assert.equal((await setStatus(new mongoose.Types.ObjectId().toString(), 'IN_KITCHEN')).status, 404);
  assert.equal((await setStatus('not-an-id', 'IN_KITCHEN')).status, 404);
});

test('a customer cannot change an order status, even their own', async () => {
  const order = await makeOrder(alice.user);
  assert.equal((await setStatus(order.id, 'IN_KITCHEN', alice.token)).status, 403);
  assert.equal((await setStatus(order.id, 'IN_KITCHEN', '')).status, 401);
  assert.equal((await Order.findById(order.id)).orderStatus, 'ORDER_RECEIVED');
});

test('two admins advancing the same order at once: exactly one wins', async () => {
  const order = await makeOrder(alice.user);
  const results = await Promise.all(Array.from({ length: 4 }, () => setStatus(order.id, 'IN_KITCHEN')));
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.ok(results.filter((r) => r.status !== 200).every((r) => r.status === 409));
  assert.equal((await Order.findById(order.id)).orderStatus, 'IN_KITCHEN');
});

test('admin:reset-password updates only that admin, applies the password rule and signs old sessions out', async () => {
  const reset = (email, password) =>
    spawnSync(process.execPath, ['src/scripts/resetAdminPassword.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, NODE_ENV: 'test', ADMIN_EMAIL: email, ADMIN_PASSWORD: password },
      encoding: 'utf8',
    });
  const resetter = await makeUser('resetter', { role: 'admin', password: 'OldAdminPass1' });
  const before = await User.findOne({ _id: resetter.user._id }).select('+passwordHash');
  const bystander = await User.findOne({ _id: alice.user._id }).select('+passwordHash');
  assert.equal((await call('GET', '/api/admin/me', { token: resetter.token })).status, 200);
  await sleep(1100); // token iat has one-second resolution

  const ok = reset('resetter@admin-test.invalid', 'NewAdminPass2');
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /Password updated/);

  const after = await User.findOne({ _id: resetter.user._id }).select('+passwordHash');
  assert.notEqual(after.passwordHash, before.passwordHash);
  assert.equal(after.role, 'admin');
  assert.equal(after.email, before.email);
  assert.ok(after.passwordChangedAt);
  assert.equal((await loginAdmin('resetter@admin-test.invalid', 'OldAdminPass1')).status, 401);
  const fresh = await loginAdmin('resetter@admin-test.invalid', 'NewAdminPass2');
  assert.equal(fresh.status, 200);
  assert.equal((await call('GET', '/api/admin/me', { token: resetter.token })).status, 401); // old session ended
  assert.equal((await call('GET', '/api/admin/me', { token: fresh.json.data.token })).status, 200);
  const stillAlice = await User.findOne({ _id: alice.user._id }).select('+passwordHash');
  assert.equal(stillAlice.passwordHash, bystander.passwordHash);

  // Refusals leave everything as it was.
  const hash = async () => (await User.findOne({ _id: resetter.user._id }).select('+passwordHash')).passwordHash;
  const stable = await hash();
  const weak = reset('resetter@admin-test.invalid', 'short');
  assert.equal(weak.status, 1);
  assert.match(weak.stderr, /Password must be/);
  const customer = reset('alice@admin-test.invalid', 'HackedPass99');
  assert.equal(customer.status, 1);
  assert.match(customer.stderr, /not an admin/);
  assert.equal((await User.findOne({ _id: alice.user._id }).select('+passwordHash')).passwordHash, bystander.passwordHash);
  const missing = reset('nobody@admin-test.invalid', 'SomePass123');
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /No account/);
  assert.equal(await hash(), stable);
  const empty = reset('', '');
  assert.equal(empty.status, 1);
  assert.match(empty.stderr, /ADMIN_EMAIL/);
});
