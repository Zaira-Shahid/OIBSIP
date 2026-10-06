import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import useAuth from '../hooks/useAuth'
import { getErrorMessage } from '../services/api'
import { fetchInventory } from '../services/inventoryService'

// Overview. The orders screen and live statuses arrive in Module 10.
export default function AdminDashboard() {
  const { user } = useAuth()
  const [inv, setInv] = useState({ status: 'loading', summary: null, error: '' })

  useEffect(() => {
    let cancelled = false
    fetchInventory()
      .then(({ summary }) => !cancelled && setInv({ status: 'ready', summary, error: '' }))
      .catch((err) => !cancelled && setInv({ status: 'error', summary: null, error: getErrorMessage(err) }))
    return () => {
      cancelled = true
    }
  }, [])

  const { summary } = inv

  return (
    <section>
      <header className="page-head">
        <h1>Admin dashboard</h1>
        <p className="lead">Signed in as {user.name} ({user.email}).</p>
      </header>

      <div className="pizza-grid">
        <article className="card">
          <h2>Inventory</h2>
          {inv.status === 'loading' && <p className="field__hint" aria-busy="true">Checking stock…</p>}
          {inv.status === 'error' && <p className="field__error" role="alert">{inv.error}</p>}
          {inv.status === 'ready' && (
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
          <p className="field__hint">Incoming orders and status updates. Coming in a later module.</p>
        </article>
      </div>
    </section>
  )
}
