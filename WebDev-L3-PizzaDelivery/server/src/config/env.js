const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env'), quiet: true });

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongodbUri: process.env.MONGODB_URI || '',
  jwtSecret: process.env.JWT_SECRET || '',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};

// Variables the server cannot start without at this stage of the project.
// Later modules add their own (email, Razorpay) when they need them.
const REQUIRED = [['MONGODB_URI', env.mongodbUri]];

function assertEnv() {
  const missing = REQUIRED.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Copy server/.env.example to server/.env and fill them in.'
    );
  }
}

module.exports = { env, assertEnv };
