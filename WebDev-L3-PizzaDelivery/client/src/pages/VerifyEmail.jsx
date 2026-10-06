import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getErrorMessage } from '../services/api'
import { verifyEmail } from '../services/authService'

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [state, setState] = useState(token ? { status: 'loading' } : { status: 'error', message: 'This link is incomplete. Please use the link from your email.' })
  // The token is single-use, so the request must be sent only once (StrictMode runs effects twice in dev).
  const requested = useRef(false)

  useEffect(() => {
    if (!token || requested.current) return
    requested.current = true
    verifyEmail(token)
      .then((message) => setState({ status: 'success', message }))
      .catch((err) => setState({ status: 'error', message: getErrorMessage(err) }))
  }, [token])

  return (
    <section className="card auth-card">
      <h1>Email verification</h1>
      {state.status === 'loading' && <p role="status">Verifying your email...</p>}
      {state.status === 'success' && (
        <>
          <p role="status">{state.message}</p>
          <Link className="btn" to="/login">Log in</Link>
        </>
      )}
      {state.status === 'error' && (
        <>
          <p className="form-error" role="alert">{state.message}</p>
          <p>If you already verified, just log in. Otherwise you can request a new link from the login page.</p>
          <Link className="btn" to="/login">Go to log in</Link>
        </>
      )}
    </section>
  )
}
