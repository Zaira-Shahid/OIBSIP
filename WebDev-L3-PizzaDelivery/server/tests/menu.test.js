// Run with: npm test. Uses the "pizza-delivery-test" database (never the dev data).
process.env.NODE_ENV = 'test';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const mongoose = require('mongoose');

const { assertEnv } = require('../src/config/env');
const { connectDB } = require('../src/config/db');
const app = require('../src/app');
const InventoryItem = require('../src/models/InventoryItem');
const Pizza = require('../src/models/Pizza');
const { ingredients, pizzas } = require('../src/data/menu');

let server;
let base;
const get = async (url) => {
  const res = await fetch(base + url);
  return { status: res.status, json: await res.json() };
};
const seed = () =>
  execFileSync(process.execPath, [path.join(__dirname, '../src/scripts/seedMenu.js')], {
    env: { ...process.env, NODE_ENV: 'test' },
    encoding: 'utf8',
  });

test.before(async () => {
  assertEnv();
  await connectDB();
  await Promise.all([InventoryItem.deleteMany({}), Pizza.deleteMany({})]);
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await Promise.all([InventoryItem.deleteMany({}), Pizza.deleteMany({})]);
  server.close();
  await mongoose.disconnect();
});

test('seed data meets the minimum counts', () => {
  const count = (c) => ingredients.filter((i) => i.category === c).length;
  assert.ok(count('base') >= 5);
  assert.ok(count('sauce') >= 5);
  assert.ok(count('cheese') >= 4);
  assert.ok(count('vegetable') >= 7);
  assert.equal(pizzas.length, 6);
  assert.ok(pizzas.every((p) => p.image.startsWith('https://images.unsplash.com/')));
});

test('menu endpoints return empty lists before seeding', async () => {
  const p = await get('/api/pizzas');
  assert.equal(p.status, 200);
  assert.deepEqual(p.json.data.pizzas, []);
  const i = await get('/api/ingredients');
  assert.deepEqual(i.json.data.ingredients, { base: [], sauce: [], cheese: [], vegetable: [] });
});

test('seed script is idempotent and never overwrites later edits', async () => {
  seed();
  assert.equal(await InventoryItem.countDocuments(), ingredients.length);
  assert.equal(await Pizza.countDocuments(), pizzas.length);

  // Simulate an admin editing stock/price, then re-seed.
  await InventoryItem.updateOne({ category: 'base', name: 'Classic' }, { stock: 7, price: 999 });
  await Pizza.updateOne({ name: 'Margherita' }, { price: 1 });
  const out = seed();
  assert.match(out, /Ingredients: 0 added/);
  assert.match(out, /Pizzas: 0 added/);
  assert.equal(await InventoryItem.countDocuments(), ingredients.length);
  assert.equal(await Pizza.countDocuments(), pizzas.length);

  const edited = await InventoryItem.findOne({ category: 'base', name: 'Classic' });
  assert.equal(edited.stock, 7);
  assert.equal(edited.price, 999);
  assert.equal((await Pizza.findOne({ name: 'Margherita' })).price, 1);
});

test('GET /api/pizzas lists available pizzas with the expected fields', async () => {
  const { status, json } = await get('/api/pizzas');
  assert.equal(status, 200);
  assert.equal(json.data.pizzas.length, 6);
  for (const p of json.data.pizzas) {
    assert.deepEqual(Object.keys(p).filter((k) => ['id', 'name', 'description', 'image', 'price', 'available'].includes(k)).sort(),
      ['available', 'description', 'id', 'image', 'name', 'price']);
    assert.equal(p._id, undefined);
  }
});

test('unavailable pizzas are hidden from list and detail', async () => {
  await Pizza.updateOne({ name: 'BBQ Paneer' }, { available: false });
  const list = await get('/api/pizzas');
  assert.equal(list.json.data.pizzas.length, 5);
  assert.ok(!list.json.data.pizzas.some((p) => p.name === 'BBQ Paneer'));
  const hidden = await Pizza.findOne({ name: 'BBQ Paneer' });
  assert.equal((await get(`/api/pizzas/${hidden.id}`)).status, 404);
  await Pizza.updateOne({ name: 'BBQ Paneer' }, { available: true });
});

test('GET /api/pizzas/:id returns one pizza; bad or unknown ids give 404', async () => {
  const doc = await Pizza.findOne({ name: 'Margherita' });
  const ok = await get(`/api/pizzas/${doc.id}`);
  assert.equal(ok.status, 200);
  assert.equal(ok.json.data.pizza.name, 'Margherita');
  assert.equal((await get(`/api/pizzas/${new mongoose.Types.ObjectId()}`)).status, 404);
  const bad = await get('/api/pizzas/not-an-id');
  assert.equal(bad.status, 404);
  assert.equal(bad.json.message, 'Pizza not found.');
});

test('GET /api/ingredients groups active items by category and hides stock numbers', async () => {
  const { status, json } = await get('/api/ingredients');
  assert.equal(status, 200);
  const { ingredients: g } = json.data;
  assert.deepEqual(Object.keys(g).sort(), ['base', 'cheese', 'sauce', 'vegetable']);
  assert.equal(g.base.length, 5);
  assert.equal(g.sauce.length, 5);
  assert.equal(g.cheese.length, 4);
  assert.equal(g.vegetable.length, 7);
  for (const item of Object.values(g).flat()) {
    assert.deepEqual(Object.keys(item).sort(), ['available', 'id', 'name', 'price']);
  }
  assert.ok(!JSON.stringify(json).match(/stock|lowStockThreshold/i));
});

test('ingredient availability follows stock; inactive items are excluded', async () => {
  await InventoryItem.updateOne({ category: 'sauce', name: 'Pesto' }, { stock: 0 });
  await InventoryItem.updateOne({ category: 'vegetable', name: 'Olive' }, { active: false });
  const { json } = await get('/api/ingredients');
  assert.equal(json.data.ingredients.sauce.find((s) => s.name === 'Pesto').available, false);
  assert.equal(json.data.ingredients.sauce.find((s) => s.name === 'Classic Tomato').available, true);
  assert.ok(!json.data.ingredients.vegetable.some((v) => v.name === 'Olive'));
  assert.equal(json.data.ingredients.vegetable.length, 6);
});

test('menu endpoints are public (no token needed)', async () => {
  assert.equal((await get('/api/pizzas')).status, 200);
  assert.equal((await get('/api/ingredients')).status, 200);
});
