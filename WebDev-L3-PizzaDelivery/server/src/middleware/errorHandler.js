const { env } = require('../config/env');
const ApiError = require('../utils/ApiError');

function notFound(req, res, next) {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// Central error handler. Never leaks stack traces or database internals.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let message = err.isOperational ? err.message : 'Something went wrong on our side.';

  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Invalid JSON in request body.';
  } else if (err.name === 'ValidationError') {
    status = 400;
    message = 'Invalid data.';
  } else if (err.code === 11000) {
    status = 409;
    message = 'That value already exists.';
  } else if (err.name === 'CastError') {
    status = 400;
    message = 'Invalid identifier.';
  }

  if (status >= 500) console.error(`[${req.method} ${req.originalUrl}]`, env.nodeEnv === 'production' ? err.message : err);

  res.status(status).json({ success: false, message });
}

module.exports = { notFound, errorHandler };
