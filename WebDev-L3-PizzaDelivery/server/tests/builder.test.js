// Run with: npm test. Uses the "pizza-delivery-test" database (never the dev data).
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { assertEnv } = require('../src/config/env');
const { connectDB } = require('../src/config/db');
const app = require('../src/app');
const InventoryItem = require('../src/models/InventoryItem');
const { ingredients } = require('../src/data/menu');
const { priceCustomPizza } = require('../src/services/pricingService');

let server;
let base;
let ids; // "category:name" -> id string

const post = async (body) => {
  const res = await fetch(`${base}/api/pizzas/price`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
};
const priceOf = (category, name) => ingredients.find((i) => i.category === category && i.name === name).price;
const NO_VEG = priceOf('base', 'Classic') + priceOf('sauce', 'Classic Tomato') + priceOf('cheese', 'Mozzarella');
const UNIT = NO_VEG + priceOf('vegetable', 'Onion') + priceOf('vegetable', 'Mushroom');
const id = (key) => ids[key];
const valid = () => ({
  base: id('base:Classic'),
  sauce: id('sauce:Classic Tomato'),
  cheese: id('cheese:Mozzarella'),
  vegetables: [id('vegetable:Onion'), id('vegetable:Mushroom')],
});

test.before(async () => {
  assertEnv();
  await connectDB();
  await InventoryItem.deleteMany({});
  const docs = await InventoryItem.insertMany(ingredients);
  ids = Object.fromEntries(docs.map((d) => [`${d.category}:${d.name}`, d.id]));
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await InventoryItem.deleteMany({});
  server.close();
  await mongoose.disconnect();
});

test('price = base + sauce + cheese + vegetables, from database prices', async () => {
  const { status, json } = await post(valid());
  assert.equal(status, 200);
  assert.equal(json.data.total, UNIT);
  assert.deepEqual(json.data.items.map((i) => i.category), ['base', 'sauce', 'cheese', 'vegetable', 'vegetable']);
  assert.ok(json.data.items.every((i) => i.id && i.name && typeof i.price === 'number'));
});

test('vegetables are optional (omitted or empty)', async () => {
  const { vegetables, ...rest } = valid();
  assert.equal((await post(rest)).json.data.total, NO_VEG);
  assert.equal((await post({ ...rest, vegetables: [] })).json.data.total, NO_VEG);
});

test('price follows the database: an admin price change is reflected', async () => {
  await InventoryItem.updateOne({ category: 'cheese', name: 'Mozzarella' }, { price: priceOf('cheese', 'Mozzarella') + 15 });
  assert.equal((await post(valid())).json.data.total, UNIT + 15);
  await InventoryItem.updateOne({ category: 'cheese', name: 'Mozzarella' }, { price: priceOf('cheese', 'Mozzarella') });
});

test('client-supplied prices or totals are rejected, never trusted', async () => {
  for (const extra of [{ total: 1 }, { price: 1 }, { prices: { base: 1 } }]) {
    const { status } = await post({ ...valid(), ...extra });
    assert.equal(status, 400);
  }
});

test('exactly one base, sauce and cheese are required', async () => {
  for (const field of ['base', 'sauce', 'cheese']) {
    const body = valid();
    delete body[field];
    const missing = await post(body);
    assert.equal(missing.status, 400);
    assert.match(missing.json.message, new RegExp(`choose a ${field}`));
    // Several cheeses (or an array) is not "one".
    const many = await post({ ...valid(), [field]: [id('base:Classic'), id('base:Thin Crust')] });
    assert.equal(many.status, 400);
  }
});

test('an ingredient in the wrong category is rejected', async () => {
  assert.equal((await post({ ...valid(), cheese: id('sauce:BBQ') })).status, 400);
  assert.equal((await post({ ...valid(), base: id('cheese:Cheddar') })).status, 400);
  assert.equal((await post({ ...valid(), vegetables: [id('cheese:Cheddar')] })).status, 400);
});

test('malformed, unknown and duplicate ids are rejected', async () => {
  assert.equal((await post({ ...valid(), base: 'nope' })).status, 400);
  assert.equal((await post({ ...valid(), sauce: new mongoose.Types.ObjectId().toString() })).status, 400);
  const dup = await post({ ...valid(), vegetables: [id('vegetable:Onion'), id('vegetable:Onion')] });
  assert.equal(dup.status, 400);
  assert.equal((await post({ ...valid(), vegetables: 'Onion' })).status, 400);
  assert.equal((await post('{bad json')).status, 400);
});

test('inactive and out-of-stock ingredients are rejected', async () => {
  await InventoryItem.updateOne({ category: 'sauce', name: 'Pesto' }, { stock: 0 });
  await InventoryItem.updateOne({ category: 'vegetable', name: 'Olive' }, { active: false });

  const oos = await post({ ...valid(), sauce: id('sauce:Pesto') });
  assert.equal(oos.status, 409);
  assert.equal(oos.json.code, 'OUT_OF_STOCK');
  assert.match(oos.json.message, /Pesto/);

  assert.equal((await post({ ...valid(), vegetables: [id('vegetable:Olive')] })).status, 400);

  await InventoryItem.updateOne({ category: 'sauce', name: 'Pesto' }, { stock: 100 });
  await InventoryItem.updateOne({ category: 'vegetable', name: 'Olive' }, { active: true });
});

test('response never exposes stock numbers', async () => {
  const { json } = await post(valid());
  assert.ok(!JSON.stringify(json).match(/stock|lowStockThreshold/i));
});

test('the pricing service (reused by order creation) enforces the same rules', async () => {
  const ok = await priceCustomPizza(valid());
  assert.equal(ok.total, UNIT);
  await assert.rejects(() => priceCustomPizza({ ...valid(), cheese: id('base:Classic') }), { statusCode: 400 });
});

test('the price route is not shadowed by /:id', async () => {
  const res = await fetch(`${base}/api/pizzas/price`);
  assert.equal(res.status, 404); // GET /price is treated as a malformed pizza id
  assert.equal((await res.json()).message, 'Pizza not found.');
});
