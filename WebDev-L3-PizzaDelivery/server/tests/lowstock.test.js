// Run with: npm test. Uses the "pizza-delivery-test" database (never the dev data). No real email is ever sent:
// a fake transport records messages, and the cron library is replaced by a fake where the scheduler is tested.
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { env, assertEnv, DEFAULT_LOW_STOCK_CRON } = require('../src/config/env');
const { connectDB } = require('../src/config/db');
const { signToken } = require('../src/utils/jwt');
const { setTransport } = require('../src/services/emailService');
const { runLowStockCheck, startLowStockScheduler } = require('../src/services/lowStockService');
const app = require('../src/app');
const InventoryItem = require('../src/models/InventoryItem');
const User = require('../src/models/User');
const { ingredients } = require('../src/data/menu');

const USER_FILTER = { email: { $regex: 'lowstock-test\\.invalid$' } };
const RECIPIENT = 'alerts@lowstock-test.invalid';
const savedEnv = { alertEmail: env.alertEmail, nodeEnv: env.nodeEnv, lowStockCron: env.lowStockCron };
let server;
let base;
let admin;
let customer;
let sent;
let mailFails;

const call = async (method, url, { body, token = admin.token } = {}) => {
  const res = await fetch(base + url, {
    method,
    headers: { ...(body && { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
};
const makeUser = async (name, role) => {
  const user = await User.create({ name, email: `${name}@lowstock-test.invalid`, passwordHash: 'x', role, isEmailVerified: true });
  return { user, token: signToken(user) };
};
const item = (category, name) => InventoryItem.findOne({ category, name });
const setStock = (category, name, stock) => InventoryItem.updateOne({ category, name }, { stock });
const state = async (category, name) => (await item(category, name)).lowStockAlertState;
const idOf = async (category, name) => String((await item(category, name))._id);
const names = (mail) => ['Classic', 'Thin Crust', 'Pesto', 'BBQ', 'Mozzarella', 'Onion'].filter((n) => mail.text.includes(`- ${n} (`));

test.before(async () => {
  assertEnv();
  await connectDB();
  await Promise.all([InventoryItem.deleteMany({}), User.deleteMany(USER_FILTER)]);
  admin = await makeUser('boss', 'admin');
  customer = await makeUser('cora', 'user');
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

test.beforeEach(async () => {
  sent = [];
  mailFails = false;
  env.alertEmail = RECIPIENT;
  setTransport({
    sendMail: async (mail) => {
      if (mailFails) throw new Error('SMTP down');
      sent.push(mail);
    },
  });
  await InventoryItem.deleteMany({});
  await InventoryItem.insertMany(ingredients); // thresholds: bases 20, sauces 1000, cheeses 800, vegetables 600
});

test.after(async () => {
  setTransport(null);
  Object.assign(env, savedEnv);
  await Promise.all([InventoryItem.deleteMany({}), User.deleteMany(USER_FILTER)]);
  server.close();
  await mongoose.disconnect();
});

test('nothing low: no email, and the run reports how many items it checked', async () => {
  const result = await runLowStockCheck();
  assert.deepEqual(result, { checked: ingredients.length, alerted: [] });
  assert.equal(sent.length, 0);
});

test('newly low items go out in ONE digest email with name, category, stock, threshold and status', async () => {
  await setStock('base', 'Classic', 5); // low
  await setStock('sauce', 'Pesto', 0); // out
  await setStock('base', 'Thin Crust', 20); // equal to the threshold: still OK
  const result = await runLowStockCheck();

  assert.equal(sent.length, 1);
  const mail = sent[0];
  assert.equal(mail.to, RECIPIENT);
  assert.match(mail.subject, /2 ingredients/);
  assert.deepEqual(names(mail).sort(), ['Classic', 'Pesto']);
  assert.match(mail.text, /- Classic \(base\): 5 pcs left, threshold 20 - Low stock/);
  assert.match(mail.text, /- Pesto \(sauce\): 0 ml left, threshold 1000 - Out of stock/);
  assert.match(mail.html, /Low stock/);
  assert.match(mail.html, /Out of stock/);
  assert.deepEqual(result.alerted.map((a) => [a.name, a.status]).sort(), [['Classic', 'LOW'], ['Pesto', 'OUT_OF_STOCK']]);
  assert.equal(await state('base', 'Classic'), 'LOW');
  assert.equal(await state('sauce', 'Pesto'), 'OUT_OF_STOCK');
  assert.equal(await state('base', 'Thin Crust'), undefined);
});

test('an unchanged low item is not emailed again on later runs', async () => {
  await setStock('base', 'Classic', 5);
  await runLowStockCheck();
  for (let i = 0; i < 3; i++) {
    const again = await runLowStockCheck();
    assert.deepEqual(again.alerted, []);
  }
  assert.equal(sent.length, 1);
});

test('only newly low items are in a later digest; items already alerted are left out', async () => {
  await setStock('base', 'Classic', 5);
  await runLowStockCheck();
  await setStock('sauce', 'BBQ', 10);
  await runLowStockCheck();
  assert.equal(sent.length, 2);
  assert.deepEqual(names(sent[1]), ['BBQ']);
});

test('escalation: LOW -> OUT_OF_STOCK is one new alert, then silence while it stays out', async () => {
  await setStock('base', 'Classic', 5);
  await runLowStockCheck();
  await setStock('base', 'Classic', 0);
  const escalated = await runLowStockCheck();
  assert.deepEqual(escalated.alerted.map((a) => [a.name, a.status]), [['Classic', 'OUT_OF_STOCK']]);
  assert.equal(sent.length, 2);
  assert.match(sent[1].text, /Out of stock/);
  assert.equal(await state('base', 'Classic'), 'OUT_OF_STOCK');
  await runLowStockCheck();
  assert.equal(sent.length, 2);
});

test('restocking to >= the threshold resets the alert immediately (via the admin API), so a later drop emails again', async () => {
  await setStock('base', 'Classic', 5);
  await runLowStockCheck();
  assert.equal(await state('base', 'Classic'), 'LOW');

  // Restock above the threshold and drop again BEFORE any scheduler run: the reset must already have happened.
  const restock = await call('PATCH', `/api/admin/inventory/${await idOf('base', 'Classic')}`, { body: { stock: 100, expectedStock: 5 } });
  assert.equal(restock.status, 200);
  assert.equal(await state('base', 'Classic'), undefined);
  await setStock('base', 'Classic', 3);
  const again = await runLowStockCheck();
  assert.deepEqual(again.alerted.map((a) => a.name), ['Classic']);
  assert.equal(sent.length, 2);
});

test('+10 / +50 restocks reset the alert only once the item reaches its threshold', async () => {
  await setStock('base', 'Classic', 5);
  await runLowStockCheck();
  const id = await idOf('base', 'Classic');
  await call('PATCH', `/api/admin/inventory/${id}`, { body: { adjustBy: 10 } }); // 15: still low
  assert.equal(await state('base', 'Classic'), 'LOW');
  await call('PATCH', `/api/admin/inventory/${id}`, { body: { adjustBy: 10 } }); // 25: OK
  assert.equal(await state('base', 'Classic'), undefined);
});

test('lowering a threshold so the item is OK again also resets the alert', async () => {
  await setStock('base', 'Classic', 5);
  await runLowStockCheck();
  await call('PATCH', `/api/admin/inventory/${await idOf('base', 'Classic')}`, { body: { lowStockThreshold: 5 } });
  assert.equal(await state('base', 'Classic'), undefined);
});

test('out of stock -> partly restocked (still low) sends nothing, but falling to 0 again is a new alert', async () => {
  await setStock('base', 'Classic', 0);
  await runLowStockCheck();
  await call('PATCH', `/api/admin/inventory/${await idOf('base', 'Classic')}`, { body: { adjustBy: 5 } });
  assert.equal(await state('base', 'Classic'), 'LOW');
  assert.deepEqual((await runLowStockCheck()).alerted, []);
  assert.equal(sent.length, 1);
  await setStock('base', 'Classic', 0);
  assert.deepEqual((await runLowStockCheck()).alerted.map((a) => a.status), ['OUT_OF_STOCK']);
  assert.equal(sent.length, 2);
});

test('the safety net: a run also clears alert state for items that were restocked behind its back', async () => {
  await setStock('sauce', 'Pesto', 0);
  await runLowStockCheck();
  await setStock('sauce', 'Pesto', 5000); // restocked directly in the database
  await runLowStockCheck();
  assert.equal(await state('sauce', 'Pesto'), undefined);
});

test('inactive items are ignored', async () => {
  await InventoryItem.updateOne({ category: 'sauce', name: 'Pesto' }, { stock: 0, active: false });
  const result = await runLowStockCheck();
  assert.deepEqual(result.alerted, []);
  assert.equal(sent.length, 0);
});

test('overlapping runs send exactly one email', async () => {
  await setStock('base', 'Classic', 5);
  await setStock('sauce', 'Pesto', 0);
  const results = await Promise.all([runLowStockCheck(), runLowStockCheck(), runLowStockCheck()]);
  assert.equal(sent.length, 1);
  assert.equal(results.filter((r) => r.alerted.length > 0).length, 1);
  assert.ok(results.some((r) => r.skipped === 'ALREADY_RUNNING'));
});

test('two instances racing for the same items: each item is claimed once', async () => {
  await setStock('base', 'Classic', 5);
  // Simulate another server instance claiming the item between this run's read and its claim.
  const original = InventoryItem.find;
  InventoryItem.find = async function patched(...args) {
    const docs = await original.apply(this, args);
    await InventoryItem.updateOne({ category: 'base', name: 'Classic' }, { lowStockAlertState: 'LOW' });
    return docs;
  };
  try {
    const result = await runLowStockCheck();
    assert.deepEqual(result.alerted, []);
    assert.equal(sent.length, 0);
  } finally {
    InventoryItem.find = original;
  }
});

test('a failed email never crashes the run, releases the claim, and the next run retries', async () => {
  await setStock('base', 'Classic', 5);
  mailFails = true;
  const failed = await runLowStockCheck();
  assert.equal(failed.failed, true);
  assert.deepEqual(failed.alerted, []);
  assert.equal(await state('base', 'Classic'), undefined);

  mailFails = false;
  const retried = await runLowStockCheck();
  assert.deepEqual(retried.alerted.map((a) => a.name), ['Classic']);
  assert.equal(sent.length, 1);
});

test('a failed escalation email restores the earlier LOW state', async () => {
  await setStock('base', 'Classic', 5);
  await runLowStockCheck();
  await setStock('base', 'Classic', 0);
  mailFails = true;
  await runLowStockCheck();
  assert.equal(await state('base', 'Classic'), 'LOW');
  mailFails = false;
  assert.deepEqual((await runLowStockCheck()).alerted.map((a) => a.status), ['OUT_OF_STOCK']);
});

test('no recipient configured: nothing is sent or marked, and alerts flow once an address is set', async () => {
  await setStock('base', 'Classic', 5);
  env.alertEmail = '';
  const result = await runLowStockCheck();
  assert.equal(result.skipped, 'NO_RECIPIENT');
  assert.equal(sent.length, 0);
  assert.equal(await state('base', 'Classic'), undefined);
  env.alertEmail = RECIPIENT;
  assert.equal((await runLowStockCheck()).alerted.length, 1);
});

test('the digest escapes item names in HTML', async () => {
  await InventoryItem.updateOne({ category: 'base', name: 'Classic' }, { name: '<b>Classic</b> & Co', stock: 1 });
  await runLowStockCheck();
  assert.ok(!sent[0].html.includes('<b>Classic</b>'));
  assert.match(sent[0].html, /&lt;b&gt;Classic&lt;\/b&gt; &amp; Co/);
});

test('POST /api/admin/inventory/check-low-stock is admin-only', async () => {
  assert.equal((await call('POST', '/api/admin/inventory/check-low-stock', { token: '' })).status, 401);
  assert.equal((await call('POST', '/api/admin/inventory/check-low-stock', { token: customer.token })).status, 403);
  assert.equal(sent.length, 0);
});

test('check-low-stock runs the same job with the same duplicate rules', async () => {
  await setStock('base', 'Classic', 5);
  await setStock('sauce', 'Pesto', 0);
  const first = await call('POST', '/api/admin/inventory/check-low-stock');
  assert.equal(first.status, 200);
  assert.equal(first.json.data.checked, ingredients.length);
  assert.deepEqual(first.json.data.alerted.map((a) => a.name).sort(), ['Classic', 'Pesto']);
  assert.equal(sent.length, 1);

  const second = await call('POST', '/api/admin/inventory/check-low-stock');
  assert.deepEqual(second.json.data.alerted, []);
  const third = await call('POST', '/api/admin/inventory/check-low-stock');
  assert.deepEqual(third.json.data.alerted, []);
  assert.equal(sent.length, 1); // the button cannot be used to spam
});

test('check-low-stock reports a mail failure (502) or a missing recipient (409) clearly', async () => {
  await setStock('base', 'Classic', 5);
  mailFails = true;
  const failed = await call('POST', '/api/admin/inventory/check-low-stock');
  assert.equal(failed.status, 502);
  assert.equal(failed.json.code, 'EMAIL_FAILED');
  assert.ok(!JSON.stringify(failed.json).includes('SMTP down'));
  mailFails = false;

  env.alertEmail = '';
  const none = await call('POST', '/api/admin/inventory/check-low-stock');
  assert.equal(none.status, 409);
  assert.equal(none.json.code, 'NO_RECIPIENT');
  env.alertEmail = RECIPIENT;
  assert.equal((await call('POST', '/api/admin/inventory/check-low-stock')).json.data.alerted.length, 1);
});

test('scheduler: never starts under NODE_ENV=test', () => {
  const fake = { validate: () => assert.fail('must not be touched'), schedule: () => assert.fail('must not schedule') };
  assert.equal(startLowStockScheduler({ cron: fake }), null);
});

test('scheduler: schedules the configured LOW_STOCK_CHECK_CRON expression and logs each run briefly', async () => {
  const logs = [];
  const log = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  env.nodeEnv = 'development';
  env.lowStockCron = '*/1 * * * *';
  try {
    const calls = [];
    const fake = { validate: (e) => e === '*/1 * * * *', schedule: (expr, fn) => (calls.push({ expr, fn }), { stop() {} }) };
    assert.ok(startLowStockScheduler({ cron: fake }));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].expr, '*/1 * * * *');

    await setStock('base', 'Classic', 5);
    await calls[0].fn(); // one cron tick
    await calls[0].fn(); // the next tick: nothing new
    const runLines = logs.filter((l) => l.startsWith('[low-stock] checked'));
    assert.deepEqual(runLines, [
      `[low-stock] checked ${ingredients.length} items, alerted 1`,
      `[low-stock] checked ${ingredients.length} items, alerted 0`,
    ]);
    assert.equal(sent.length, 1);
    assert.ok(!logs.join('\n').includes(RECIPIENT), 'logs must not contain the alert address');
  } finally {
    console.log = log;
    env.nodeEnv = savedEnv.nodeEnv;
    env.lowStockCron = savedEnv.lowStockCron;
  }
});

test('scheduler: an invalid expression falls back to the default with a warning', () => {
  const warns = [];
  const warn = console.warn;
  const log = console.log;
  console.warn = (...args) => warns.push(args.join(' '));
  console.log = () => {};
  env.nodeEnv = 'development';
  env.lowStockCron = 'not a cron';
  try {
    const used = [];
    const fake = { validate: (e) => e === DEFAULT_LOW_STOCK_CRON, schedule: (expr) => (used.push(expr), { stop() {} }) };
    startLowStockScheduler({ cron: fake });
    assert.deepEqual(used, [DEFAULT_LOW_STOCK_CRON]);
    assert.match(warns[0], /Invalid LOW_STOCK_CHECK_CRON/);
  } finally {
    console.warn = warn;
    console.log = log;
    env.nodeEnv = savedEnv.nodeEnv;
    env.lowStockCron = savedEnv.lowStockCron;
  }
});

test('scheduler: the real node-cron accepts the default and a 1-minute expression', () => {
  const cron = require('node-cron');
  assert.equal(cron.validate(DEFAULT_LOW_STOCK_CRON), true);
  assert.equal(cron.validate('*/1 * * * *'), true);
  assert.equal(cron.validate('not a cron'), false);
});
