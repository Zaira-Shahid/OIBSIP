const mongoose = require('mongoose');

// A preset pizza shown on the dashboard menu. It is a starting point for the builder: `defaultIngredients` are
// InventoryItem ids (one base, one sauce, one cheese, any vegetables). It has no price of its own: the menu price is
// the sum of the current prices of those ingredients, computed by the server (see presetService).
const pizzaSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, trim: true, maxlength: 300 },
    image: { type: String, required: true, trim: true },
    defaultIngredients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'InventoryItem' }],
    available: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('Pizza', pizzaSchema);
