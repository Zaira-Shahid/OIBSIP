// Run with: npm test. Uses the "pizza-delivery-test" database and a FAKE Razorpay gateway:
// no request ever reaches Razorpay, and whatever keys are in .env are overridden below.
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mongoose = require('mongoose');

const { env, assertEnv } = require('../src/config/env');
const { connectDB } = require('../src/config/db');
const { signToken } = require('../src/utils/jwt');
const { setGateway } = require('../src/services/paymentService');
const app = require('../src/app');
const InventoryItem = require('../src/models/InventoryItem');
const Order = require('../src/models/Order');
const User = require('../src/models/User');
const { ingredients } = require('../src/data/menu');

const KEY_ID = 'rzp_test_unittestkey';
const KEY_SECRET = 'unit_test_secret_value';
const USER_FILTER = { email: { $regex: 'payment-test\\.invalid$' } };
const savedKeys = { ...env.razorpay };

let server;
let base;
let ids;
let alice;
let bob;
let gatewayCalls;
let gatewayFails;

const call = async (method, url, { body, token } = {}) => {
  const res = await fetch(base + url, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
};
const makeUser = async (name) => {
  const user = await User.create({ name, email: `${name}@payment-test.invalid`, passwordHash: 'x', isEmailVerified: true });
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
const UNIT = priceOf('base', 'Classic') + priceOf('sauce', 'Classic Tomato') + priceOf('cheese', 'Mozzarella') + priceOf('vegetable', 'Onion') + priceOf('vegetable', 'Mushroom');
const sign = (razorpayOrderId, paymentId, secret = KEY_SECRET) =>
  crypto.createHmac('sha256', secret).update(`${razorpayOrderId}|${paymentId}`).digest('hex');

const newOrder = async (user = alice, extra = {}) =>
  (await call('POST', '/api/orders', { token: user.token, body: selection(extra) })).json.data.order;
const startPayment = (orderId, user = alice) => call('POST', `/api/orders/${orderId}/payment`, { token: user.token });
const verify = (orderId, rzpOrderId, paymentId, signature, user = alice) =>
  call('POST', '/api/payments/verify', {
    token: user.token,
    body: { orderId, razorpay_order_id: rzpOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature },
  });
// Creates an order, starts payment, and returns what the checkout popup would hand back after a successful payment.
const payable = async (extra = {}, user = alice) => {
  const order = await newOrder(user, extra);
  const started = await startPayment(order.id, user);
  const rzp = started.json.data.payment.razorpayOrderId;
  const paymentId = `pay_${crypto.randomBytes(6).toString('hex')}`;
  return { order, rzp, paymentId, signature: sign(rzp, paymentId) };
};
const stocks = async () =>
  Object.fromEntries((await InventoryItem.find({}).lean()).map((i) => [`${i.category}:${i.name}`, i.stock]));
const TOUCHED = ['base:Classic', 'sauce:Classic Tomato', 'cheese:Mozzarella', 'vegetable:Onion', 'vegetable:Mushroom'];

test.before(async () => {
  assertEnv();
  await connectDB();
  setGateway({
    createOrder: async ({ amount, receipt }) => {
      gatewayCalls.push({ amount, receipt });
      if (gatewayFails) throw new Error('gateway down');
      return { id: `order_fake_${gatewayCalls.length}_${crypto.randomBytes(4).toString('hex')}` };
    },
  });
  env.razorpay.keyId = KEY_ID;
  env.razorpay.keySecret = KEY_SECRET;
  await Promise.all([InventoryItem.deleteMany({}), Order.deleteMany({}), User.deleteMany(USER_FILTER)]);
  alice = await makeUser('alice');
  bob = await makeUser('bob');
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

test.beforeEach(async () => {
  gatewayCalls = [];
  gatewayFails = false;
  env.razorpay.keyId = KEY_ID;
  env.razorpay.keySecret = KEY_SECRET;
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

test('payment endpoints need a login', async () => {
  const order = await newOrder();
  assert.equal((await call('POST', `/api/orders/${order.id}/payment`)).status, 401);
  assert.equal((await call('POST', '/api/payments/verify', { body: {} })).status, 401);
});

test('payments are refused until test keys are configured; live keys are refused', async () => {
  const order = await newOrder();
  env.razorpay.keyId = '';
  env.razorpay.keySecret = '';
  const off = await startPayment(order.id);
  assert.equal(off.status, 503);
  assert.equal(off.json.code, 'PAYMENTS_NOT_CONFIGURED');

  env.razorpay.keyId = 'rzp_live_abc';
  env.razorpay.keySecret = 'whatever';
  const live = await startPayment(order.id);
  assert.equal(live.status, 503);
  assert.match(live.json.message, /test-mode/);
  assert.equal(gatewayCalls.length, 0);
});

test('starting payment makes a Razorpay order from the stored amount in paise and never exposes the secret', async () => {
  const order = await newOrder(alice, { quantity: 3 });
  const { status, json } = await startPayment(order.id);
  assert.equal(status, 200);
  assert.deepEqual(gatewayCalls, [{ amount: UNIT * 3 * 100, receipt: order.id }]);
  const { payment } = json.data;
  assert.equal(payment.amount, UNIT * 3 * 100);
  assert.equal(payment.currency, 'INR');
  assert.equal(payment.keyId, KEY_ID);
  assert.ok(payment.razorpayOrderId.startsWith('order_fake_'));
  assert.ok(!JSON.stringify(json).includes(KEY_SECRET));
  assert.equal((await Order.findById(order.id)).razorpayOrderId, payment.razorpayOrderId);
});

test('starting payment: other users, unknown and malformed ids get 404', async () => {
  const order = await newOrder();
  assert.equal((await startPayment(order.id, bob)).status, 404);
  assert.equal((await startPayment(String(new mongoose.Types.ObjectId()))).status, 404);
  assert.equal((await startPayment('not-an-id')).status, 404);
  assert.equal(gatewayCalls.length, 0);
});

test('starting payment re-checks stock (409) and contacts the gateway only when stock is fine', async () => {
  const order = await newOrder(alice, { quantity: 3 });
  await InventoryItem.updateOne({ category: 'cheese', name: 'Mozzarella' }, { stock: 2 });
  const short = await startPayment(order.id);
  assert.equal(short.status, 409);
  assert.equal(short.json.code, 'INSUFFICIENT_STOCK');
  await InventoryItem.updateOne({ category: 'cheese', name: 'Mozzarella' }, { stock: 0 });
  assert.equal((await startPayment(order.id)).json.code, 'OUT_OF_STOCK');
  assert.equal(gatewayCalls.length, 0);
});

test('starting payment refuses when prices changed since the order was created', async () => {
  const order = await newOrder();
  await InventoryItem.updateOne({ category: 'base', name: 'Classic' }, { price: 500 });
  const res = await startPayment(order.id);
  assert.equal(res.status, 409);
  assert.equal(res.json.code, 'PRICE_CHANGED');
  assert.equal(gatewayCalls.length, 0);
});

test('a gateway failure gives a safe 502 and leaves the order retryable', async () => {
  const order = await newOrder();
  gatewayFails = true;
  const res = await startPayment(order.id);
  assert.equal(res.status, 502);
  assert.ok(!JSON.stringify(res.json).includes('gateway down'));
  gatewayFails = false;
  assert.equal((await startPayment(order.id)).status, 200);
});

test('closing the popup leaves the order retryable: each retry makes a fresh Razorpay order', async () => {
  const order = await newOrder();
  const first = (await startPayment(order.id)).json.data.payment.razorpayOrderId;
  const second = (await startPayment(order.id)).json.data.payment.razorpayOrderId;
  assert.notEqual(first, second);
  assert.equal(gatewayCalls.length, 2);
  const stored = await Order.findById(order.id);
  assert.equal(stored.paymentStatus, 'PENDING');
  assert.equal(stored.razorpayOrderId, second);
  // The abandoned first attempt can no longer confirm the order.
  const stale = await verify(order.id, first, 'pay_old', sign(first, 'pay_old'));
  assert.equal(stale.status, 400);
  assert.equal(stale.json.code, 'PAYMENT_MISMATCH');
});

test('verify: a bad or forged signature is rejected, changes nothing, and the order stays retryable', async () => {
  const p = await payable();
  const before = await stocks();
  const forged = [
    sign(p.rzp, p.paymentId, 'attacker_secret'),
    sign(p.rzp, 'pay_other'),
    'a'.repeat(64),
    'short',
  ];
  for (const signature of forged) {
    const res = await verify(p.order.id, p.rzp, p.paymentId, signature);
    assert.equal(res.status, 400, signature);
    assert.equal(res.json.code, 'INVALID_SIGNATURE');
  }
  const stored = await Order.findById(p.order.id);
  assert.equal(stored.paymentStatus, 'PENDING');
  assert.equal(stored.orderStatus, undefined);
  assert.deepEqual(await stocks(), before);
  // The genuine payment still works afterwards.
  assert.equal((await verify(p.order.id, p.rzp, p.paymentId, p.signature)).status, 200);
});

test('verify: a valid signature confirms the order and takes quantity of each ingredient', async () => {
  const p = await payable({ quantity: 2 });
  const before = await stocks();
  const { status, json } = await verify(p.order.id, p.rzp, p.paymentId, p.signature);
  assert.equal(status, 200);
  assert.equal(json.data.order.orderStatus, 'ORDER_RECEIVED');
  assert.equal(json.data.order.paymentStatus, 'PAID');
  assert.equal(json.data.order.paymentReference, p.paymentId);

  const after = await stocks();
  for (const key of Object.keys(before)) {
    assert.equal(after[key], before[key] - (TOUCHED.includes(key) ? 2 : 0), key);
  }
  const stored = await Order.findById(p.order.id);
  assert.equal(stored.stockDeducted, true);
  assert.ok(stored.paidAt);

  // It now shows up in the user's history.
  const list = await call('GET', '/api/orders', { token: alice.token });
  assert.deepEqual(list.json.data.orders.map((o) => o.id), [p.order.id]);
});

test('verify: only the owner can verify; the signature of someone else\'s order is useless', async () => {
  const p = await payable();
  const res = await verify(p.order.id, p.rzp, p.paymentId, p.signature, bob);
  assert.equal(res.status, 404);
  assert.equal((await Order.findById(p.order.id)).paymentStatus, 'PENDING');
});

test('verify is idempotent: a repeated call never decrements stock twice', async () => {
  const p = await payable();
  const first = await stocks();
  await verify(p.order.id, p.rzp, p.paymentId, p.signature);
  const afterFirst = await stocks();
  for (let i = 0; i < 3; i++) {
    const again = await verify(p.order.id, p.rzp, p.paymentId, p.signature);
    assert.equal(again.status, 200);
    assert.equal(again.json.data.order.orderStatus, 'ORDER_RECEIVED');
  }
  assert.deepEqual(await stocks(), afterFirst);
  assert.equal(afterFirst['base:Classic'], first['base:Classic'] - 1);
});

test('verify is idempotent under concurrency: simultaneous calls decrement once', async () => {
  const p = await payable();
  const first = await stocks();
  const results = await Promise.all(
    Array.from({ length: 5 }, () => verify(p.order.id, p.rzp, p.paymentId, p.signature))
  );
  assert.ok(results.every((r) => [200, 409].includes(r.status)));
  assert.ok(results.some((r) => r.status === 200));
  const after = await stocks();
  assert.equal(after['base:Classic'], first['base:Classic'] - 1);
  assert.equal(after['vegetable:Mushroom'], first['vegetable:Mushroom'] - 1);
});

test('stock gone after payment: order stays PAID without a status, flagged for refund, nothing partially decremented', async () => {
  const p = await payable({ quantity: 2 });
  // The last ingredient taken (a vegetable) runs short after checkout began; earlier ones must be rolled back.
  await InventoryItem.updateOne({ category: 'vegetable', name: 'Mushroom' }, { stock: 1 });
  const before = await stocks();

  const res = await verify(p.order.id, p.rzp, p.paymentId, p.signature);
  assert.equal(res.status, 409);
  assert.equal(res.json.code, 'PAID_NOT_CONFIRMED');
  assert.match(res.json.message, /refunded/);

  const stored = await Order.findById(p.order.id);
  assert.equal(stored.paymentStatus, 'PAID');
  assert.equal(stored.orderStatus, undefined);
  assert.equal(stored.needsRefund, true);
  assert.equal(stored.stockDeducted, false);
  assert.deepEqual(await stocks(), before); // rolled back, never negative
  assert.ok(Object.values(await stocks()).every((n) => n >= 0));

  // A repeat gives the same answer and still changes nothing.
  const again = await verify(p.order.id, p.rzp, p.paymentId, p.signature);
  assert.equal(again.status, 409);
  assert.equal(again.json.code, 'PAID_NOT_CONFIRMED');
  assert.deepEqual(await stocks(), before);

  // It is not a confirmed order, and it cannot be paid again.
  assert.deepEqual((await call('GET', '/api/orders', { token: alice.token })).json.data.orders, []);
  assert.equal((await startPayment(p.order.id)).json.code, 'ALREADY_PAID');
});

test('stock can reach exactly zero but never below', async () => {
  const p = await payable({ quantity: 2 });
  await InventoryItem.updateMany({ _id: { $in: TOUCHED.map((k) => ids[k]) } }, { stock: 2 });
  assert.equal((await verify(p.order.id, p.rzp, p.paymentId, p.signature)).status, 200);
  const after = await stocks();
  assert.ok(TOUCHED.every((k) => after[k] === 0));
});

test('a paid order cannot start another payment', async () => {
  const p = await payable();
  await verify(p.order.id, p.rzp, p.paymentId, p.signature);
  const again = await startPayment(p.order.id);
  assert.equal(again.status, 409);
  assert.equal(again.json.code, 'ALREADY_PAID');
});

test('verify validates its body and rejects unknown fields', async () => {
  const p = await payable();
  const body = { orderId: p.order.id, razorpay_order_id: p.rzp, razorpay_payment_id: p.paymentId, razorpay_signature: p.signature };
  for (const bad of [{ ...body, amount: 1 }, { ...body, razorpay_signature: undefined }, { ...body, orderId: '' }, {}]) {
    assert.equal((await call('POST', '/api/payments/verify', { token: alice.token, body: bad })).status, 400);
  }
  assert.equal((await verify('not-an-id', p.rzp, p.paymentId, p.signature)).status, 404);
  assert.equal((await Order.findById(p.order.id)).paymentStatus, 'PENDING');
});

test('payment responses never contain the key secret', async () => {
  const p = await payable();
  const res = await verify(p.order.id, p.rzp, p.paymentId, p.signature);
  assert.ok(!JSON.stringify(res.json).includes(KEY_SECRET));
});
