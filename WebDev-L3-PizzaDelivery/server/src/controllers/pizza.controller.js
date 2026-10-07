const mongoose = require('mongoose');
const Pizza = require('../models/Pizza');
const InventoryItem = require('../models/InventoryItem');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { priceCustomPizza } = require('../services/pricingService');
const { presentPizza } = require('../services/presetService');

const { CATEGORIES } = InventoryItem;

// Presets come with a server-computed price (the sum of their ingredients) and the selection the builder pre-fills.
// A preset whose ingredients are missing or inactive is left out rather than shown with a wrong price.
exports.listPizzas = asyncHandler(async (req, res) => {
  const pizzas = await Pizza.find({ available: true }).populate('defaultIngredients');
  const presented = pizzas
    .map(presentPizza)
    .filter(Boolean)
    .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
  res.json({ success: true, data: { pizzas: presented } });
});

exports.getPizza = asyncHandler(async (req, res) => {
  const pizza = mongoose.isValidObjectId(req.params.id)
    ? await Pizza.findOne({ _id: req.params.id, available: true }).populate('defaultIngredients')
    : null;
  const presented = pizza && presentPizza(pizza);
  if (!presented) throw new ApiError(404, 'Pizza not found.');
  res.json({ success: true, data: { pizza: presented } });
});

// Server-side price for a custom pizza. Nothing is stored; the client total is only ever a preview.
exports.priceCustomPizza = asyncHandler(async (req, res) => {
  const data = await priceCustomPizza(req.body);
  res.json({ success: true, data });
});

// Active builder ingredients grouped by category. Customers only see availability, never stock numbers.
exports.listIngredients = asyncHandler(async (req, res) => {
  const items = await InventoryItem.find({ active: true }).sort({ name: 1 });
  const ingredients = Object.fromEntries(CATEGORIES.map((c) => [c, []]));
  for (const item of items) {
    ingredients[item.category].push({
      id: item._id,
      name: item.name,
      price: item.price,
      available: item.stock > 0,
    });
  }
  res.json({ success: true, data: { ingredients } });
});
