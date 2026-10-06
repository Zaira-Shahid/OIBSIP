const crypto = require('crypto');

// One-time tokens: the raw value goes in the email link, only its SHA-256 hash is stored.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function createToken(ttlMs) {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token), expires: new Date(Date.now() + ttlMs) };
}

module.exports = { createToken, hashToken };
