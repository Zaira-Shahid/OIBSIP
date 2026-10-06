// Express 5 forwards rejected promises already, but this keeps handlers explicit and portable.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
