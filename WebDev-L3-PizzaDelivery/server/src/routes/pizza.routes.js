const express = require('express');
const c = require('../controllers/pizza.controller');
const { validate } = require('../validators/auth.validators');
const { customPizzaSchema } = require('../validators/pizza.validators');

const router = express.Router();

router.get('/', c.listPizzas);
router.post('/price', validate(customPizzaSchema), c.priceCustomPizza);
router.get('/:id', c.getPizza);

module.exports = router;
