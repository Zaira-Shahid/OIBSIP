import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import PizzaBreakdown from '../components/PizzaBreakdown'
import { getErrorMessage } from '../services/api'
import { createOrder } from '../services/orderService'
import { fetchCustomPizzaPrice } from '../services/pizzaService'

const MAX_QUANTITY = 5

// Step between the builder and payment. Every figure shown is the server's quote.
// The unpaid order is only created when the user clicks "Proceed to pay".
export default function OrderSummary() {
  const selection = useLocation().state?.selection
  const [quantity, setQuantity] = useState(1)
  const [quoteResult, setQuoteResult] = useState({ key: '', status: 'loading', data: null, error: '' })
  const [attempt, setAttempt] = useState(0)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [order, setOrder] = useState(null)

  const quoteKey = `${attempt}:${quantity}`
  const quote = quoteResult.key === quoteKey ? quoteResult : { status: 'loading' }

  useEffect(() => {
    if (!selection) return undefined
    let cancelled = false
    fetchCustomPizzaPrice({ ...selection, quantity })
      .then((data) => !cancelled && setQuoteResult({ key: quoteKey, status: 'ready', data, error: '' }))
      .catch((err) => !cancelled && setQuoteResult({ key: quoteKey, status: 'error', data: null, error: getErrorMessage(err) }))
    return () => {
      cancelled = true
    }
  }, [selection, quantity, quoteKey])

  // Opened directly (or after a reload): there is no pizza to summarise.
  if (!selection) return <Navigate to="/builder" replace />

  const proceed = async () => {
    setCreating(true)
    setCreateError('')
    try {
      setOrder(await createOrder({ ...selection, quantity }))
    } catch (err) {
      setCreateError(getErrorMessage(err))
      setAttempt((n) => n + 1) // stock may have changed: re-quote
    } finally {
      setCreating(false)
    }
  }

  const locked = Boolean(order)

  return (
    <section>
      <header className="page-head">
        <h1>Order summary</h1>
        <p className="lead">Check your pizza before paying.</p>
      </header>

      <div className="card builder__panel">
        <div className="field qty">
          <label htmlFor="quantity">Quantity</label>
          <select id="quantity" value={quantity} disabled={locked} onChange={(e) => setQuantity(Number(e.target.value))}>
            {Array.from({ length: MAX_QUANTITY }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {quote.status === 'loading' && <p aria-busy="true">Confirming prices…</p>}
        {quote.status === 'error' && (
          <div role="alert">
            <p className="form-error">{quote.error}</p>
            <p className="field__hint">Go back to change your pizza or the quantity.</p>
          </div>
        )}
        {quote.status === 'ready' && <PizzaBreakdown {...quote.data} />}

        {createError && <p className="form-error" role="alert">{createError}</p>}

        {locked && (
          <div className="notice card" role="status">
            <strong>Order created: not confirmed yet.</strong>
            <p>
              Your order is saved but unpaid, so it is not being prepared. Online payment is added in the next
              module.
            </p>
          </div>
        )}

        <div className="builder__nav">
          {locked ? (
            <Link className="btn btn--ghost" to="/dashboard">Back to menu</Link>
          ) : (
            <Link className="btn btn--ghost" to="/builder" state={{ selection }}>Edit pizza</Link>
          )}
          {locked ? (
            <button type="button" className="btn" disabled>Payment coming next</button>
          ) : (
            <button type="button" className="btn" onClick={proceed} disabled={creating || quote.status !== 'ready'}>
              {creating ? 'Creating order…' : 'Proceed to pay'}
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
