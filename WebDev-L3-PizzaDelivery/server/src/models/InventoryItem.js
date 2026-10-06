const mongoose = require('mongoose');

const CATEGORIES = ['base', 'sauce', 'cheese', 'vegetable'];

// Single source of truth for builder ingredients AND their stock (managed in Module 9).
const inventoryItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    category: { type: String, required: true, enum: CATEGORIES },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, required: true, min: 0, default: 20 },
    unit: { type: String, required: true, trim: true, default: 'pcs' },
    active: { type: Boolean, default: true },
    // Worst state an alert email was already sent for (LOW or OUT_OF_STOCK); unset when none is outstanding.
    // Prevents repeat emails while the state is unchanged; cleared again once the item is restocked to >= threshold.
    lowStockAlertState: { type: String, enum: ['LOW', 'OUT_OF_STOCK'] },
    lowStockAlertedAt: { type: Date },
  },
  { timestamps: true }
);

inventoryItemSchema.index({ category: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
module.exports.CATEGORIES = CATEGORIES;
