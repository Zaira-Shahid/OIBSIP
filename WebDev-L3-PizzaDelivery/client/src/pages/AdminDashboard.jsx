import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import usePolling from '../hooks/usePolling'
import { getErrorMessage } from '../services/api'
import { fetchAdminOrders } from '../services/adminOrderService'
import { fetchInventory } from '../services/inventoryService'

const POLL_MS = 10000

// Overview of stock and incoming orders; refreshes by itself while the tab is visible.
export default function AdminDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState({ status: 'loading', summary: null, orders: [], error: '' })

  const load = useCallback(async () => {
    try {
      const [{ summary }, orders] = await Promise.all([fetchInventory(), fetchAdminOrders()])
      setData({ status: 'ready', summary, orders, error: '' })
    } catch (err) {
      setData((d) => (d.status === 'ready' ? d : { status: 'error', summary: null, orders: [], error: getErrorMessage(err) }))
    }
  }, [])
  usePolling(load, POLL_MS)

  const { summary, orders } = data
  const count = (status) => orders.filter((o) => o.orderStatus === status).length

  return (
    <section>
      <header className="page-head">
        <h1>Admin dashboard</h1>
        <p className="lead">Signed in as {user.name} ({user.email}).</p>
      </header>

      <div className="pizza-grid">
        <article className="card">
          <h2>Inventory</h2>
          {data.status === 'loading' && <p className="field__hint" aria-busy="true">Checking stock…</p>}
          {data.status === 'error' && <p className="field__error" role="alert">{data.error}</p>}
          {data.status === 'ready' && (
            <p role="status" className="inv-overview">
              <span className={`badge badge--${summary.low ? 'low' : 'ok'}`}>
                <span aria-hidden="true">{summary.low ? '!' : '✓'}</span> {summary.low} low stock
              </span>{' '}
              <span className={`badge badge--${summary.outOfStock ? 'out_of_stock' : 'ok'}`}>
                <span aria-hidden="true">{summary.outOfStock ? '✕' : '✓'}</span> {summary.outOfStock} out of stock
              </span>
            </p>
          )}
          <Link className="btn" to="/admin/inventory">Manage inventory</Link>
        </article>
        <article className="card">
          <h2>Orders</h2>
          {data.status === 'loading' && <p className="field__hint" aria-busy="true">Checking orders…</p>}
          {data.status === 'ready' && (
            <p role="status" className="inv-overview">
              <span className="badge badge--order_received">{count('ORDER_RECEIVED')} received</span>{' '}
              <span className="badge badge--in_kitchen">{count('IN_KITCHEN')} in kitchen</span>{' '}
              <span className="badge badge--sent_to_delivery">{count('SENT_TO_DELIVERY')} sent to delivery</span>
            </p>
          )}
          <Link className="btn" to="/admin/orders">Manage orders</Link>
        </article>
      </div>
    </section>
  )
}
