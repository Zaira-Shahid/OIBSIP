// Error with an HTTP status that is safe to show to the client.
// `code` is an optional machine-readable hint the client can act on (e.g. EMAIL_NOT_VERIFIED).
class ApiError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

module.exports = ApiError;
