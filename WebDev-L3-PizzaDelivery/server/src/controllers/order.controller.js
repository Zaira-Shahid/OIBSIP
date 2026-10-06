const mongoose = require('mongoose');
const Order = require('../models/Order');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { priceCustomPizza } = require('../services/pricingService');

// Only paid-and-confirmed orders (orderStatus set) are visible to the customer.
const visibleTo = (userId) => ({ userId, orderStatus: { $exists: true, $ne: null } });
const line = (item) => ({ ingredientId: item.id, name: item.name, price: item.price });

// Creates an UNPAID order. Amount is recomputed from database prices; stock is checked but
// never reserved or decremented here (that happens only after payment verification).
exports.createOrder = asyncHandler(async (req, res) => {
  const priced = await priceCustomPizza(req.body);
  const of = (category) => priced.items.filter((i) => i.category === category);

  const order = await Order.create({
    userId: req.user._id,
    customPizza: {
      base: line(of('base')[0]),
      sauce: line(of('sauce')[0]),
      cheese: line(of('cheese')[0]),
      vegetables: of('vegetable').map(line),
    },
    unitPrice: priced.unitPrice,
    quantity: priced.quantity,
    amount: priced.total,
  });
  res.status(201).json({ success: true, data: { order } });
});

exports.listOrders = asyncHandler(async (req, res) => {
  const orders = await Order.find(visibleTo(req.user._id)).sort({ createdAt: -1 });
  res.json({ success: true, data: { orders } });
});

exports.getOrder = asyncHandler(async (req, res) => {
  const order = mongoose.isValidObjectId(req.params.id)
    ? await Order.findOne({ _id: req.params.id, ...visibleTo(req.user._id) })
    : null;
  if (!order) throw new ApiError(404, 'Order not found.');
  res.json({ success: true, data: { order } });
});
