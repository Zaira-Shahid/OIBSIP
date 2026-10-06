const express = require('express');
const c = require('../controllers/payment.controller');
const { authenticateUser } = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimiters');
const { validate } = require('../validators/auth.validators');
const { verifyPaymentSchema } = require('../validators/payment.validators');

const router = express.Router();

router.post('/verify', authenticateUser, paymentLimiter, validate(verifyPaymentSchema), c.verifyPayment);

module.exports = router;
