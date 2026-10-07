// Run with: npm test. Uses the "pizza-delivery-test" database (never the dev data).
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { assertEnv } = require('../src/config/env');
const { connectDB } = require('../src/config/db');
const { signToken } = require('../src/utils/jwt');
const app = require('../src/app');
const InventoryItem = require('../src/models/InventoryItem');
const Order = require('../src/models/Order');
const User = require('../src/models/User');
const { ingredients } = require('../src/data/menu');

const USER_FILTER = { email: { $regex: 'order-test\\.invalid$' } };
let server;
let base;
let ids;
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
const makeUser = async (name) => {
  const user = await User.create({ name, email: `${name}@order-test.invalid`, passwordHash: 'x', isEmailVerified: true });
  return { user, token: signToken(user) };
};
const selection = (extra = {}) => ({
  base: ids['base:Classic'],
  sauce: ids['sauce:Classic Tomato'],
  cheese: ids['cheese:Mozzarella'],
  vegetables: [ids['vegetable:Onion'], ids['vegetable:Mushroom']],
  ...extra,
});
const priceOf = (category, name) => ingredients.find((i) => i.category === category && i.name === name).price;
// Classic + Classic Tomato + Mozzarella + Onion + Mushroom
const UNIT = priceOf('base', 'Classic') + priceOf('sauce', 'Classic Tomato') + priceOf('cheese', 'Mozzarella') + priceOf('vegetable', 'Onion') + priceOf('vegetable', 'Mushroom');

test.before(async () => {
  assertEnv();
  await connectDB();
  await Promise.all([InventoryItem.deleteMany({}), Order.deleteMany({}), User.deleteMany(USER_FILTER)]);
  const docs = await InventoryItem.insertMany(ingredients);
  ids = Object.fromEntries(docs.map((d) => [`${d.category}:${d.name}`, d.id]));
  alice = await makeUser('alice');
  bob = await makeUser('bob');
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await Promise.all([InventoryItem.deleteMany({}), Order.deleteMany({}), User.deleteMany(USER_FILTER)]);
  server.close();
  await mongoose.disconnect();
});

test('every orders endpoint needs a login', async () => {
  assert.equal((await call('POST', '/api/orders', { body: selection() })).status, 401);
  assert.equal((await call('GET', '/api/orders')).status, 401);
  assert.equal((await call('GET', `/api/orders/${new mongoose.Types.ObjectId()}`)).status, 401);
});

test('POST /api/orders creates an unpaid order with a server-computed amount and a snapshot', async () => {
  const { status, json } = await call('POST', '/api/orders', { token: alice.token, body: selection({ quantity: 3 }) });
  assert.equal(status, 201);
  const { order } = json.data;
  assert.equal(order.unitPrice, UNIT);
  assert.equal(order.quantity, 3);
  assert.equal(order.amount, UNIT * 3);
  assert.equal(order.paymentStatus, 'PENDING');
  assert.equal(order.orderStatus, undefined);
  assert.equal(order.customPizza.base.name, 'Classic');
  assert.equal(order.customPizza.base.price, priceOf('base', 'Classic'));
  assert.equal(order.customPizza.vegetables.length, 2);
  assert.equal(order.userId, undefined);
});

test('quantity defaults to 1 and must be a whole number from 1 to 5', async () => {
  const one = await call('POST', '/api/orders', { token: alice.token, body: selection() });
  assert.equal(one.json.data.order.quantity, 1);
  assert.equal(one.json.data.order.amount, UNIT);
  assert.equal((await call('POST', '/api/orders', { token: alice.token, body: selection({ quantity: 5 }) })).status, 201);
  for (const quantity of [0, 6, -1, 1.5, '2', null]) {
    const res = await call('POST', '/api/orders', { token: alice.token, body: selection({ quantity }) });
    assert.equal(res.status, 400, `quantity ${quantity}`);
  }
});

test('client-supplied amount, price, status or user fields are rejected', async () => {
  const extras = [{ amount: 1 }, { total: 1 }, { unitPrice: 1 }, { orderStatus: 'ORDER_RECEIVED' }, { paymentStatus: 'PAID' }, { userId: String(bob.user._id) }];
  for (const extra of extras) {
    assert.equal((await call('POST', '/api/orders', { token: alice.token, body: selection(extra) })).status, 400);
  }
});

test('the amount follows database prices, and the snapshot keeps the price and name at order time', async () => {
  await InventoryItem.updateOne({ category: 'cheese', name: 'Mozzarella' }, { price: priceOf('cheese', 'Mozzarella') + 60 });
  const created = await call('POST', '/api/orders', { token: alice.token, body: selection({ quantity: 2 }) });
  assert.equal(created.json.data.order.amount, (UNIT + 60) * 2);
  await InventoryItem.updateOne({ category: 'cheese', name: 'Mozzarella' }, { price: priceOf('cheese', 'Mozzarella'), name: 'Mozzarella Renamed' });
  const stored = await Order.findById(created.json.data.order.id);
  assert.equal(stored.customPizza.cheese.price, priceOf('cheese', 'Mozzarella') + 60);
  assert.equal(stored.customPizza.cheese.name, 'Mozzarella');
  await InventoryItem.updateOne({ category: 'cheese', name: 'Mozzarella Renamed' }, { name: 'Mozzarella' });
});

test('out-of-stock, insufficient-stock and inactive ingredients are rejected', async () => {
  await InventoryItem.updateOne({ category: 'sauce', name: 'Pesto' }, { stock: 0 });
  const oos = await call('POST', '/api/orders', { token: alice.token, body: selection({ sauce: ids['sauce:Pesto'] }) });
  assert.equal(oos.status, 409);
  assert.equal(oos.json.code, 'OUT_OF_STOCK');

  await InventoryItem.updateOne({ category: 'sauce', name: 'Pesto' }, { stock: 2 });
  const few = await call('POST', '/api/orders', { token: alice.token, body: selection({ sauce: ids['sauce:Pesto'], quantity: 3 }) });
  assert.equal(few.status, 409);
  assert.equal(few.json.code, 'INSUFFICIENT_STOCK');
  assert.match(few.json.message, /Pesto/);
  // Exactly enough stock is fine (stock >= quantity).
  const exact = await call('POST', '/api/orders', { token: alice.token, body: selection({ sauce: ids['sauce:Pesto'], quantity: 2 }) });
  assert.equal(exact.status, 201);

  await InventoryItem.updateOne({ category: 'vegetable', name: 'Olive' }, { active: false });
  const inactive = await call('POST', '/api/orders', { token: alice.token, body: selection({ vegetables: [ids['vegetable:Olive']] }) });
  assert.equal(inactive.status, 400);
  await InventoryItem.updateOne({ category: 'sauce', name: 'Pesto' }, { stock: 5000 });
  await InventoryItem.updateOne({ category: 'vegetable', name: 'Olive' }, { active: true });
});

test('an invalid or rejected order creates nothing', async () => {
  const before = await Order.countDocuments();
  await call('POST', '/api/orders', { token: alice.token, body: selection({ cheese: ids['sauce:BBQ'] }) });
  await call('POST', '/api/orders', { token: alice.token, body: selection({ quantity: 9 }) });
  await call('POST', '/api/orders', { token: alice.token, body: { base: ids['base:Classic'] } });
  assert.equal(await Order.countDocuments(), before);
});

test('PENDING orders never reserve or decrement stock', async () => {
  const snapshot = async () => (await InventoryItem.find({}).sort({ category: 1, name: 1 }).lean()).map((i) => [i.name, i.stock]);
  const before = await snapshot();
  const created = await call('POST', '/api/orders', { token: alice.token, body: selection({ quantity: 5 }) });
  assert.equal(created.status, 201);
  assert.deepEqual(await snapshot(), before);
});

test('unpaid orders are hidden from history and detail', async () => {
  await Order.deleteMany({});
  const created = await call('POST', '/api/orders', { token: alice.token, body: selection() });
  assert.deepEqual((await call('GET', '/api/orders', { token: alice.token })).json.data.orders, []);
  assert.equal((await call('GET', `/api/orders/${created.json.data.order.id}`, { token: alice.token })).status, 404);
});

test('confirmed orders appear newest first, and each user sees only their own', async () => {
  await Order.deleteMany({});
  const make = async (user, quantity, orderStatus) => {
    const res = await call('POST', '/api/orders', { token: user.token, body: selection({ quantity }) });
    await Order.updateOne({ _id: res.json.data.order.id }, { paymentStatus: 'PAID', orderStatus });
    return res.json.data.order.id;
  };
  const first = await make(alice, 1, 'ORDER_RECEIVED');
  await new Promise((r) => setTimeout(r, 15));
  const second = await make(alice, 2, 'IN_KITCHEN');
  const bobs = await make(bob, 1, 'SENT_TO_DELIVERY');

  const list = await call('GET', '/api/orders', { token: alice.token });
  assert.deepEqual(list.json.data.orders.map((o) => o.id), [second, first]);
  const bobList = await call('GET', '/api/orders', { token: bob.token });
  assert.deepEqual(bobList.json.data.orders.map((o) => o.id), [bobs]);

  const detail = await call('GET', `/api/orders/${second}`, { token: alice.token });
  assert.equal(detail.status, 200);
  assert.equal(detail.json.data.order.orderStatus, 'IN_KITCHEN');
  assert.equal(detail.json.data.order.quantity, 2);

  // Another user's order, an unknown id and a malformed id all look the same.
  for (const id of [bobs, String(new mongoose.Types.ObjectId()), 'not-an-id']) {
    const res = await call('GET', `/api/orders/${id}`, { token: alice.token });
    assert.equal(res.status, 404);
    assert.equal(res.json.message, 'Order not found.');
  }
});

test('order responses never contain stock numbers or the owner id', async () => {
  const res = await call('POST', '/api/orders', { token: alice.token, body: selection() });
  assert.ok(!JSON.stringify(res.json).match(/stock|userId|passwordHash/i));
});

test('orderStatus only accepts the three required statuses', async () => {
  const res = await call('POST', '/api/orders', { token: alice.token, body: selection() });
  const id = res.json.data.order.id;
  await assert.rejects(Order.updateOne({ _id: id }, { orderStatus: 'DELIVERED' }, { runValidators: true }));
  for (const s of ['ORDER_RECEIVED', 'IN_KITCHEN', 'SENT_TO_DELIVERY']) {
    await Order.updateOne({ _id: id }, { orderStatus: s }, { runValidators: true });
  }
});

test('POST /api/pizzas/price also quotes quantity, unit price and total', async () => {
  const res = await call('POST', '/api/pizzas/price', { body: selection({ quantity: 4 }) });
  assert.equal(res.status, 200);
  assert.equal(res.json.data.unitPrice, UNIT);
  assert.equal(res.json.data.quantity, 4);
  assert.equal(res.json.data.total, UNIT * 4);
  assert.equal((await call('POST', '/api/pizzas/price', { body: selection({ quantity: 6 }) })).status, 400);
});
