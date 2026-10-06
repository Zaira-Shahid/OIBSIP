import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import InventoryRow from '../components/InventoryRow'
import { getErrorMessage } from '../services/api'
import { fetchInventory } from '../services/inventoryService'

const GROUPS = [
  { category: 'base', title: 'Pizza bases' },
  { category: 'sauce', title: 'Sauces' },
  { category: 'cheese', title: 'Cheeses' },
  { category: 'vegetable', title: 'Vegetables' },
]

export default function AdminInventory() {
  const [state, setState] = useState({ status: 'loading', items: [], error: '' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchInventory()
      .then(({ items }) => !cancelled && setState({ status: 'ready', items, error: '' }))
      .catch((err) => !cancelled && setState({ status: 'error', items: [], error: getErrorMessage(err) }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  // Replace one row with the server's latest version of that item.
  const replaceItem = (updated) =>
    setState((s) => ({ ...s, items: s.items.map((i) => (i.id === updated.id ? updated : i)) }))

  const active = state.items.filter((i) => i.active)
  const low = active.filter((i) => i.status === 'LOW').length
  const out = active.filter((i) => i.status === 'OUT_OF_STOCK').length

  return (
    <section>
      <header className="page-head">
        <h1>Inventory</h1>
        <p className="lead">Current stock for every ingredient. Low means below the item's own threshold.</p>
      </header>

      {state.status === 'loading' && <p aria-busy="true">Loading inventory…</p>}

      {state.status === 'error' && (
        <div className="card center-note" role="alert">
          <p className="form-error">{state.error}</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setState({ status: 'loading', items: [], error: '' })
              setAttempt((n) => n + 1)
            }}
          >
            Try again
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <p className="inv-summary" role="status">
            {low === 0 && out === 0 ? 'All active items are well stocked.' : `${low} low stock · ${out} out of stock`}
          </p>
          {GROUPS.map(({ category, title }) => (
            <div key={category} className="card inv-group">
              <h2>{title}</h2>
              <table className="inv-table">
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col">In stock</th>
                    <th scope="col">Set stock to</th>
                    <th scope="col">Low-stock threshold</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {state.items
                    .filter((i) => i.category === category)
                    .map((item) => (
                      <InventoryRow key={item.id} item={item} onChange={replaceItem} />
                    ))}
                </tbody>
              </table>
            </div>
          ))}
        </>
      )}

      <p><Link to="/admin/dashboard">← Back to the admin dashboard</Link></p>
    </section>
  )
}
