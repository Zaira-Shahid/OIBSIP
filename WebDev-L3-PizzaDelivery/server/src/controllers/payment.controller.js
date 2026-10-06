const mongoose = require('mongoose');
const Order = require('../models/Order');
const InventoryItem = require('../models/InventoryItem');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { env } = require('../config/env');
const { priceCustomPizza } = require('../services/pricingService');
const { assertConfigured, createGatewayOrder, isValidSignature } = require('../services/paymentService');

const NEEDS_REFUND_MESSAGE =
  'Your payment went through, but one of the ingredients ran out before we could confirm your order. ' +
  'Your order was not placed and your payment will be refunded.';

class StockShortage extends Error {}

const findOwnedOrder = async (req, id) => {
  const order = mongoose.isValidObjectId(id) ? await Order.findOne({ _id: id, userId: req.user._id }) : null;
  if (!order) throw new ApiError(404, 'Order not found.');
  return order;
};

const lines = ({ customPizza }) => [customPizza.base, customPizza.sauce, customPizza.cheese, ...customPizza.vegetables];

// Takes `quantity` of every ingredient, each with an atomic `stock >= quantity` condition so stock can never go
// negative. If any ingredient is short, the ones already taken are put back: no partial decrement.
async function decrementStock(order) {
  const taken = [];
  try {
    for (const line of lines(order)) {
      const res = await InventoryItem.updateOne(
        { _id: line.ingredientId, stock: { $gte: order.quantity } },
        { $inc: { stock: -order.quantity } }
      );
      if (res.modifiedCount !== 1) throw new StockShortage(line.name);
      taken.push(line);
    }
  } catch (err) {
    await Promise.all(
      taken.map((line) =>
        InventoryItem.updateOne({ _id: line.ingredientId }, { $inc: { stock: order.quantity } }).catch((e) =>
          console.error(`Stock rollback failed for ingredient ${line.ingredientId}:`, e.message)
        )
      )
    );
    throw err;
  }
}

// Answers a verify call for an order that is already PAID, without touching stock again.
const respondForPaidOrder = (res, order) => {
  if (order.orderStatus) return res.json({ success: true, data: { order } });
  if (order.needsRefund) throw new ApiError(409, NEEDS_REFUND_MESSAGE, 'PAID_NOT_CONFIRMED');
  throw new ApiError(409, 'Your payment is being confirmed. Please check My orders in a moment.', 'PAYMENT_PROCESSING');
};

// Starts (or restarts) payment for an unpaid order. Every call makes a fresh Razorpay order, so closing the
// checkout popup never blocks a retry. The amount comes from the stored order (database prices), in paise.
exports.startPayment = asyncHandler(async (req, res) => {
  const order = await findOwnedOrder(req, req.params.id);
  if (order.paymentStatus === 'PAID' || order.orderStatus) {
    throw new ApiError(409, 'This order has already been paid.', 'ALREADY_PAID');
  }
  assertConfigured();

  // Stock and prices are checked again now; nothing is reserved.
  const { base, sauce, cheese, vegetables } = order.customPizza;
  const priced = await priceCustomPizza({
    base: String(base.ingredientId),
    sauce: String(sauce.ingredientId),
    cheese: String(cheese.ingredientId),
    vegetables: vegetables.map((v) => String(v.ingredientId)),
    quantity: order.quantity,
  });
  if (priced.total !== order.amount) {
    throw new ApiError(409, 'Prices have changed since you built this pizza. Please build it again.', 'PRICE_CHANGED');
  }

  const amount = Math.round(order.amount * 100);
  const gatewayOrder = await createGatewayOrder({ amount, receipt: String(order._id) });
  await Order.updateOne({ _id: order._id, paymentStatus: 'PENDING' }, { razorpayOrderId: gatewayOrder.id });

  res.json({
    success: true,
    data: {
      orderId: order.id,
      payment: { keyId: env.razorpay.keyId, razorpayOrderId: gatewayOrder.id, amount, currency: 'INR' },
    },
  });
});

// The backend is the source of truth: an order is only confirmed after the signature checks out AND the stock is taken.
exports.verifyPayment = asyncHandler(async (req, res) => {
  assertConfigured();
  const { orderId, razorpay_order_id: razorpayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body;
  const order = await findOwnedOrder(req, orderId);

  // Repeat call (double click, retried request): report the current state, never decrement twice.
  if (order.paymentStatus === 'PAID') return respondForPaidOrder(res, order);

  if (!order.razorpayOrderId || order.razorpayOrderId !== razorpayOrderId) {
    throw new ApiError(400, 'This payment does not match your order.', 'PAYMENT_MISMATCH');
  }
  if (!isValidSignature({ razorpayOrderId, paymentId, signature })) {
    throw new ApiError(400, 'We could not verify this payment. Your order was not confirmed.', 'INVALID_SIGNATURE');
  }

  // Exactly one request can move PENDING -> PAID; only that request touches stock.
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: 'PENDING' },
    { $set: { paymentStatus: 'PAID', paymentReference: paymentId, paidAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!claimed) return respondForPaidOrder(res, await Order.findById(order._id));

  try {
    await decrementStock(claimed);
  } catch (err) {
    if (!(err instanceof StockShortage)) console.error('Stock decrement failed after payment:', err.message);
    await Order.updateOne({ _id: claimed._id }, { needsRefund: true });
    throw new ApiError(409, NEEDS_REFUND_MESSAGE, 'PAID_NOT_CONFIRMED');
  }

  const confirmed = await Order.findByIdAndUpdate(
    claimed._id,
    { orderStatus: 'ORDER_RECEIVED', stockDeducted: true },
    { returnDocument: 'after' }
  );
  res.json({ success: true, data: { order: confirmed } });
});
