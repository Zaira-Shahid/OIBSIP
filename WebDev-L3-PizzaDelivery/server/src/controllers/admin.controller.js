const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../utils/jwt');
const { DUMMY_HASH } = require('../utils/passwords');
const User = require('../models/User');
const Order = require('../models/Order');

const { ORDER_STATUSES } = Order;
const INVALID_LOGIN = 'Invalid email or password.';
const MAX_ORDERS = 200;
// The only legal moves: each status can advance to exactly one next status.
const NEXT_STATUS = { ORDER_RECEIVED: 'IN_KITCHEN', IN_KITCHEN: 'SENT_TO_DELIVERY' };

// Separate from /api/auth/login: only admin accounts get in here. Customers get the same generic 401 as a
// wrong password, so nobody can probe which emails belong to admins. Email verification is not required.
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordOk = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !passwordOk || user.role !== 'admin') throw new ApiError(401, INVALID_LOGIN);
  res.json({ success: true, data: { token: signToken(user), user } });
});

exports.me = (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};

// Confirmed orders only (orderStatus set): unpaid orders and paid-but-needs-refund orders never appear.
exports.listOrders = asyncHandler(async (req, res) => {
  const docs = await Order.find({ orderStatus: { $in: ORDER_STATUSES } })
    .sort({ createdAt: -1 })
    .limit(MAX_ORDERS)
    .populate({ path: 'userId', select: 'name email' });
  const orders = docs.map((doc) => ({
    ...doc.toJSON(),
    customer: doc.userId ? { name: doc.userId.name, email: doc.userId.email } : null,
  }));
  res.json({ success: true, data: { orders } });
});

// Forward only: ORDER_RECEIVED -> IN_KITCHEN -> SENT_TO_DELIVERY. No skips, no going back, no repeats.
exports.updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = mongoose.isValidObjectId(req.params.id) ? await Order.findById(req.params.id) : null;
  if (!order) throw new ApiError(404, 'Order not found.');

  if (!order.orderStatus) {
    throw new ApiError(409, 'This order is not confirmed (unpaid or awaiting refund), so its status cannot change.', 'ORDER_NOT_CONFIRMED');
  }
  if (NEXT_STATUS[order.orderStatus] !== status) {
    const allowed = NEXT_STATUS[order.orderStatus];
    throw new ApiError(
      409,
      allowed
        ? `An order that is ${order.orderStatus} can only move to ${allowed}.`
        : `An order that is ${order.orderStatus} cannot change status any more.`,
      'INVALID_TRANSITION'
    );
  }

  // The current status is part of the filter, so two admins clicking at once cannot both apply.
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, orderStatus: order.orderStatus },
    { orderStatus: status },
    { returnDocument: 'after' }
  ).populate({ path: 'userId', select: 'name email' });
  if (!updated) throw new ApiError(409, 'This order was just updated by someone else. Please refresh.', 'STATUS_CONFLICT');

  res.json({
    success: true,
    data: { order: { ...updated.toJSON(), customer: updated.userId && { name: updated.userId.name, email: updated.userId.email } } },
  });
});

const withCustomer = (doc) => ({
  ...doc.toJSON(),
  customer: doc.userId ? { name: doc.userId.name, email: doc.userId.email } : null,
});

// Payments that went through but could not be turned into a confirmed order (the ingredients ran out in the
// moment between paying and confirming). These need a manual refund in the Razorpay dashboard; the payment id
// is shown so the payment can be found there.
exports.listRefunds = asyncHandler(async (req, res) => {
  const docs = await Order.find({ paymentStatus: 'PAID', needsRefund: true, orderStatus: { $exists: false } })
    .sort({ paidAt: -1 })
    .limit(MAX_ORDERS)
    .populate({ path: 'userId', select: 'name email' });
  res.json({ success: true, data: { orders: docs.map(withCustomer) } });
});

// Records that the refund was made (in the Razorpay dashboard), which takes the order off the list. Only an order that
// is still waiting for its refund can be marked, and only once.
exports.markRefunded = asyncHandler(async (req, res) => {
  const filter = { _id: req.params.id, paymentStatus: 'PAID', needsRefund: true, orderStatus: { $exists: false } };
  const updated = mongoose.isValidObjectId(req.params.id)
    ? await Order.findOneAndUpdate(filter, { needsRefund: false, refundedAt: new Date() }, { returnDocument: 'after' }).populate({
        path: 'userId',
        select: 'name email',
      })
    : null;
  if (updated) return res.json({ success: true, data: { order: withCustomer(updated) } });

  const exists = mongoose.isValidObjectId(req.params.id) && (await Order.exists({ _id: req.params.id }));
  if (!exists) throw new ApiError(404, 'Order not found.');
  throw new ApiError(409, 'This order is not waiting for a refund.', 'NOT_AWAITING_REFUND');
});
