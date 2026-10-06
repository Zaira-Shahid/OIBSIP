const express = require('express');

const router = express.Router();

router.use('/health', require('./health.routes'));
router.use('/auth', require('./auth.routes'));
router.use('/pizzas', require('./pizza.routes'));
router.use('/ingredients', require('./ingredient.routes'));
router.use('/orders', require('./order.routes'));

module.exports = router;
