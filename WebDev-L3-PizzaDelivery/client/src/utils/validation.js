// Keep in sync with server/src/validators/auth.validators.js
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/
export const PASSWORD_MESSAGE = 'Password must be 8-72 characters and include at least one letter and one number.'
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Returns an error message, or '' when valid.
export function validateEmail(email) {
  return EMAIL_RULE.test(email.trim()) ? '' : 'Please enter a valid email address.'
}

export function validatePasswordPair({ password, confirmPassword }) {
  const errors = {}
  if (!PASSWORD_RULE.test(password)) errors.password = PASSWORD_MESSAGE
  if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.'
  return errors
}

export function validateRegister({ name, email, password, confirmPassword }) {
  const errors = validatePasswordPair({ password, confirmPassword })
  if (name.trim().length < 2) errors.name = 'Name must be at least 2 characters.'
  else if (name.trim().length > 60) errors.name = 'Name is too long.'
  const emailError = validateEmail(email)
  if (emailError) errors.email = emailError
  return errors
}

export function validateLogin({ email, password }) {
  const errors = {}
  const emailError = validateEmail(email)
  if (emailError) errors.email = emailError
  if (!password) errors.password = 'Password is required.'
  return errors
}
