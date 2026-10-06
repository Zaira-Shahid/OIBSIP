import api from './api'

export async function getHealth() {
  // 503 means "API up but database down" - still a useful body, so accept it.
  const res = await api.get('/health', { validateStatus: (s) => s === 200 || s === 503 })
  return res.data
}
