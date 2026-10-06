const mongoose = require('mongoose');
const InventoryItem = require('../models/InventoryItem');
const ApiError = require('../utils/ApiError');

const MAX_VEGETABLES = 20;

// Builds a priced custom pizza from ingredient ids. Prices always come from the database,
// never from the client. Rules: exactly one base, one sauce and one cheese; vegetables are optional.
// Order creation (Modules 6/7) must call this again and use the returned total.
async function priceCustomPizza({ base, sauce, cheese, vegetables = [] }) {
  const slots = [
    ['base', base],
    ['sauce', sauce],
    ['cheese', cheese],
    ...vegetables.map((id) => ['vegetable', id]),
  ];

  const ids = slots.map(([, id]) => id);
  if (ids.some((id) => !mongoose.isValidObjectId(id))) throw new ApiError(400, 'Invalid ingredient selection.');
  if (new Set(ids).size !== ids.length) throw new ApiError(400, 'Each ingredient can only be chosen once.');
  if (vegetables.length > MAX_VEGETABLES) throw new ApiError(400, 'Too many vegetables selected.');

  const found = await InventoryItem.find({ _id: { $in: ids }, active: true });
  const byId = new Map(found.map((item) => [item.id, item]));

  const items = slots.map(([category, id]) => {
    const item = byId.get(id);
    if (!item || item.category !== category) throw new ApiError(400, `Invalid ${category} selection.`);
    if (item.stock <= 0) throw new ApiError(409, `${item.name} is currently out of stock.`, 'OUT_OF_STOCK');
    return item;
  });

  return {
    items: items.map((item) => ({ id: item.id, name: item.name, category: item.category, price: item.price })),
    total: items.reduce((sum, item) => sum + item.price, 0),
  };
}

module.exports = { priceCustomPizza, MAX_VEGETABLES };
