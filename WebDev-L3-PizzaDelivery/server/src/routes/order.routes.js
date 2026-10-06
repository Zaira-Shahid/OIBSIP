const express = require('express');
const c = require('../controllers/order.controller');
const payments = require('../controllers/payment.controller');
const { authenticateUser } = require('../middleware/auth');
const { orderLimiter, paymentLimiter } = require('../middleware/rateLimiters');
const { validate } = require('../validators/auth.validators');
const { customPizzaSchema } = require('../validators/pizza.validators');

const router = express.Router();

router.use(authenticateUser);
router.post('/', orderLimiter, validate(customPizzaSchema), c.createOrder);
router.get('/', c.listOrders);
router.get('/:id', c.getOrder);
router.post('/:id/payment', paymentLimiter, payments.startPayment);

module.exports = router;
