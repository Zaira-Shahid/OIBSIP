const bcrypt = require('bcryptjs');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../utils/jwt');
const { createToken, hashToken } = require('../utils/tokens');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const User = require('../models/User');

const { BCRYPT_ROUNDS, DUMMY_HASH } = require('../utils/passwords');

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const INVALID_LOGIN = 'Invalid email or password.';
const DUPLICATE_EMAIL = 'An account with this email already exists.';
const INVALID_LINK = 'This link is invalid, has expired, or was already used.';

// Never log tokens or links; only the failure reason.
const logEmailFailure = (kind, err) => console.error(`${kind} email failed: ${err.message}`);

// Stores a fresh verification token on the user and emails the link.
async function issueVerificationEmail(user) {
  const { token, hash, expires } = createToken(VERIFICATION_TTL_MS);
  await User.updateOne({ _id: user._id }, { verificationTokenHash: hash, verificationTokenExpires: expires });
  await sendVerificationEmail(user, token);
}

const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (await User.exists({ email })) throw new ApiError(409, DUPLICATE_EMAIL);

  // Role is never taken from the request: public registration always creates a normal user.
  let user;
  try {
    user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      role: 'user',
    });
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, DUPLICATE_EMAIL);
    throw err;
  }

  // The account exists even if the email cannot be sent; the user can request another one.
  let emailSent = true;
  try {
    await issueVerificationEmail(user);
  } catch (err) {
    emailSent = false;
    logEmailFailure('Verification', err);
  }

  res.status(201).json({
    success: true,
    data: { user, emailSent },
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash');
  const passwordOk = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);

  // Admin accounts cannot use this endpoint; they get the same generic error as a wrong password.
  if (!user || !passwordOk || user.role !== 'user') throw new ApiError(401, INVALID_LOGIN);

  if (!user.isEmailVerified) {
    throw new ApiError(403, 'Please verify your email address before logging in.', 'EMAIL_NOT_VERIFIED');
  }

  res.json({ success: true, data: { token: signToken(user), user } });
});

const me = (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};

const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.validatedQuery;

  const user = await User.findOne({
    verificationTokenHash: hashToken(token),
    verificationTokenExpires: { $gt: new Date() },
  });
  if (!user) throw new ApiError(400, INVALID_LINK);

  // Single use: the token is removed as soon as it verifies the account.
  await User.updateOne(
    { _id: user._id },
    { isEmailVerified: true, $unset: { verificationTokenHash: 1, verificationTokenExpires: 1 } }
  );
  res.json({ success: true, message: 'Your email has been verified. You can log in now.' });
});

// Responses to the next two endpoints are identical whether or not the email exists, and the
// email is sent after responding, so neither the body nor the timing reveals which accounts exist.
const GENERIC_VERIFICATION =
  'If an unverified account exists for that email, we have sent a new verification link.';
const GENERIC_RESET = 'If an account exists for that email, we have sent a password reset link.';

const resendVerification = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email, role: 'user', isEmailVerified: false });
  res.json({ success: true, message: GENERIC_VERIFICATION });
  if (user) issueVerificationEmail(user).catch((err) => logEmailFailure('Verification', err));
});

const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email, role: 'user' });
  res.json({ success: true, message: GENERIC_RESET });
  if (!user) return;

  const { token, hash, expires } = createToken(RESET_TTL_MS);
  User.updateOne({ _id: user._id }, { passwordResetTokenHash: hash, passwordResetTokenExpires: expires })
    .then(() => sendPasswordResetEmail(user, token))
    .catch((err) => logEmailFailure('Password reset', err));
});

const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  const user = await User.findOne({
    passwordResetTokenHash: hashToken(token),
    passwordResetTokenExpires: { $gt: new Date() },
    role: 'user',
  });
  if (!user) throw new ApiError(400, INVALID_LINK);

  // Receiving the link proves the user controls the mailbox, so the email counts as verified.
  // passwordChangedAt invalidates every JWT issued before this reset.
  await User.updateOne(
    { _id: user._id },
    {
      passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      passwordChangedAt: new Date(),
      isEmailVerified: true,
      $unset: {
        passwordResetTokenHash: 1,
        passwordResetTokenExpires: 1,
        verificationTokenHash: 1,
        verificationTokenExpires: 1,
      },
    }
  );
  res.json({ success: true, message: 'Your password has been reset. You can log in with it now.' });
});

module.exports = { register, login, me, verifyEmail, resendVerification, forgotPassword, resetPassword };
