// Run with: npm test. Uses the "pizza-delivery-test" database (never the dev data) and a FAKE Razorpay gateway.
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const { env, assertEnv } = require('../src/config/env');
const { connectDB } = require('../src/config/db');
const { signToken } = require('../src/utils/jwt');
const { setGateway } = require('../src/services/paymentService');
const { inventoryStatus } = require('../src/services/inventoryService');
const app = require('../src/app');
const InventoryItem = require('../src/models/InventoryItem');
const Order = require('../src/models/Order');
const User = require('../src/models/User');
const { ingredients } = require('../src/data/menu');

const USER_FILTER = { email: { $regex: 'inventory-test\\.invalid$' } };
const KEY_SECRET = 'inventory_test_secret';
const savedKeys = { ...env.razorpay };
let server;
let base;
let admin;
let customer;
let ids;

const call = async (method, url, { body, token = admin.token } = {}) => {
  const res = await fetch(base + url, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
};
const makeUser = async (name, role) => {
  const user = await User.create({ name, email: `${name}@inventory-test.invalid`, passwordHash: 'x', role, isEmailVerified: true });
  return { user, token: signToken(user) };
};
const list = async () => (await call('GET', '/api/admin/inventory')).json.data;
const find = async (key) => (await list()).items.find((i) => `${i.category}:${i.name}` === key);
const patch = (key, body, token) => call('PATCH', `/api/admin/inventory/${ids[key]}`, { body, token });
const stockOf = async (key) => (await InventoryItem.findById(ids[key])).stock;
const CLASSIC = 'base:Classic';

test.before(async () => {
  assertEnv();
  await connectDB();
  await Promise.all([InventoryItem.deleteMany({}), Order.deleteMany({}), User.deleteMany(USER_FILTER)]);
  admin = await makeUser('boss', 'admin');
  customer = await makeUser('cora', 'user');
  setGateway({ createOrder: async () => ({ id: `order_fake_${crypto.randomBytes(5).toString('hex')}` }) });
  env.razorpay.keyId = 'rzp_test_inventorytest';
  env.razorpay.keySecret = KEY_SECRET;
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

test.beforeEach(async () => {
  await Promise.all([InventoryItem.deleteMany({}), Order.deleteMany({})]);
  const docs = await InventoryItem.insertMany(ingredients);
  ids = Object.fromEntries(docs.map((d) => [`${d.category}:${d.name}`, d.id]));
});

test.after(async () => {
  setGateway(null);
  Object.assign(env.razorpay, savedKeys);
  await Promise.all([InventoryItem.deleteMany({}), Order.deleteMany({}), User.deleteMany(USER_FILTER)]);
  server.close();
  await mongoose.disconnect();
});

test('status rule: out at 0, low strictly below the threshold, OK at or above it', () => {
  const s = (stock, lowStockThreshold) => inventoryStatus({ stock, lowStockThreshold });
  assert.equal(s(0, 20), 'OUT_OF_STOCK');
  assert.equal(s(0, 0), 'OUT_OF_STOCK');
  assert.equal(s(1, 20), 'LOW');
  assert.equal(s(19, 20), 'LOW');
  assert.equal(s(20, 20), 'OK');
  assert.equal(s(21, 20), 'OK');
  assert.equal(s(5, 0), 'OK');
});

test('inventory routes need an admin: no token 401, customer 403', async () => {
  const id = ids[CLASSIC];
  for (const [method, url, body] of [['GET', '/api/admin/inventory'], ['PATCH', `/api/admin/inventory/${id}`, { adjustBy: 5 }]]) {
    assert.equal((await call(method, url, { body, token: '' })).status, 401, `${method} no token`);
    assert.equal((await call(method, url, { body, token: customer.token })).status, 403, `${method} customer`);
  }
  assert.equal(await stockOf(CLASSIC), 100);
});

test('GET /api/admin/inventory lists every item, grouped by category then name, with fields and a summary', async () => {
  await InventoryItem.updateOne({ category: 'sauce', name: 'Pesto' }, { active: false });
  const { items, summary } = (await call('GET', '/api/admin/inventory')).json.data;
  assert.equal(items.length, ingredients.length); // inactive included
  assert.deepEqual(Object.keys(items[0]).sort(), ['active', 'category', 'id', 'lowStockThreshold', 'name', 'status', 'stock', 'unit', 'updatedAt']);
  const order = [...new Set(items.map((i) => i.category))];
  assert.deepEqual(order, ['base', 'sauce', 'cheese', 'vegetable']);
  const bases = items.filter((i) => i.category === 'base').map((i) => i.name);
  assert.deepEqual(bases, [...bases].sort((a, b) => a.localeCompare(b)));
  assert.equal(items.find((i) => i.name === 'Pesto').active, false);
  assert.deepEqual(summary, { total: ingredients.length - 1, low: 0, outOfStock: 0 });
});

test('summary counts low and out-of-stock items, active ones only', async () => {
  await InventoryItem.updateOne({ category: 'base', name: 'Classic' }, { stock: 19 }); // threshold 20: low
  await InventoryItem.updateOne({ category: 'base', name: 'Thin Crust' }, { stock: 20 }); // equal: OK
  await InventoryItem.updateOne({ category: 'sauce', name: 'BBQ' }, { stock: 0 }); // out
  await InventoryItem.updateOne({ category: 'sauce', name: 'Pesto' }, { stock: 0, active: false }); // inactive: ignored
  const { items, summary } = await list();
  assert.equal(items.find((i) => i.name === 'Classic').status, 'LOW');
  assert.equal(items.find((i) => i.name === 'Thin Crust').status, 'OK');
  assert.equal(items.find((i) => i.name === 'BBQ').status, 'OUT_OF_STOCK');
  assert.equal(items.find((i) => i.name === 'Pesto').status, 'OUT_OF_STOCK');
  assert.deepEqual(summary, { total: ingredients.length - 1, low: 1, outOfStock: 1 });
});

test('set stock with the stock you saw: saved, and the response is the updated item', async () => {
  const res = await patch(CLASSIC, { stock: 250, expectedStock: 100 });
  assert.equal(res.status, 200);
  assert.equal(res.json.data.item.stock, 250);
  assert.equal(res.json.data.item.status, 'OK');
  assert.equal(await stockOf(CLASSIC), 250);
  assert.equal((await patch(CLASSIC, { stock: 0, expectedStock: 250 })).json.data.item.status, 'OUT_OF_STOCK');
});

test('set stock when it changed meanwhile: 409 with the current row, nothing saved', async () => {
  await InventoryItem.updateOne({ _id: ids[CLASSIC] }, { $inc: { stock: -3 } }); // an order took 3 after the admin loaded the page
  const res = await patch(CLASSIC, { stock: 500, expectedStock: 100 });
  assert.equal(res.status, 409);
  assert.equal(res.json.code, 'STOCK_CHANGED');
  assert.equal(res.json.data.item.stock, 97);
  assert.match(res.json.message, /changed to 97/);
  assert.equal(await stockOf(CLASSIC), 97);
});

test('five admins setting stock from the same view at once: exactly one wins', async () => {
  const results = await Promise.all([1, 2, 3, 4, 5].map((n) => patch(CLASSIC, { stock: 100 + n, expectedStock: 100 })));
  assert.equal(results.filter((r) => r.status === 200).length, 1);
  assert.ok(results.filter((r) => r.status !== 200).every((r) => r.status === 409));
});

test('restock buttons: +10 and +50 are atomic increments, even under concurrency', async () => {
  assert.equal((await patch(CLASSIC, { adjustBy: 10 })).json.data.item.stock, 110);
  assert.equal((await patch(CLASSIC, { adjustBy: 50 })).json.data.item.stock, 160);
  const results = await Promise.all(Array.from({ length: 10 }, () => patch(CLASSIC, { adjustBy: 10 })));
  assert.ok(results.every((r) => r.status === 200));
  assert.equal(await stockOf(CLASSIC), 260); // no lost updates
});

test('an adjustment cannot take stock below 0 or above the maximum, and changes nothing when refused', async () => {
  const under = await patch(CLASSIC, { adjustBy: -101 });
  assert.equal(under.status, 409);
  assert.equal(under.json.code, 'ADJUSTMENT_REJECTED');
  assert.match(under.json.message, /only 100 in stock/);
  assert.equal(await stockOf(CLASSIC), 100);
  assert.equal((await patch(CLASSIC, { adjustBy: -100 })).json.data.item.stock, 0); // exactly zero is fine
  await InventoryItem.updateOne({ _id: ids[CLASSIC] }, { stock: 999995 });
  assert.equal((await patch(CLASSIC, { adjustBy: 10 })).status, 409);
  assert.equal(await stockOf(CLASSIC), 999995);
  assert.equal((await patch(CLASSIC, { adjustBy: 5 })).json.data.item.stock, 1000000);
});

test('adjustments racing with order decrements never go negative', async () => {
  await InventoryItem.updateOne({ _id: ids[CLASSIC] }, { stock: 5 });
  const results = await Promise.all(Array.from({ length: 10 }, () => patch(CLASSIC, { adjustBy: -1 })));
  assert.equal(results.filter((r) => r.status === 200).length, 5);
  assert.equal(await stockOf(CLASSIC), 0);
});

test('threshold and active can be edited without touching stock, and the status follows', async () => {
  const raised = await patch(CLASSIC, { lowStockThreshold: 150 });
  assert.equal(raised.status, 200);
  assert.equal(raised.json.data.item.stock, 100);
  assert.equal(raised.json.data.item.lowStockThreshold, 150);
  assert.equal(raised.json.data.item.status, 'LOW');
  assert.equal((await patch(CLASSIC, { lowStockThreshold: 0 })).json.data.item.status, 'OK');
  assert.equal((await patch(CLASSIC, { active: false })).json.data.item.active, false);
  assert.equal((await patch(CLASSIC, { active: true })).json.data.item.active, true);
});

test('a combined edit applies all fields together, or none when the stock check fails', async () => {
  const ok = await patch(CLASSIC, { stock: 40, expectedStock: 100, lowStockThreshold: 30, active: false });
  assert.deepEqual(
    [ok.json.data.item.stock, ok.json.data.item.lowStockThreshold, ok.json.data.item.active],
    [40, 30, false]
  );
  const bad = await patch(CLASSIC, { stock: 70, expectedStock: 100, lowStockThreshold: 99, active: true });
  assert.equal(bad.status, 409);
  const after = await InventoryItem.findById(ids[CLASSIC]);
  assert.deepEqual([after.stock, after.lowStockThreshold, after.active], [40, 30, false]);
});

test('invalid input is rejected with 400 and nothing changes', async () => {
  const bad = [
    {},
    { stock: 5 }, // missing expectedStock
    { expectedStock: 100 }, // expectedStock alone
    { stock: 5, expectedStock: 100, adjustBy: 5 }, // set and adjust together
    { stock: -1, expectedStock: 100 },
    { stock: 1.5, expectedStock: 100 },
    { stock: '5', expectedStock: 100 },
    { stock: 1000001, expectedStock: 100 },
    { stock: null, expectedStock: 100 },
    { adjustBy: 0 },
    { adjustBy: 2.5 },
    { adjustBy: '10' },
    { adjustBy: 1000001 },
    { lowStockThreshold: -1 },
    { lowStockThreshold: 'x' },
    { active: 'yes' },
    { price: 1 },
    { name: 'Hacked' },
    { category: 'cheese' },
    { unit: 'kg' },
    { adjustBy: 5, role: 'admin' },
  ];
  for (const body of bad) {
    assert.equal((await patch(CLASSIC, body)).status, 400, JSON.stringify(body));
  }
  const item = await InventoryItem.findById(ids[CLASSIC]);
  assert.deepEqual([item.stock, item.price, item.name, item.category, item.unit], [100, 80, 'Classic', 'base', 'pcs']);
});

test('unknown and malformed ids give 404', async () => {
  const body = { adjustBy: 5 };
  assert.equal((await call('PATCH', `/api/admin/inventory/${new mongoose.Types.ObjectId()}`, { body })).status, 404);
  assert.equal((await call('PATCH', '/api/admin/inventory/not-an-id', { body })).status, 404);
  assert.equal((await call('PATCH', `/api/admin/inventory/${new mongoose.Types.ObjectId()}`, { body: { stock: 1, expectedStock: 1 } })).status, 404);
});

test('admin edits change what customers see in the builder and whether they can order', async () => {
  const builder = async () => (await call('GET', '/api/ingredients', { token: '' })).json.data.ingredients;
  await patch('sauce:Pesto', { stock: 0, expectedStock: 5000 });
  assert.equal((await builder()).sauce.find((s) => s.name === 'Pesto').available, false);
  await patch('sauce:Pesto', { adjustBy: 20 });
  assert.equal((await builder()).sauce.find((s) => s.name === 'Pesto').available, true);
  await patch('vegetable:Olive', { active: false });
  assert.ok(!(await builder()).vegetable.some((v) => v.name === 'Olive'));

  // Stock lower than the quantity blocks the order with a clear 409.
  await patch(CLASSIC, { stock: 2, expectedStock: 100 });
  const order = await call('POST', '/api/orders', {
    token: customer.token,
    body: { base: ids[CLASSIC], sauce: ids['sauce:Classic Tomato'], cheese: ids['cheese:Mozzarella'], quantity: 3 },
  });
  assert.equal(order.status, 409);
  assert.equal(order.json.code, 'INSUFFICIENT_STOCK');
});

test('A3 end to end: a paid order lowers stock by its quantity, and the admin view shows it', async () => {
  const picks = [CLASSIC, 'sauce:Classic Tomato', 'cheese:Mozzarella', 'vegetable:Onion', 'vegetable:Mushroom'];
  const before = Object.fromEntries(await Promise.all(picks.map(async (k) => [k, (await find(k)).stock])));
  const untouched = await find('cheese:Cheddar');

  const created = await call('POST', '/api/orders', {
    token: customer.token,
    body: {
      base: ids[CLASSIC],
      sauce: ids['sauce:Classic Tomato'],
      cheese: ids['cheese:Mozzarella'],
      vegetables: [ids['vegetable:Onion'], ids['vegetable:Mushroom']],
      quantity: 3,
    },
  });
  const orderId = created.json.data.order.id;
  assert.deepEqual(Object.fromEntries(await Promise.all(picks.map(async (k) => [k, (await find(k)).stock]))), before); // unpaid: no change

  const started = await call('POST', `/api/orders/${orderId}/payment`, { token: customer.token });
  const rzp = started.json.data.payment.razorpayOrderId;
  const signature = crypto.createHmac('sha256', KEY_SECRET).update(`${rzp}|pay_inv1`).digest('hex');
  const verified = await call('POST', '/api/payments/verify', {
    token: customer.token,
    body: { orderId, razorpay_order_id: rzp, razorpay_payment_id: 'pay_inv1', razorpay_signature: signature },
  });
  assert.equal(verified.status, 200);

  for (const k of picks) assert.equal((await find(k)).stock, before[k] - 3, k);
  assert.equal((await find('cheese:Cheddar')).stock, untouched.stock);
  assert.equal((await list()).summary.outOfStock, 0);
});
