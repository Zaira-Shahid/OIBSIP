const express = require('express');
const { register, login, me } = require('../controllers/auth.controller');
const { authenticateUser } = require('../middleware/auth');
const { registerLimiter, loginLimiter } = require('../middleware/rateLimiters');
const { validate, registerSchema, loginSchema } = require('../validators/auth.validators');

const router = express.Router();

router.post('/register', registerLimiter, validate(registerSchema), register);
router.post('/login', loginLimiter, validate(loginSchema), login);
router.get('/me', authenticateUser, me);

module.exports = router;
