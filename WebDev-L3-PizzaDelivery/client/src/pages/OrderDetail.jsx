import { useCallback, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import OrderTracker from '../components/OrderTracker'
import PizzaBreakdown from '../components/PizzaBreakdown'
import usePolling from '../hooks/usePolling'
import { getErrorMessage } from '../services/api'
import { fetchOrder } from '../services/orderService'
import { ORDER_STATUS_LABELS, formatDateTime } from '../utils/format'
import { orderItems } from '../utils/order'

const POLL_MS = 5000

// One order with a live progress tracker. Polls while the tab is visible and stops when the page is left.
export default function OrderDetail() {
  const { id } = useParams()
  const justPaid = Boolean(useLocation().state?.justPaid)
  const [state, setState] = useState({ id: '', status: 'loading', order: null, error: '', reconnecting: false })
  const [announcement, setAnnouncement] = useState('')
  const lastStatus = useRef('')
  const gone = useRef(false) // a 404 will not fix itself, so stop polling

  const load = useCallback(async () => {
    if (gone.current) return
    try {
      const order = await fetchOrder(id)
      if (lastStatus.current && lastStatus.current !== order.orderStatus) {
        setAnnouncement(`Your order is now: ${ORDER_STATUS_LABELS[order.orderStatus]}.`)
      }
      lastStatus.current = order.orderStatus
      setState({ id, status: 'ready', order, error: '', reconnecting: false })
    } catch (err) {
      if (err.response?.status === 404) gone.current = true
      setState((s) =>
        s.id === id && s.status === 'ready'
          ? { ...s, reconnecting: true }
          : { id, status: 'error', order: null, error: getErrorMessage(err), reconnecting: false },
      )
    }
  }, [id])

  usePolling(load, POLL_MS)

  const current = state.id === id ? state : { status: 'loading' }
  const { order } = current

  return (
    <section>
      <header className="page-head">
        <h1>Order details</h1>
      </header>

      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>

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
          <OrderTracker status={order.orderStatus} />
          {current.reconnecting && <p className="field__hint" role="status">Reconnecting… showing the last known status.</p>}
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
