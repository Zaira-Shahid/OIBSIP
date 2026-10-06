const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 12;
// Compared against when an account does not exist, so response time does not reveal it.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

module.exports = { BCRYPT_ROUNDS, DUMMY_HASH };
