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

// Returns middleware that replaces req.body with the parsed (cleaned) data.
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const unknownKey = issue.code === 'unrecognized_keys';
    return next(new ApiError(400, unknownKey ? 'Request contains fields that are not allowed.' : issue.message));
  }
  req.body = result.data;
  next();
};

module.exports = { registerSchema, loginSchema, validate, PASSWORD_RULE, PASSWORD_MESSAGE };
