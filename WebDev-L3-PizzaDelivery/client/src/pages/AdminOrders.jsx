import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import usePolling from '../hooks/usePolling'
import { getErrorMessage } from '../services/api'
import { fetchAdminOrders, updateOrderStatus } from '../services/adminOrderService'
import { ORDER_STATUS_LABELS, formatDateTime, formatPrice } from '../utils/format'

const POLL_MS = 10000
// The only legal next step for each status; after delivery there is none.
const NEXT = {
  ORDER_RECEIVED: { status: 'IN_KITCHEN', label: 'Mark In Kitchen' },
  IN_KITCHEN: { status: 'SENT_TO_DELIVERY', label: 'Mark Sent to Delivery' },
}

const describe = ({ customPizza }) => {
  const veg = customPizza.vegetables.map((v) => v.name)
  return [
    `Base: ${customPizza.base.name}`,
    `Sauce: ${customPizza.sauce.name}`,
    `Cheese: ${customPizza.cheese.name}`,
    `Vegetables: ${veg.length ? veg.join(', ') : 'none'}`,
  ]
}

function OrderCard({ order, onUpdated, onConflict }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const next = NEXT[order.orderStatus]

  async function advance() {
    setBusy(true)
    setError('')
    try {
      onUpdated(await updateOrderStatus(order.id, next.status))
    } catch (err) {
      setError(getErrorMessage(err))
      if (err.response?.status === 409) onConflict() // someone else moved it: show the latest state
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="card admin-order">
      <div className="admin-order__head">
        <strong>{order.customer ? order.customer.name : 'Deleted customer'}</strong>
        {order.customer && <span className="field__hint">{order.customer.email}</span>}
        <span className="field__hint">{formatDateTime(order.createdAt)}</span>
      </div>
      <ul className="admin-order__items">
        {describe(order).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="admin-order__foot">
        <span>
          {order.quantity} × pizza · <strong>{formatPrice(order.amount)}</strong> · Payment: {order.paymentStatus === 'PAID' ? 'Paid' : order.paymentStatus}
        </span>
        <span className={`badge badge--${order.orderStatus.toLowerCase()}`}>{ORDER_STATUS_LABELS[order.orderStatus]}</span>
        {next ? (
          <button type="button" className="btn" disabled={busy} onClick={advance}>
            {busy ? 'Updating…' : next.label}
          </button>
        ) : (
          <span className="field__hint">Completed</span>
        )}
      </div>
      {error && <p className="field__error" role="alert">{error}</p>}
    </li>
  )
}

// Confirmed orders, newest first. Refreshes by itself so a new paid order appears without reloading.
export default function AdminOrders() {
  const [state, setState] = useState({ status: 'loading', orders: [], error: '', reconnecting: false })

  const load = useCallback(async () => {
    try {
      const orders = await fetchAdminOrders()
      setState({ status: 'ready', orders, error: '', reconnecting: false })
    } catch (err) {
      setState((s) =>
        s.status === 'ready'
          ? { ...s, reconnecting: true }
          : { status: 'error', orders: [], error: getErrorMessage(err), reconnecting: false },
      )
    }
  }, [])
  const refresh = usePolling(load, POLL_MS)

  const replaceOrder = (updated) =>
    setState((s) => ({ ...s, orders: s.orders.map((o) => (o.id === updated.id ? updated : o)) }))

  const count = (status) => state.orders.filter((o) => o.orderStatus === status).length

  return (
    <section>
      <header className="page-head">
        <h1>Orders</h1>
        <p className="lead">Paid orders, newest first. This page updates by itself.</p>
      </header>

      {state.reconnecting && <p className="field__hint" role="status">Reconnecting… showing the last known orders.</p>}
      {state.status === 'loading' && <p aria-busy="true">Loading orders…</p>}

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

      {state.status === 'ready' && (
        <>
          <p className="inv-summary" role="status">
            {count('ORDER_RECEIVED')} received · {count('IN_KITCHEN')} in kitchen · {count('SENT_TO_DELIVERY')} sent to delivery
          </p>
          {state.orders.length === 0 ? (
            <div className="card center-note"><p>No paid orders yet.</p></div>
          ) : (
            <ul className="order-list">
              {state.orders.map((order) => (
                <OrderCard key={order.id} order={order} onUpdated={replaceOrder} onConflict={refresh} />
              ))}
            </ul>
          )}
        </>
      )}

      <p><Link to="/admin/dashboard">← Back to the admin dashboard</Link></p>
    </section>
  )
}
