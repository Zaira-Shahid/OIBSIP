import { useState } from 'react'
import { Link } from 'react-router-dom'
import FormField from '../components/FormField'
import { getErrorMessage } from '../services/api'
import { forgotPassword } from '../services/authService'
import { validateEmail } from '../utils/validation'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [doneMessage, setDoneMessage] = useState('')

  async function onSubmit(e) {
    e.preventDefault()
    setServerError('')
    const found = validateEmail(email)
    setError(found)
    if (found) return
    setSubmitting(true)
    try {
      setDoneMessage(await forgotPassword(email.trim()))
    } catch (err) {
      setServerError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (doneMessage) {
    return (
      <section className="card auth-card">
        <h1>Check your email</h1>
        <p role="status">{doneMessage}</p>
        <p>The link is valid for 1 hour.</p>
        <Link className="btn" to="/login">Back to log in</Link>
      </section>
    )
  }

  return (
    <section className="card auth-card">
      <h1>Forgot your password?</h1>
      <p>Enter your email and we will send you a link to choose a new one.</p>
      <form onSubmit={onSubmit} noValidate>
        <FormField id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
        {serverError && <p className="form-error" role="alert">{serverError}</p>}
        <button className="btn btn--block" type="submit" disabled={submitting}>
          {submitting ? 'Sending...' : 'Send reset link'}
        </button>
      </form>
      <p className="auth-card__alt"><Link to="/login">Back to log in</Link></p>
    </section>
  )
}
