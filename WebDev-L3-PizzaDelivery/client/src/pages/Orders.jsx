import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import usePolling from '../hooks/usePolling'
import { getErrorMessage } from '../services/api'
import { fetchOrders } from '../services/orderService'
import { ORDER_STATUS_LABELS, formatDateTime, formatPrice } from '../utils/format'

const POLL_MS = 5000

// Only paid, confirmed orders are listed; the server never returns unpaid ones.
// Statuses refresh by themselves every few seconds while the tab is visible.
export default function Orders() {
  const [state, setState] = useState({ status: 'loading', orders: [], error: '', reconnecting: false })
  const [announcement, setAnnouncement] = useState('')
  const known = useRef(new Map()) // order id -> last seen status

  const load = useCallback(async () => {
    try {
      const orders = await fetchOrders()
      const changed = orders.find((o) => known.current.has(o.id) && known.current.get(o.id) !== o.orderStatus)
      if (changed) setAnnouncement(`An order is now: ${ORDER_STATUS_LABELS[changed.orderStatus]}.`)
      known.current = new Map(orders.map((o) => [o.id, o.orderStatus]))
      setState({ status: 'ready', orders, error: '', reconnecting: false })
    } catch (err) {
      // Keep showing what we already have; only a first load that fails is an error screen.
      setState((s) =>
        s.status === 'ready'
          ? { ...s, reconnecting: true }
          : { status: 'error', orders: [], error: getErrorMessage(err), reconnecting: false },
      )
    }
  }, [])

  const refresh = usePolling(load, POLL_MS)

  return (
    <section>
      <header className="page-head">
        <h1>My orders</h1>
        <p className="lead">Confirmed orders and their progress. This page updates by itself.</p>
      </header>

      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      {state.reconnecting && <p className="field__hint" role="status">Reconnecting… showing the last known status.</p>}

      {state.status === 'loading' && <p aria-busy="true">Loading your orders…</p>}

      {state.status === 'error' && (
        <div className="card center-note" role="alert">
          <p className="form-error">{state.error}</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setState({ status: 'loading', orders: [], error: '', reconnecting: false })
              refresh()
            }}
          >
            Try again
          </button>
        </div>
      )}

      {state.status === 'ready' && state.orders.length === 0 && (
        <div className="card center-note">
          <p>You have no confirmed orders yet.</p>
          <Link className="btn" to="/dashboard">Browse the menu</Link>
        </div>
      )}

      {state.status === 'ready' && state.orders.length > 0 && (
        <ul className="order-list">
          {state.orders.map((order) => (
            <li key={order.id} className="card order-list__item">
              <div>
                <strong>{ORDER_STATUS_LABELS[order.orderStatus]}</strong>
                <div className="field__hint">
                  {formatDateTime(order.createdAt)} · {order.quantity} × pizza
                </div>
              </div>
              <div className="order-list__side">
                <strong>{formatPrice(order.amount)}</strong>
                <Link to={`/orders/${order.id}`}>View details</Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
