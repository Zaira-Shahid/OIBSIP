const mongoose = require('mongoose');
const InventoryItem = require('../models/InventoryItem');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { MAX_STOCK, toAdminItem, categoryRank } = require('../services/inventoryService');

// Every item (including inactive ones), grouped by category order then name. The summary counts active items only,
// because inactive items are not sold and never trigger alerts.
exports.listInventory = asyncHandler(async (req, res) => {
  const docs = await InventoryItem.find({});
  const items = docs
    .map(toAdminItem)
    .sort((a, b) => categoryRank(a.category) - categoryRank(b.category) || a.name.localeCompare(b.name));
  const active = items.filter((i) => i.active);
  res.json({
    success: true,
    data: {
      items,
      summary: {
        total: active.length,
        low: active.filter((i) => i.status === 'LOW').length,
        outOfStock: active.filter((i) => i.status === 'OUT_OF_STOCK').length,
      },
    },
  });
});

// One atomic update. The stock condition is part of the filter, so a concurrent order (or another admin)
// can never be overwritten, and stock can never leave 0..MAX_STOCK.
exports.updateInventoryItem = asyncHandler(async (req, res) => {
  const { stock, expectedStock, adjustBy, lowStockThreshold, active } = req.body;
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Inventory item not found.');

  const filter = { _id: req.params.id };
  const update = { $set: {} };
  if (stock !== undefined) {
    filter.stock = expectedStock;
    update.$set.stock = stock;
  }
  if (adjustBy !== undefined) {
    filter.stock = { $gte: Math.max(0, -adjustBy), $lte: MAX_STOCK - Math.max(0, adjustBy) };
    update.$inc = { stock: adjustBy };
  }
  if (lowStockThreshold !== undefined) update.$set.lowStockThreshold = lowStockThreshold;
  if (active !== undefined) update.$set.active = active;
  if (Object.keys(update.$set).length === 0) delete update.$set;

  const updated = await InventoryItem.findOneAndUpdate(filter, update, { returnDocument: 'after', runValidators: true });
  if (updated) return res.json({ success: true, data: { item: toAdminItem(updated) } });

  // Nothing matched: either the item does not exist, or its stock is not what the admin expected.
  const current = await InventoryItem.findById(req.params.id);
  if (!current) throw new ApiError(404, 'Inventory item not found.');
  const message =
    adjustBy !== undefined
      ? adjustBy < 0
        ? `Cannot remove ${-adjustBy}: only ${current.stock} in stock.`
        : `Stock cannot go above ${MAX_STOCK}.`
      : `Stock for ${current.name} changed to ${current.stock} while you were editing. Nothing was saved; review and try again.`;
  res.status(409).json({
    success: false,
    message,
    code: adjustBy !== undefined ? 'ADJUSTMENT_REJECTED' : 'STOCK_CHANGED',
    data: { item: toAdminItem(current) }, // lets the screen refresh just this row
  });
});
