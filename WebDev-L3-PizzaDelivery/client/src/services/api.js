import axios from 'axios'

// All requests go through this instance. Later modules attach the JWT here.
const api = axios.create({ baseURL: '/api', timeout: 15000 })

// Turn any failure into a plain, user-friendly message.
export function getErrorMessage(error) {
  if (error.response?.data?.message) return error.response.data.message
  if (error.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.'
  if (error.request) return 'Cannot reach the server. Please check your connection.'
  return 'Something went wrong. Please try again.'
}

export default api
