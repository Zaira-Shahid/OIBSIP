// Seeds ingredients (InventoryItem) and preset pizzas. Safe to run repeatedly, and safe on a database seeded by an
// older version: existing records are only ever upgraded while they still hold exactly the value an older seed wrote,
// so later admin edits (stock, prices, descriptions, defaults) always survive a re-run.
const mongoose = require('mongoose');
const { env } = require('../config/env');
const { connectDB } = require('../config/db');
const InventoryItem = require('../models/InventoryItem');
const Pizza = require('../models/Pizza');
const { ingredients, pizzas } = require('../data/menu');

const without = (obj, ...keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));

async function insertMissing(Model, docs, keyOf) {
  const result = await Model.bulkWrite(
    docs.map((doc) => ({
      updateOne: { filter: keyOf(doc), update: { $setOnInsert: doc }, upsert: true },
    }))
  );
  return result.upsertedCount;
}

// Runs each update and returns how many documents actually changed.
async function applyUpdates(Model, updates) {
  if (updates.length === 0) return 0;
  const result = await Model.bulkWrite(updates.map((u) => ({ updateOne: u })));
  return result.modifiedCount;
}

async function seedMenu() {
  if (!env.mongodbUri) throw new Error('MONGODB_URI is not set.');
  await connectDB();

  const ing = await insertMissing(
    InventoryItem,
    ingredients.map((i) => without(i, 'legacyPrice')),
    ({ category, name }) => ({ category, name })
  );
  // Older seeds used lower prices; move a record to the current price only if it still has the old seeded one.
  const repriced = await applyUpdates(
    InventoryItem,
    ingredients
      .filter((i) => i.legacyPrice !== undefined && i.legacyPrice !== i.price)
      .map((i) => ({ filter: { category: i.category, name: i.name, price: i.legacyPrice }, update: { $set: { price: i.price } } }))
  );

  const idByKey = new Map((await InventoryItem.find({})).map((i) => [`${i.category}:${i.name}`, i._id]));
  const defaultsOf = (preset) =>
    preset.defaults.map(([category, name]) => {
      const id = idByKey.get(`${category}:${name}`);
      if (!id) throw new Error(`Preset "${preset.name}" uses an unknown ingredient: ${category} / ${name}.`);
      return id;
    });

  // An old preset that no longer fits the builder (e.g. one using an ingredient the builder does not have) is
  // renamed in place, but only while it still has the exact name and description the old seed wrote.
  let upgraded = 0;
  for (const preset of pizzas.filter((p) => p.replaces)) {
    if (await Pizza.exists({ name: preset.name })) continue;
    const { replaces } = preset;
    const renamed = await Pizza.updateOne(
      { name: replaces.name, description: replaces.description },
      { $set: { name: preset.name, description: preset.description } }
    );
    if (renamed.modifiedCount === 1) {
      await Pizza.updateOne({ name: preset.name, image: replaces.image }, { $set: { image: preset.image } });
      upgraded += 1;
    }
  }

  const piz = await insertMissing(
    Pizza,
    pizzas.map((p) => ({ name: p.name, description: p.description, image: p.image, defaultIngredients: defaultsOf(p) })),
    ({ name }) => ({ name })
  );
  upgraded += await applyUpdates(Pizza, [
    // Records from before presets had ingredients: give them their defaults (never touches non-empty defaults).
    ...pizzas.map((p) => ({
      filter: { name: p.name, $or: [{ defaultIngredients: { $exists: false } }, { defaultIngredients: { $size: 0 } }] },
      update: { $set: { defaultIngredients: defaultsOf(p) } },
    })),
    // Descriptions that claimed things the builder cannot make: refreshed only if still the old seeded text.
    ...pizzas
      .filter((p) => p.legacyDescription)
      .map((p) => ({ filter: { name: p.name, description: p.legacyDescription }, update: { $set: { description: p.description } } })),
  ]);
  // The menu price is now computed from a preset's ingredients; drop the old stored value.
  await Pizza.collection.updateMany({ price: { $exists: true } }, { $unset: { price: 1 } });

  console.log(`Ingredients: ${ing} added, ${ingredients.length - ing} already present.`);
  console.log(`Pizzas: ${piz} added, ${pizzas.length - piz} already present.`);
  console.log(`Upgraded from an older seed: ${repriced} ingredient prices, ${upgraded} pizza updates.`);
}

seedMenu()
  .catch((err) => {
    console.error(`Seed failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
