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

module.exports = { registerLimiter: createLimiter(10), loginLimiter: createLimiter(20) };
