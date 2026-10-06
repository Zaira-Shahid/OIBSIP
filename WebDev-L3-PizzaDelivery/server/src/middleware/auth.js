const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

// Requires a valid Bearer token. The user is re-read from the database on every request,
// so a deleted account or changed role takes effect immediately.
const authenticateUser = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw new ApiError(401, 'Please log in to continue.');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new ApiError(401, 'Your session has expired. Please log in again.');
  }

  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, 'Your session is no longer valid. Please log in again.');

  // A password reset invalidates every token issued before it.
  if (user.passwordChangedAt && payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
    throw new ApiError(401, 'Your password was changed. Please log in again.');
  }

  req.user = user;
  next();
});

// Must run after authenticateUser.
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return next(new ApiError(403, 'You do not have permission to do that.'));
  next();
};

// Must run after authenticateUser. Ordering and paying are customer actions; staff accounts cannot do them.
const requireCustomer = (req, res, next) => {
  if (req.user?.role !== 'user') return next(new ApiError(403, 'Admin accounts cannot place or pay for orders.'));
  next();
};

module.exports = { authenticateUser, requireAdmin, requireCustomer };
