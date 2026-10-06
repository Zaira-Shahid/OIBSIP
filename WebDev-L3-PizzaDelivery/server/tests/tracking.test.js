// Run with: npm test. Uses the "pizza-delivery-test" database. The browser polls these same endpoints.
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { assertEnv } = require('../src/config/env');
const { connectDB } = require('../src/config/db');
const { signToken } = require('../src/utils/jwt');
const app = require('../src/app');
const Order = require('../src/models/Order');
const User = require('../src/models/User');

const USER_FILTER = { email: { $regex: 'tracking-test\\.invalid$' } };
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
const makeUser = async (name, role = 'user') => {
  const user = await User.create({ name, email: `${name}@tracking-test.invalid`, passwordHash: 'x', role, isEmailVerified: true });
  return { user, token: signToken(user) };
};
const line = (name, price) => ({ ingredientId: new mongoose.Types.ObjectId(), name, price });
const makeOrder = (user) =>
  Order.create({
    userId: user._id,
    customPizza: { base: line('Classic', 80), sauce: line('Classic Tomato', 20), cheese: line('Mozzarella', 40), vegetables: [] },
    unitPrice: 140,
    quantity: 1,
    amount: 140,
    paymentStatus: 'PAID',
    orderStatus: 'ORDER_RECEIVED',
  });
const advance = (id, status) => call('PATCH', `/api/admin/orders/${id}/status`, { token: admin.token, body: { status } });
const seen = async (user, id) => (await call('GET', `/api/orders/${id}`, { token: user.token })).json.data.order.orderStatus;
const listed = async (user) => (await call('GET', '/api/orders', { token: user.token })).json.data.orders;

test.before(async () => {
  assertEnv();
  await connectDB();
  await Promise.all([Order.deleteMany({}), User.deleteMany(USER_FILTER)]);
  [admin, alice, bob] = [await makeUser('boss', 'admin'), await makeUser('alice'), await makeUser('bob')];
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await Promise.all([Order.deleteMany({}), User.deleteMany(USER_FILTER)]);
  server.close();
  await mongoose.disconnect();
});

test('the customer sees each admin status change on the very next fetch (detail and list)', async () => {
  const order = await makeOrder(alice.user);
  assert.equal(await seen(alice, order.id), 'ORDER_RECEIVED');

  assert.equal((await advance(order.id, 'IN_KITCHEN')).status, 200);
  assert.equal(await seen(alice, order.id), 'IN_KITCHEN');
  assert.equal((await listed(alice))[0].orderStatus, 'IN_KITCHEN');

  assert.equal((await advance(order.id, 'SENT_TO_DELIVERY')).status, 200);
  assert.equal(await seen(alice, order.id), 'SENT_TO_DELIVERY');
  assert.equal((await listed(alice))[0].orderStatus, 'SENT_TO_DELIVERY');
});

test('a status change reaches only the order owner', async () => {
  const mine = await makeOrder(alice.user);
  const theirs = await makeOrder(bob.user);
  await advance(mine.id, 'IN_KITCHEN');
  assert.equal(await seen(bob, theirs.id), 'ORDER_RECEIVED');
  assert.equal((await call('GET', `/api/orders/${mine.id}`, { token: bob.token })).status, 404);
  assert.equal((await listed(bob)).find((o) => o.id === theirs.id).orderStatus, 'ORDER_RECEIVED');
});

test('a newly confirmed order appears in the admin list on the next fetch', async () => {
  const before = (await call('GET', '/api/admin/orders', { token: admin.token })).json.data.orders.length;
  const order = await makeOrder(bob.user);
  const after = (await call('GET', '/api/admin/orders', { token: admin.token })).json.data.orders;
  assert.equal(after.length, before + 1);
  assert.equal(after[0].id, order.id); // newest first
});
