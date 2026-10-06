const express = require('express');
const c = require('../controllers/order.controller');
const { authenticateUser } = require('../middleware/auth');
const { orderLimiter } = require('../middleware/rateLimiters');
const { validate } = require('../validators/auth.validators');
const { customPizzaSchema } = require('../validators/pizza.validators');

const router = express.Router();

router.use(authenticateUser);
router.post('/', orderLimiter, validate(customPizzaSchema), c.createOrder);
router.get('/', c.listOrders);
router.get('/:id', c.getOrder);

module.exports = router;
