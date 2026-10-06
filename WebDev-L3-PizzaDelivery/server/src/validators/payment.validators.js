const { z } = require('zod');

const text = (label) => z.string({ error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(100);

const verifyPaymentSchema = z.strictObject({
  orderId: text('Order id'),
  razorpay_order_id: text('Razorpay order id'),
  razorpay_payment_id: text('Razorpay payment id'),
  razorpay_signature: text('Razorpay signature'),
});

module.exports = { verifyPaymentSchema };
