import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import PizzaBreakdown from '../components/PizzaBreakdown'
import useAuth from '../hooks/useAuth'
import { getErrorMessage } from '../services/api'
import { createOrder, startPayment, verifyPayment } from '../services/orderService'
import { fetchCustomPizzaPrice } from '../services/pizzaService'
import { openCheckout } from '../utils/razorpay'

const MAX_QUANTITY = 5
// Errors after which paying again would be wrong or pointless.
const FINAL_CODES = ['PAID_NOT_CONFIRMED', 'ALREADY_PAID']

// Step between the builder and payment. Every figure shown is the server's quote.
// The unpaid order is created when the user clicks "Proceed to pay"; if the payment window is closed the
// same order can be paid again.
export default function OrderSummary() {
  const selection = useLocation().state?.selection
  const navigate = useNavigate()
  const { user } = useAuth()
  const [quantity, setQuantity] = useState(1)
  const [quoteResult, setQuoteResult] = useState({ key: '', status: 'loading', data: null, error: '' })
  const [attempt, setAttempt] = useState(0)
  const [order, setOrder] = useState(null)
  const [busy, setBusy] = useState('') // '' | 'starting' | 'checkout' | 'verifying'
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [finalError, setFinalError] = useState(false)
  // Checkout response kept when the server could not be reached, so verification can be retried without paying again.
  const [unverified, setUnverified] = useState(null)

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

  const confirm = async (orderId, response) => {
    setBusy('verifying')
    try {
      await verifyPayment(orderId, response)
      navigate(`/orders/${orderId}`, { replace: true, state: { justPaid: true } })
    } catch (err) {
      if (err.response) {
        setError(getErrorMessage(err))
        setFinalError(FINAL_CODES.includes(err.response.data?.code))
        setUnverified(null)
      } else {
        // Paid, but we could not reach the server: do not ask the customer to pay again.
        setUnverified({ orderId, response })
        setError('Your payment may have gone through, but we could not confirm it yet. Do not pay again. Please try confirming below.')
      }
      setBusy('')
    }
  }

  const pay = async () => {
    setError('')
    setNotice('')
    setBusy('starting')
    let current = order
    try {
      if (!current) {
        current = await createOrder({ ...selection, quantity })
        setOrder(current)
      }
      const { payment } = await startPayment(current.id)
      setBusy('checkout')
      const result = await openCheckout({
        key: payment.keyId,
        amount: payment.amount,
        currency: payment.currency,
        order_id: payment.razorpayOrderId,
        name: 'Slice & Co.',
        description: `Custom pizza × ${current.quantity}`,
        prefill: { name: user?.name, email: user?.email },
        theme: { color: '#c0392b' },
      })
      if (result.status === 'dismissed') {
        setNotice(
          result.failure
            ? `${result.failure} Your order is saved, so you can try again.`
            : 'Payment window closed. Nothing was charged and your order is saved, so you can pay when you are ready.',
        )
        setBusy('')
        return
      }
      await confirm(current.id, result.response)
    } catch (err) {
      setError(getErrorMessage(err))
      setFinalError(FINAL_CODES.includes(err.response?.data?.code))
      if (!current) setAttempt((n) => n + 1) // stock may have changed: re-quote
      setBusy('')
    }
  }

  const locked = Boolean(order)
  const working = busy !== ''
  const payLabel = {
    starting: 'Starting payment…',
    checkout: 'Complete payment in the window…',
    verifying: 'Confirming payment…',
  }[busy] || (locked ? 'Pay now' : 'Proceed to pay')

  return (
    <section>
      <header className="page-head">
        <h1>Order summary</h1>
        <p className="lead">Check your pizza before paying.</p>
      </header>

      <div className="card builder__panel">
        <div className="field qty">
          <label htmlFor="quantity">Quantity</label>
          <select id="quantity" value={quantity} disabled={locked || working} onChange={(e) => setQuantity(Number(e.target.value))}>
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

        {error && <p className="form-error" role="alert">{error}</p>}
        {notice && <p className="notice card" role="status">{notice}</p>}
        {unverified && (
          <button type="button" className="btn btn--ghost" disabled={working} onClick={() => confirm(unverified.orderId, unverified.response)}>
            Confirm my payment
          </button>
        )}
        <p className="field__hint">Payments run in Razorpay test mode: no real money is charged.</p>

        <div className="builder__nav">
          {/* Always offered: a changed price or stock problem is fixed by building the pizza again. */}
          <Link className="btn btn--ghost" to="/builder" state={{ selection }}>Edit pizza</Link>
          <button
            type="button"
            className="btn"
            onClick={pay}
            disabled={working || finalError || Boolean(unverified) || quote.status !== 'ready'}
          >
            {payLabel}
          </button>
        </div>
      </div>
    </section>
  )
}
