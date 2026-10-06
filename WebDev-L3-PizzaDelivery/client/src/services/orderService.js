import api from './api'

// Creates an UNPAID order. `selection` is ingredient ids plus quantity; the server sets every price.
export async function createOrder(selection) {
  const res = await api.post('/orders', selection)
  return res.data.data.order
}

export async function fetchOrders() {
  const res = await api.get('/orders')
  return res.data.data.orders
}

export async function fetchOrder(id) {
  const res = await api.get(`/orders/${encodeURIComponent(id)}`)
  return res.data.data.order
}
