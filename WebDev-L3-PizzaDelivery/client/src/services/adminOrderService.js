import api from './api'

// Confirmed orders, newest first, each with `customer: { name, email }`.
export async function fetchAdminOrders() {
  const res = await api.get('/admin/orders')
  return res.data.data.orders
}

// Paid orders that could not be confirmed and need a manual refund in the Razorpay dashboard.
export async function fetchRefunds() {
  const res = await api.get('/admin/orders/refunds')
  return res.data.data.orders
}

// Records that the refund was made; the order then leaves the list.
export async function markRefunded(id) {
  const res = await api.post(`/admin/orders/${encodeURIComponent(id)}/mark-refunded`)
  return res.data.data.order
}

// The server only accepts the next step: ORDER_RECEIVED -> IN_KITCHEN -> SENT_TO_DELIVERY.
export async function updateOrderStatus(id, status) {
  const res = await api.patch(`/admin/orders/${encodeURIComponent(id)}/status`, { status })
  return res.data.data.order
}
