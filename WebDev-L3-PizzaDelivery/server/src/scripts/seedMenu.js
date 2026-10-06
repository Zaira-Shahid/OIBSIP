// Seeds ingredients (InventoryItem) and preset pizzas. Safe to run repeatedly:
// existing records are never touched, so later admin edits (stock, prices) survive a re-run.
const mongoose = require('mongoose');
const { env } = require('../config/env');
const { connectDB } = require('../config/db');
const InventoryItem = require('../models/InventoryItem');
const Pizza = require('../models/Pizza');
const { ingredients, pizzas } = require('../data/menu');

async function insertMissing(Model, docs, keyOf) {
  const result = await Model.bulkWrite(
    docs.map((doc) => ({
      updateOne: { filter: keyOf(doc), update: { $setOnInsert: doc }, upsert: true },
    }))
  );
  return result.upsertedCount;
}

async function seedMenu() {
  if (!env.mongodbUri) throw new Error('MONGODB_URI is not set.');
  await connectDB();

  const ing = await insertMissing(InventoryItem, ingredients, ({ category, name }) => ({ category, name }));
  const piz = await insertMissing(Pizza, pizzas, ({ name }) => ({ name }));
  console.log(`Ingredients: ${ing} added, ${ingredients.length - ing} already present.`);
  console.log(`Pizzas: ${piz} added, ${pizzas.length - piz} already present.`);
}

seedMenu()
  .catch((err) => {
    console.error(`Seed failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
