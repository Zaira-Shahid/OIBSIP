import { useEffect, useState } from 'react'
import PizzaCard from '../components/PizzaCard'
import useAuth from '../hooks/useAuth'
import { getErrorMessage } from '../services/api'
import { fetchPizzas } from '../services/pizzaService'

export default function Dashboard() {
  const { user } = useAuth()
  const [state, setState] = useState({ status: 'loading', pizzas: [], error: '' })

  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetchPizzas()
      .then((pizzas) => !cancelled && setState({ status: 'ready', pizzas, error: '' }))
      .catch((err) => !cancelled && setState({ status: 'error', pizzas: [], error: getErrorMessage(err) }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = () => {
    setState({ status: 'loading', pizzas: [], error: '' })
    setAttempt((n) => n + 1)
  }

  return (
    <section>
      <header className="page-head">
        <h1>Hi {user.name}, what are you craving?</h1>
        <p className="lead">Pick a favourite or customize your own.</p>
      </header>

      {state.status === 'loading' && (
        <div className="pizza-grid" aria-busy="true" aria-label="Loading pizzas">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="pizza-card pizza-card--skeleton" aria-hidden="true" />
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <div className="card center-note" role="alert">
          <p className="form-error">{state.error}</p>
          <button type="button" className="btn" onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {state.status === 'ready' && state.pizzas.length === 0 && (
        <div className="card center-note">
          <p>No pizzas are on the menu right now. Please check back soon.</p>
        </div>
      )}

      {state.status === 'ready' && state.pizzas.length > 0 && (
        <div className="pizza-grid">
          {state.pizzas.map((pizza) => (
            <PizzaCard key={pizza.id} pizza={pizza} />
          ))}
        </div>
      )}
    </section>
  )
}
