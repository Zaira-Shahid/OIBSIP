// Keep in sync with server/src/validators/auth.validators.js
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/
export const PASSWORD_MESSAGE = 'Password must be 8-72 characters and include at least one letter and one number.'
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateRegister({ name, email, password, confirmPassword }) {
  const errors = {}
  if (name.trim().length < 2) errors.name = 'Name must be at least 2 characters.'
  else if (name.trim().length > 60) errors.name = 'Name is too long.'
  if (!EMAIL_RULE.test(email.trim())) errors.email = 'Please enter a valid email address.'
  if (!PASSWORD_RULE.test(password)) errors.password = PASSWORD_MESSAGE
  if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match.'
  return errors
}

export function validateLogin({ email, password }) {
  const errors = {}
  if (!EMAIL_RULE.test(email.trim())) errors.email = 'Please enter a valid email address.'
  if (!password) errors.password = 'Password is required.'
  return errors
}
