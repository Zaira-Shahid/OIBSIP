const express = require('express');

const router = express.Router();

router.use('/health', require('./health.routes'));

module.exports = router;
