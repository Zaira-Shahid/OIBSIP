const mongoose = require('mongoose');

const ORDER_STATUSES = ['ORDER_RECEIVED', 'IN_KITCHEN', 'SENT_TO_DELIVERY'];
const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED'];

// What the customer chose, copied at order time so history never depends on current inventory names/prices.
const lineSchema = new mongoose.Schema(
  {
    ingredientId: { type: mongoose.Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customPizza: {
      base: { type: lineSchema, required: true },
      sauce: { type: lineSchema, required: true },
      cheese: { type: lineSchema, required: true },
      vegetables: { type: [lineSchema], default: [] },
    },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, max: 5 },
    amount: { type: Number, required: true, min: 0 },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'PENDING' },
    paymentProvider: { type: String, default: 'razorpay' },
    paymentReference: { type: String },
    // Deliberately unset until payment is verified: unpaid orders are not "received" and never appear in tracking.
    orderStatus: { type: String, enum: ORDER_STATUSES },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.userId;
        return ret;
      },
    },
  }
);

orderSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Order', orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
