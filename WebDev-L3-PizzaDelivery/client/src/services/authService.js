import api from './api'

export async function registerUser({ name, email, password }) {
  const res = await api.post('/auth/register', { name, email, password })
  return res.data.data
}

export async function loginUser({ email, password }) {
  const res = await api.post('/auth/login', { email, password })
  return res.data.data
}

export async function loginAdmin({ email, password }) {
  const res = await api.post('/admin/login', { email, password })
  return res.data.data
}

export async function fetchCurrentUser() {
  const res = await api.get('/auth/me')
  return res.data.data.user
}

export async function verifyEmail(token) {
  const res = await api.get('/auth/verify-email', { params: { token } })
  return res.data.message
}

export async function resendVerification(email) {
  const res = await api.post('/auth/resend-verification', { email })
  return res.data.message
}

export async function forgotPassword(email) {
  const res = await api.post('/auth/forgot-password', { email })
  return res.data.message
}

export async function resetPassword({ token, password }) {
  const res = await api.post('/auth/reset-password', { token, password })
  return res.data.message
}
