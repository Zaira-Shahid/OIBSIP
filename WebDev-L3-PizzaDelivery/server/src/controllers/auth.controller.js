const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../utils/jwt');
const { env } = require('../config/env');
const User = require('../models/User');

const BCRYPT_ROUNDS = 12;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const INVALID_LOGIN = 'Invalid email or password.';
const DUPLICATE_EMAIL = 'An account with this email already exists.';
// Compared against when the account does not exist, so response time does not reveal it.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (await User.exists({ email })) throw new ApiError(409, DUPLICATE_EMAIL);

  // Role is never taken from the request: public registration always creates a normal user.
  // Only the hash of the verification token is stored; Module 3 emails the raw token link.
  const verificationToken = crypto.randomBytes(32).toString('hex');
  let user;
  try {
    user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role: 'user',
      verificationTokenHash: crypto.createHash('sha256').update(verificationToken).digest('hex'),
      verificationTokenExpires: new Date(Date.now() + VERIFICATION_TTL_MS),
    });
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, DUPLICATE_EMAIL);
    throw err;
  }

  res.status(201).json({
    success: true,
    data: { user, requiresVerification: env.requireVerified },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordOk = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

  // Admin accounts cannot use this endpoint; they get the same generic error as a wrong password.
  if (!user || !passwordOk || user.role !== 'user') throw new ApiError(401, INVALID_LOGIN);

  if (env.requireVerified && !user.isEmailVerified) {
    throw new ApiError(403, 'Please verify your email address before logging in.');
  }

  res.json({ success: true, data: { token: signToken(user), user } });
});

const me = (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};

module.exports = { register, login, me };
