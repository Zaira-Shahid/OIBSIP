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
  assert.ok(ingredients.some((i) => i.name === 'Paneer' && i.category === 'vegetable'));
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
  await Pizza.updateOne({ name: 'Margherita' }, { description: 'Edited by an admin.' });
  const out = seed();
  assert.match(out, /Ingredients: 0 added/);
  assert.match(out, /Pizzas: 0 added/);
  assert.match(out, /Upgraded from an older seed: 0 ingredient prices, 0 pizza updates/);
  assert.equal(await InventoryItem.countDocuments(), ingredients.length);
  assert.equal(await Pizza.countDocuments(), pizzas.length);

  const edited = await InventoryItem.findOne({ category: 'base', name: 'Classic' });
  assert.equal(edited.stock, 7);
  assert.equal(edited.price, 999);
  assert.equal((await Pizza.findOne({ name: 'Margherita' })).description, 'Edited by an admin.');
});

test('GET /api/pizzas lists available pizzas with the expected fields', async () => {
  const { status, json } = await get('/api/pizzas');
  assert.equal(status, 200);
  assert.equal(json.data.pizzas.length, 6);
  for (const p of json.data.pizzas) {
    assert.deepEqual(Object.keys(p).sort(), ['available', 'description', 'id', 'image', 'ingredients', 'name', 'price', 'selection']);
    assert.deepEqual(Object.keys(p.selection).sort(), ['base', 'cheese', 'sauce', 'vegetables']);
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
  assert.equal(g.vegetable.length, 8);
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
  assert.equal(json.data.ingredients.vegetable.length, 7);
});

test('menu endpoints are public (no token needed)', async () => {
  assert.equal((await get('/api/pizzas')).status, 200);
  assert.equal((await get('/api/ingredients')).status, 200);
});

// ---- Presets: defaultIngredients, computed prices, and upgrading an older database ----

const priceOf = (category, name) => ingredients.find((i) => i.category === category && i.name === name).price;
const presetSum = (preset) => preset.defaults.reduce((sum, [category, name]) => sum + priceOf(category, name), 0);
const legacyIngredient = (i) => ({ ...i, price: i.legacyPrice ?? i.price });
const presetNamed = (name) => pizzas.find((p) => p.name === name);
const OLD_PEPPERONI = presetNamed('Mushroom Melt').replaces;
const OLD_MARGHERITA = presetNamed('Margherita').legacyDescription;
const post = async (url, body) => {
  const res = await fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json() };
};
const freshSeed = async () => {
  await Pizza.deleteMany({});
  await InventoryItem.deleteMany({});
  seed();
};
const legacyPizza = (name, description, image) => {
  const now = new Date();
  return { name, description, image, price: 299, available: true, createdAt: now, updatedAt: now };
};

test('every seeded preset is buildable: one base, sauce and cheese from real ingredients, no duplicates', () => {
  for (const preset of pizzas) {
    const picked = preset.defaults.map(([category, name]) => ingredients.find((i) => i.category === category && i.name === name));
    assert.ok(picked.every(Boolean), `${preset.name} uses only seeded ingredients`);
    for (const category of ['base', 'sauce', 'cheese']) {
      assert.equal(picked.filter((i) => i.category === category).length, 1, `${preset.name} has exactly one ${category}`);
    }
    assert.equal(new Set(preset.defaults.map(([c, n]) => `${c}:${n}`)).size, preset.defaults.length, `${preset.name} has no duplicates`);
  }
});

test('seeded prices are in a realistic range for a pizza menu', () => {
  for (const preset of pizzas) {
    const sum = presetSum(preset);
    assert.ok(sum >= 200 && sum <= 450, `${preset.name} costs ${sum}`);
  }
});

test('the menu price is the sum of the preset ingredient prices, and selection is its exact ingredient set', async () => {
  await freshSeed();
  const list = (await get('/api/pizzas')).json.data.pizzas;
  assert.equal(list.length, pizzas.length);
  const byId = new Map((await InventoryItem.find({})).map((i) => [String(i._id), i]));
  for (const preset of pizzas) {
    const card = list.find((p) => p.name === preset.name);
    assert.equal(card.price, presetSum(preset), preset.name);
    const { base, sauce, cheese, vegetables } = card.selection;
    const names = [base, sauce, cheese, ...vegetables].map((id) => byId.get(id).name);
    assert.deepEqual(names.sort(), preset.defaults.map(([, n]) => n).sort(), preset.name);
    assert.deepEqual([...card.ingredients].sort(), preset.defaults.map(([, n]) => n).sort());
  }
  const prices = list.map((p) => p.price);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b)); // cheapest first
});

test('what you see is what you pay: the builder price endpoint quotes exactly the card price for a preset', async () => {
  for (const card of (await get('/api/pizzas')).json.data.pizzas) {
    const quote = await post('/api/pizzas/price', card.selection);
    assert.equal(quote.status, 200, card.name);
    assert.equal(quote.json.data.total, card.price, card.name);
  }
});

test('changing an ingredient price changes the menu price immediately, and detail matches the list', async () => {
  const before = (await get('/api/pizzas')).json.data.pizzas.find((p) => p.name === 'Margherita');
  await InventoryItem.updateOne({ category: 'cheese', name: 'Mozzarella' }, { $inc: { price: 25 } });
  const after = (await get('/api/pizzas')).json.data.pizzas.find((p) => p.name === 'Margherita');
  assert.equal(after.price, before.price + 25);
  assert.equal((await get(`/api/pizzas/${before.id}`)).json.data.pizza.price, after.price);
  await InventoryItem.updateOne({ category: 'cheese', name: 'Mozzarella' }, { $inc: { price: -25 } });
});

test('a preset with an inactive ingredient is hidden (list and detail) instead of showing a wrong price', async () => {
  const margherita = await Pizza.findOne({ name: 'Margherita' });
  await InventoryItem.updateOne({ category: 'vegetable', name: 'Tomato' }, { active: false });
  assert.ok(!(await get('/api/pizzas')).json.data.pizzas.some((p) => p.name === 'Margherita'));
  assert.equal((await get(`/api/pizzas/${margherita.id}`)).status, 404);
  await InventoryItem.updateOne({ category: 'vegetable', name: 'Tomato' }, { active: true });
  assert.ok((await get('/api/pizzas')).json.data.pizzas.some((p) => p.name === 'Margherita'));
});

test('a preset without valid defaults (none, or two cheeses) is hidden', async () => {
  const pick = (category, name) => InventoryItem.findOne({ category, name });
  const [classic, bbq, mozzarella, cheddar] = await Promise.all([
    pick('base', 'Classic'), pick('sauce', 'BBQ'), pick('cheese', 'Mozzarella'), pick('cheese', 'Cheddar'),
  ]);
  const image = 'https://images.unsplash.com/photo-test';
  const broken = await Pizza.create({ name: 'Broken Pie', description: 'x', image, defaultIngredients: [] });
  const doubled = await Pizza.create({
    name: 'Double Trouble', description: 'x', image, defaultIngredients: [classic._id, bbq._id, mozzarella._id, cheddar._id],
  });
  const names = (await get('/api/pizzas')).json.data.pizzas.map((p) => p.name);
  assert.ok(!names.includes('Broken Pie') && !names.includes('Double Trouble'));
  await Pizza.deleteMany({ _id: { $in: [broken._id, doubled._id] } });
});

test('seed never overwrites defaults an admin has changed', async () => {
  const vegan = await InventoryItem.findOne({ category: 'vegetable', name: 'Onion' });
  const margherita = await Pizza.findOne({ name: 'Margherita' });
  const changed = [...margherita.defaultIngredients, vegan._id];
  await Pizza.updateOne({ _id: margherita._id }, { defaultIngredients: changed });
  seed();
  const after = await Pizza.findOne({ name: 'Margherita' });
  assert.deepEqual(after.defaultIngredients.map(String), changed.map(String));
});

test('seed upgrades a database made by the older seed, without touching admin edits', async () => {
  await Pizza.deleteMany({});
  await InventoryItem.deleteMany({});
  await InventoryItem.insertMany(ingredients.filter((i) => i.name !== 'Paneer').map(legacyIngredient));
  await InventoryItem.updateOne({ category: 'base', name: 'Classic' }, { price: 123 }); // an admin's own price
  const pepperoni = await Pizza.collection.insertOne(legacyPizza(OLD_PEPPERONI.name, OLD_PEPPERONI.description, OLD_PEPPERONI.image));
  await Pizza.collection.insertMany([
    legacyPizza('Margherita', OLD_MARGHERITA, presetNamed('Margherita').image),
    legacyPizza('Four Cheese', 'My own words about this pizza.', presetNamed('Four Cheese').image),
  ]);

  const out = seed();
  // 21 old ingredients; Classic Tomato kept its price; the admin-edited Classic is left alone.
  assert.match(out, /Upgraded from an older seed: 19 ingredient prices/);

  const price = async (category, name) => (await InventoryItem.findOne({ category, name })).price;
  assert.equal(await price('base', 'Classic'), 123);
  assert.equal(await price('base', 'Thin Crust'), priceOf('base', 'Thin Crust'));
  assert.equal(await price('cheese', 'Mozzarella'), priceOf('cheese', 'Mozzarella'));
  assert.equal(await price('vegetable', 'Paneer'), priceOf('vegetable', 'Paneer'));

  // The pepperoni preset became "Mushroom Melt" in place (same record, new photo, defaults).
  const melt = await Pizza.findOne({ name: 'Mushroom Melt' });
  assert.equal(String(melt._id), String(pepperoni.insertedId));
  assert.equal(await Pizza.countDocuments({ name: 'Pepperoni Feast' }), 0);
  assert.equal(melt.image, presetNamed('Mushroom Melt').image);
  assert.equal(melt.defaultIngredients.length, presetNamed('Mushroom Melt').defaults.length);

  const margherita = await Pizza.findOne({ name: 'Margherita' });
  assert.equal(margherita.description, presetNamed('Margherita').description);
  assert.equal(margherita.defaultIngredients.length, presetNamed('Margherita').defaults.length);

  const fourCheese = await Pizza.findOne({ name: 'Four Cheese' });
  assert.equal(fourCheese.description, 'My own words about this pizza.'); // the admin's text survives
  assert.equal(fourCheese.defaultIngredients.length, presetNamed('Four Cheese').defaults.length);

  assert.equal(await Pizza.countDocuments(), pizzas.length);
  assert.equal(await Pizza.collection.countDocuments({ price: { $exists: true } }), 0); // stale stored price removed

  assert.match(seed(), /Upgraded from an older seed: 0 ingredient prices, 0 pizza updates/);
  assert.equal((await get('/api/pizzas')).json.data.pizzas.length, pizzas.length);
});

test('an admin-edited old pepperoni preset is left alone and hidden; Mushroom Melt is added beside it', async () => {
  await Pizza.deleteMany({});
  await InventoryItem.deleteMany({});
  await InventoryItem.insertMany(ingredients.map(legacyIngredient));
  await Pizza.collection.insertOne(legacyPizza(OLD_PEPPERONI.name, 'Our edited pepperoni text.', OLD_PEPPERONI.image));
  seed();
  const pepperoni = await Pizza.findOne({ name: 'Pepperoni Feast' });
  assert.equal(pepperoni.description, 'Our edited pepperoni text.');
  assert.equal(pepperoni.defaultIngredients.length, 0);
  const names = (await get('/api/pizzas')).json.data.pizzas.map((p) => p.name);
  assert.ok(!names.includes('Pepperoni Feast')); // no valid ingredients, so it cannot show a price
  assert.ok(names.includes('Mushroom Melt'));
  assert.equal(names.length, pizzas.length);
});
