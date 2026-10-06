const express = require('express');
const c = require('../controllers/pizza.controller');

const router = express.Router();

router.get('/', c.listPizzas);
router.get('/:id', c.getPizza);

module.exports = router;
