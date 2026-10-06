import { Link } from 'react-router-dom'

// Placeholder: the step-by-step pizza builder is built in Module 5.
export default function Builder() {
  return (
    <section className="card auth-card">
      <h1>Pizza builder</h1>
      <p>Customizing your pizza is coming in the next module.</p>
      <Link className="btn btn--ghost" to="/dashboard">Back to the menu</Link>
    </section>
  )
}
