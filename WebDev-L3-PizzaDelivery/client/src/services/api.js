import axios from 'axios'

const TOKEN_KEY = 'pizza_token'

// localStorage can throw (private mode, blocked storage), so every access is guarded.
export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function storeToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage unavailable: the session simply will not survive a reload.
  }
}

// All requests go through this instance. The JWT is attached automatically.
const api = axios.create({ baseURL: '/api', timeout: 15000 })

api.interceptors.request.use((config) => {
  const token = getStoredToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// AuthProvider registers a handler so an expired/invalid token logs the user out everywhere.
let onUnauthorized = null
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || ''
    const isAuthAttempt = url.startsWith('/auth/login') || url.startsWith('/auth/register')
    if (error.response?.status === 401 && !isAuthAttempt && getStoredToken()) onUnauthorized?.()
    return Promise.reject(error)
  },
)

// Turn any failure into a plain, user-friendly message.
export function getErrorMessage(error) {
  if (error.response?.data?.message) return error.response.data.message
  if (error.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.'
  if (error.request) return 'Cannot reach the server. Please check your connection.'
  return 'Something went wrong. Please try again.'
}

export default api
