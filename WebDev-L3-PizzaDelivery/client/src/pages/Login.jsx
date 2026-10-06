import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import FormField from '../components/FormField'
import useAuth from '../hooks/useAuth'
import { getErrorMessage } from '../services/api'
import { resendVerification } from '../services/authService'
import { validateLogin } from '../utils/validation'

export default function Login() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = location.state?.from || '/dashboard'
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resendState, setResendState] = useState({ status: 'idle', message: '' })

  if (isAuthenticated) return <Navigate to={redirectTo} replace />

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    setServerError('')
    setNeedsVerification(false)
    setResendState({ status: 'idle', message: '' })
    const found = validateLogin(form)
    setErrors(found)
    if (Object.keys(found).length) return
    setSubmitting(true)
    try {
      await login({ email: form.email.trim(), password: form.password })
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setServerError(getErrorMessage(err))
      setNeedsVerification(err.response?.data?.code === 'EMAIL_NOT_VERIFIED')
      setSubmitting(false)
    }
  }

  async function onResend() {
    setResendState({ status: 'sending', message: '' })
    try {
      setResendState({ status: 'done', message: await resendVerification(form.email.trim()) })
    } catch (err) {
      setResendState({ status: 'error', message: getErrorMessage(err) })
    }
  }

  return (
    <section className="card auth-card">
      <h1>Log in</h1>
      <form onSubmit={onSubmit} noValidate>
        <FormField id="email" label="Email" type="email" autoComplete="email" value={form.email} onChange={onChange} error={errors.email} />
        <FormField id="password" label="Password" type="password" autoComplete="current-password" value={form.password} onChange={onChange} error={errors.password} />
        {serverError && <p className="form-error" role="alert">{serverError}</p>}
        {needsVerification && (
          <div className="notice">
            <button type="button" className="btn btn--ghost" onClick={onResend} disabled={resendState.status === 'sending'}>
              {resendState.status === 'sending' ? 'Sending...' : 'Resend verification email'}
            </button>
            {resendState.message && (
              <p role={resendState.status === 'error' ? 'alert' : 'status'}>{resendState.message}</p>
            )}
          </div>
        )}
        <button className="btn btn--block" type="submit" disabled={submitting}>
          {submitting ? 'Logging in...' : 'Log in'}
        </button>
      </form>
      <p className="auth-card__alt"><Link to="/forgot-password">Forgot your password?</Link></p>
      <p className="auth-card__alt">New here? <Link to="/register">Create an account</Link></p>
    </section>
  )
}
