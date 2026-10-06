import useAuth from '../hooks/useAuth'

// Shell only. The inventory screen (Module 9) and the orders screen (Module 10) are not built yet.
export default function AdminDashboard() {
  const { user } = useAuth()

  return (
    <section>
      <header className="page-head">
        <h1>Admin dashboard</h1>
        <p className="lead">Signed in as {user.name} ({user.email}).</p>
      </header>

      <div className="pizza-grid">
        <article className="card">
          <h2>Inventory</h2>
          <p className="field__hint">Stock levels and manual updates. Coming in a later module.</p>
        </article>
        <article className="card">
          <h2>Orders</h2>
          <p className="field__hint">Incoming orders and status updates. Coming in a later module.</p>
        </article>
      </div>
    </section>
  )
}
