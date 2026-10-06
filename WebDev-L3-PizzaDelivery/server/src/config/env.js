const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });

const nodeEnv = process.env.NODE_ENV || 'development';

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

module.exports = { env, assertEnv };
