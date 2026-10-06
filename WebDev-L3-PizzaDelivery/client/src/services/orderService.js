import api from './api'

// Creates an UNPAID order. `selection` is ingredient ids plus quantity; the server sets every price.
export async function createOrder(selection) {
  const res = await api.post('/orders', selection)
  return res.data.data.order
}

// Makes a fresh Razorpay order for an unpaid order (safe to call again after closing the popup).
// Returns { orderId, payment: { keyId, razorpayOrderId, amount (paise), currency } }.
export async function startPayment(orderId) {
  const res = await api.post(`/orders/${encodeURIComponent(orderId)}/payment`)
  return res.data.data
}

// Sends Razorpay's checkout response to the server, which alone decides whether the order is confirmed.
export async function verifyPayment(orderId, response) {
  const res = await api.post('/payments/verify', {
    orderId,
    razorpay_order_id: response.razorpay_order_id,
    razorpay_payment_id: response.razorpay_payment_id,
    razorpay_signature: response.razorpay_signature,
  })
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
