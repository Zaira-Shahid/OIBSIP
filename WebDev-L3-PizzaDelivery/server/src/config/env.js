const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });

const nodeEnv = process.env.NODE_ENV || 'development';
const DEFAULT_LOW_STOCK_CRON = '*/15 * * * *';

const env = {
  nodeEnv,
  port: Number(process.env.PORT) || 5000,
  mongodbUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  // TEMPORARY (until Module 3 email verification is verified): set AUTH_REQUIRE_VERIFIED=false
  // in development to let unverified users log in. Always true in production.
  requireVerified: nodeEnv === 'production' || process.env.AUTH_REQUIRE_VERIFIED !== 'false',
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT) || 587,
    user: process.env.EMAIL_USER || '',
    password: process.env.EMAIL_PASSWORD || '',
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER || '',
  },
  // Razorpay TEST-mode keys only (key id must start with rzp_test_). Payments are disabled until both are set.
  razorpay: {
    keyId: (process.env.RAZORPAY_KEY_ID || '').trim(),
    keySecret: (process.env.RAZORPAY_KEY_SECRET || '').trim(),
  },
  // Low-stock scheduler (spec section 13). Alerts go to ADMIN_ALERT_EMAIL, falling back to ADMIN_EMAIL.
  lowStockCron: (process.env.LOW_STOCK_CHECK_CRON || DEFAULT_LOW_STOCK_CRON).trim(),
  alertEmail: (process.env.ADMIN_ALERT_EMAIL || process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  adminEmail: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || '',
};

// Variables the server cannot start without at this stage of the project.
// Later modules add their own (email, Razorpay) when they need them.
const REQUIRED = [
  ['MONGODB_URI', env.mongodbUri],
  ['JWT_SECRET', env.jwtSecret],
];

function assertEnv() {
  const missing = REQUIRED.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy server/.env.example to server/.env and fill them in.'
    );
  }
  if (env.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET is too short; use at least 32 characters.');
  }
}

module.exports = { env, assertEnv, DEFAULT_LOW_STOCK_CRON };
