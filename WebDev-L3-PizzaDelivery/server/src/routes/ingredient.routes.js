const express = require('express');
const c = require('../controllers/pizza.controller');

const router = express.Router();

router.get('/', c.listIngredients);

module.exports = router;
