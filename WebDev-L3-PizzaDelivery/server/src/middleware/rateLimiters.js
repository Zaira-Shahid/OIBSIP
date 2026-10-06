const { rateLimit } = require('express-rate-limit');
const { env } = require('../config/env');

// Limits are skipped when NODE_ENV=test so automated tests are never blocked.
const createLimiter = (max) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => env.nodeEnv === 'test',
    handler: (req, res) =>
      res.status(429).json({ success: false, message: 'Too many attempts. Please try again in a few minutes.' }),
  });

module.exports = {
  registerLimiter: createLimiter(10),
  loginLimiter: createLimiter(20),
  // Anything that sends an email or consumes a one-time token.
  emailLimiter: createLimiter(5),
  tokenLimiter: createLimiter(20),
  // Each accepted request stores an unpaid order.
  orderLimiter: createLimiter(30),
  // Starting or verifying a payment.
  paymentLimiter: createLimiter(30),
  // Stricter than the customer login: there is one admin account worth guessing.
  adminLoginLimiter: createLimiter(10),
};
