const InventoryItem = require('../models/InventoryItem');

const MAX_STOCK = 1000000;

// Low means strictly below the item's own threshold (spec section 13), so stock equal to the threshold is still OK.
// The same rule is meant to be reused by the low-stock scheduler.
const inventoryStatus = ({ stock, lowStockThreshold }) => {
  if (stock <= 0) return 'OUT_OF_STOCK';
  return stock < lowStockThreshold ? 'LOW' : 'OK';
};

const toAdminItem = (item) => ({
  id: item.id,
  name: item.name,
  category: item.category,
  stock: item.stock,
  unit: item.unit,
  lowStockThreshold: item.lowStockThreshold,
  active: item.active,
  status: inventoryStatus(item),
  updatedAt: item.updatedAt,
});

const categoryRank = (category) => InventoryItem.CATEGORIES.indexOf(category);

module.exports = { MAX_STOCK, inventoryStatus, toAdminItem, categoryRank };
