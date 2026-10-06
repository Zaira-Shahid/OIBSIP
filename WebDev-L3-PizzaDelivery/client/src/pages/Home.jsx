import useApiHealth from '../hooks/useApiHealth'

const LABELS = {
  checking: 'Checking server...',
  ok: 'Server and database connected',
  degraded: 'Server is up, database is not connected',
  offline: 'Server is not reachable',
}

export default function Home() {
  const health = useApiHealth()

  return (
    <section className="hero">
      <h1>Build your perfect pizza.</h1>
      <p className="lead">Pick a base, sauce, cheese and veggies - we deliver it hot.</p>
      <p className={`status status--${health}`} role="status">
        <span className="status__dot" aria-hidden="true" />
        {LABELS[health]}
      </p>
    </section>
  )
}
