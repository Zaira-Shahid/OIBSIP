import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import PizzaBreakdown from '../components/PizzaBreakdown'
import { getErrorMessage } from '../services/api'
import { fetchOrder } from '../services/orderService'
import { ORDER_STATUS_LABELS, formatDateTime } from '../utils/format'
import { orderItems } from '../utils/order'

export default function OrderDetail() {
  const { id } = useParams()
  const justPaid = Boolean(useLocation().state?.justPaid)
  const [state, setState] = useState({ id: '', status: 'loading', order: null, error: '' })

  useEffect(() => {
    let cancelled = false
    fetchOrder(id)
      .then((order) => !cancelled && setState({ id, status: 'ready', order, error: '' }))
      .catch((err) => !cancelled && setState({ id, status: 'error', order: null, error: getErrorMessage(err) }))
    return () => {
      cancelled = true
    }
  }, [id])

  const current = state.id === id ? state : { status: 'loading' }
  const { order } = current

  return (
    <section>
      <header className="page-head">
        <h1>Order details</h1>
      </header>

      {current.status === 'loading' && <p aria-busy="true">Loading order…</p>}
      {current.status === 'error' && (
        <div className="card center-note" role="alert">
          <p className="form-error">{current.error}</p>
        </div>
      )}

      {current.status === 'ready' && (
        <div className="card builder__panel">
          {justPaid && (
            <p className="notice card" role="status">
              <strong>Payment successful.</strong> Your order is confirmed and the kitchen has it.
            </p>
          )}
          <p>
            <strong>{ORDER_STATUS_LABELS[order.orderStatus]}</strong>
            <span className="field__hint"> · placed {formatDateTime(order.createdAt)}</span>
          </p>
          <PizzaBreakdown
            items={orderItems(order)}
            unitPrice={order.unitPrice}
            quantity={order.quantity}
            total={order.amount}
          />
        </div>
      )}

      <p><Link to="/orders">← Back to my orders</Link></p>
    </section>
  )
}
