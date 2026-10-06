import api from './api'

// Confirmed orders, newest first, each with `customer: { name, email }`.
export async function fetchAdminOrders() {
  const res = await api.get('/admin/orders')
  return res.data.data.orders
}

// The server only accepts the next step: ORDER_RECEIVED -> IN_KITCHEN -> SENT_TO_DELIVERY.
export async function updateOrderStatus(id, status) {
  const res = await api.patch(`/admin/orders/${encodeURIComponent(id)}/status`, { status })
  return res.data.data.order
}
