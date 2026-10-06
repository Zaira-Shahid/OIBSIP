import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getErrorMessage } from '../services/api'
import { fetchOrders } from '../services/orderService'
import { ORDER_STATUS_LABELS, formatDateTime, formatPrice } from '../utils/format'

// Only paid, confirmed orders are listed; the server never returns unpaid ones.
export default function Orders() {
  const [state, setState] = useState({ status: 'loading', orders: [], error: '' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchOrders()
      .then((orders) => !cancelled && setState({ status: 'ready', orders, error: '' }))
      .catch((err) => !cancelled && setState({ status: 'error', orders: [], error: getErrorMessage(err) }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  return (
    <section>
      <header className="page-head">
        <h1>My orders</h1>
        <p className="lead">Confirmed orders and their progress.</p>
      </header>

      {state.status === 'loading' && <p aria-busy="true">Loading your orders…</p>}

      {state.status === 'error' && (
        <div className="card center-note" role="alert">
          <p className="form-error">{state.error}</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setState({ status: 'loading', orders: [], error: '' })
              setAttempt((n) => n + 1)
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
