import { Component } from 'react'
import { Link } from 'react-router-dom'

// Catches a crash while rendering a page so the customer sees a friendly screen instead of a blank one.
// MainLayout re-creates it on every navigation (key = pathname), so moving to another page recovers.
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <section className="card center-note" role="alert">
        <h1>Something went wrong on this page</h1>
        <p>Reloading usually fixes it. If it keeps happening, go back to the start.</p>
        <p>
          <button type="button" className="btn" onClick={() => window.location.reload()}>Reload the page</button>{' '}
          <Link className="btn btn--ghost" to="/">Back to home</Link>
        </p>
      </section>
    )
  }
}
