const express = require('express');
const c = require('../controllers/auth.controller');
const { authenticateUser } = require('../middleware/auth');
const { registerLimiter, loginLimiter, emailLimiter, tokenLimiter } = require('../middleware/rateLimiters');
const v = require('../validators/auth.validators');

const router = express.Router();

router.post('/register', registerLimiter, v.validate(v.registerSchema), c.register);
router.post('/login', loginLimiter, v.validate(v.loginSchema), c.login);
router.get('/me', authenticateUser, c.me);

router.get('/verify-email', tokenLimiter, v.validateQuery(v.verifyEmailQuerySchema), c.verifyEmail);
router.post('/resend-verification', emailLimiter, v.validate(v.emailOnlySchema), c.resendVerification);
router.post('/forgot-password', emailLimiter, v.validate(v.emailOnlySchema), c.forgotPassword);
router.post('/reset-password', tokenLimiter, v.validate(v.resetPasswordSchema), c.resetPassword);

module.exports = router;
