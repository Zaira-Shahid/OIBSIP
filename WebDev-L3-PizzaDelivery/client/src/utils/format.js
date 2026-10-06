export const formatPrice = (price) => `₹${price.toLocaleString('en-IN')}`

export const ORDER_STATUS_LABELS = {
  ORDER_RECEIVED: 'Order Received',
  IN_KITCHEN: 'In Kitchen',
  SENT_TO_DELIVERY: 'Sent to Delivery',
}

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
