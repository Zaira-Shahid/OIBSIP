import { Link } from 'react-router-dom'
import useApiHealth from '../hooks/useApiHealth'
import useAuth from '../hooks/useAuth'

const LABELS = {
  checking: 'Checking server...',
  degraded: 'The server is up, but the database is not connected.',
  offline: 'The server is not reachable right now.',
}

const STEPS = [
  { title: 'Build it', text: 'Pick a favourite or choose your own base, sauce, cheese and vegetables.' },
  { title: 'Pay securely', text: 'Check the itemised summary, then pay online (Razorpay test mode).' },
  { title: 'Follow it', text: 'Watch your order move from received to the kitchen to out for delivery.' },
]

export default function Home() {
  const health = useApiHealth()
  const { isAuthenticated, isAdmin, loading } = useAuth()

  return (
    <>
      <section className="hero">
        <h1>Build your perfect pizza.</h1>
        <p className="lead">Pick a base, sauce, cheese and veggies - we deliver it hot.</p>

        {!loading && (
          <div className="hero__actions">
            {!isAuthenticated && (
              <>
                <Link className="btn" to="/register">Sign up to order</Link>
                <Link className="btn btn--ghost" to="/login">Log in</Link>
              </>
            )}
            {isAuthenticated && !isAdmin && (
              <>
                <Link className="btn" to="/dashboard">Browse the menu</Link>
                <Link className="btn btn--ghost" to="/builder">Build your own pizza</Link>
              </>
            )}
            {isAdmin && <Link className="btn" to="/admin/dashboard">Open the admin dashboard</Link>}
          </div>
        )}

        {/* Only shown when something is wrong; a healthy server needs no badge on the landing page. */}
        {health !== 'ok' && (
          <p className={`status status--${health}`} role="status">
            <span className="status__dot" aria-hidden="true" />
            {LABELS[health]}
          </p>
        )}
      </section>

      <section aria-labelledby="how-heading" className="how">
        <h2 id="how-heading">How it works</h2>
        <ol className="how__steps">
          {STEPS.map((step, i) => (
            <li key={step.title} className="card how__step">
              <span className="how__num" aria-hidden="true">{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
