const { z } = require('zod');
const ApiError = require('../utils/ApiError');

// Keep in sync with client/src/utils/validation.js
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
const PASSWORD_MESSAGE = 'Password must be 8-72 characters and include at least one letter and one number.';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email is too long.')
  .pipe(z.email('Please enter a valid email address.'));

const registerSchema = z.strictObject({
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(60, 'Name is too long.'),
  email,
  password: z.string().regex(PASSWORD_RULE, PASSWORD_MESSAGE),
});

const loginSchema = z.strictObject({
  email,
  password: z.string().min(1, 'Password is required.').max(200),
});

const emailOnlySchema = z.strictObject({ email });

const tokenField = z.string().regex(/^[a-f0-9]{64}$/, 'This link is invalid or has expired.');

const verifyEmailQuerySchema = z.object({ token: tokenField });

const resetPasswordSchema = z.strictObject({
  token: tokenField,
  password: z.string().regex(PASSWORD_RULE, PASSWORD_MESSAGE),
});

const fail = (next, error) => {
  const issue = error.issues[0];
  next(new ApiError(400, issue.code === 'unrecognized_keys' ? 'Request contains fields that are not allowed.' : issue.message));
};

// Returns middleware that replaces req.body with the parsed (cleaned) data.
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) return fail(next, result.error);
  req.body = result.data;
  next();
};

// Validates req.query and exposes the cleaned values as req.validatedQuery.
const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query ?? {});
  if (!result.success) return fail(next, result.error);
  req.validatedQuery = result.data;
  next();
};

module.exports = {
  registerSchema,
  loginSchema,
  emailOnlySchema,
  verifyEmailQuerySchema,
  resetPasswordSchema,
  validate,
  validateQuery,
  PASSWORD_RULE,
  PASSWORD_MESSAGE,
};
