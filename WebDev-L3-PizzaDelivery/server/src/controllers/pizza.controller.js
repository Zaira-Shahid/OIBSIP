const mongoose = require('mongoose');
const Pizza = require('../models/Pizza');
const InventoryItem = require('../models/InventoryItem');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const { CATEGORIES } = InventoryItem;

exports.listPizzas = asyncHandler(async (req, res) => {
  const pizzas = await Pizza.find({ available: true }).sort({ price: 1, name: 1 });
  res.json({ success: true, data: { pizzas } });
});

exports.getPizza = asyncHandler(async (req, res) => {
  const pizza = mongoose.isValidObjectId(req.params.id)
    ? await Pizza.findOne({ _id: req.params.id, available: true })
    : null;
  if (!pizza) throw new ApiError(404, 'Pizza not found.');
  res.json({ success: true, data: { pizza } });
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
