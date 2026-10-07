const mongoose = require('mongoose');

const ORDER_STATUSES = ['ORDER_RECEIVED', 'IN_KITCHEN', 'SENT_TO_DELIVERY'];
const PAYMENT_STATUSES = ['PENDING', 'PAID', 'FAILED'];
// Orders that never got paid are deleted after 24 hours. The TTL index only covers PENDING and FAILED orders (partial
// filter), so a PAID order can never be removed, and an order leaves the index the moment it is marked PAID.
const UNPAID_TTL_SECONDS = 24 * 60 * 60;
const UNPAID_FILTER = { paymentStatus: { $in: ['PENDING', 'FAILED'] } };

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
    paymentReference: { type: String }, // Razorpay payment id, set when the signature is verified
    razorpayOrderId: { type: String }, // latest gateway order; replaced on every payment retry
    paidAt: { type: Date },
    // Payment succeeded but stock could not be taken afterwards (rare race). Needs a manual refund.
    needsRefund: { type: Boolean, default: false },
    refundedAt: { type: Date }, // set when an admin records that the manual refund was made
    stockDeducted: { type: Boolean, default: false },
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
        delete ret.stockDeducted; // internal bookkeeping for idempotency
        return ret;
      },
    },
  }
);

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ createdAt: 1 }, { expireAfterSeconds: UNPAID_TTL_SECONDS, partialFilterExpression: UNPAID_FILTER });

module.exports = mongoose.model('Order', orderSchema);
module.exports.ORDER_STATUSES = ORDER_STATUSES;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
module.exports.UNPAID_TTL_SECONDS = UNPAID_TTL_SECONDS;
module.exports.UNPAID_FILTER = UNPAID_FILTER;
