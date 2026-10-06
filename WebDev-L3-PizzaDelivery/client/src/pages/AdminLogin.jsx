import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import FormField from '../components/FormField'
import useAuth from '../hooks/useAuth'
import { getErrorMessage } from '../services/api'
import { validateLogin } from '../utils/validation'

// Staff only. There is deliberately no sign-up here; the admin account is created with `npm run seed:admin`.
export default function AdminLogin() {
  const { adminLogin, isAuthenticated, isAdmin, user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (isAdmin) return <Navigate to="/admin/dashboard" replace />

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    setServerError('')
    const found = validateLogin(form)
    setErrors(found)
    if (Object.keys(found).length) return
    setSubmitting(true)
    try {
      await adminLogin({ email: form.email.trim(), password: form.password })
      navigate('/admin/dashboard', { replace: true })
    } catch (err) {
      setServerError(getErrorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <section className="card auth-card">
      <h1>Staff login</h1>
      <p className="field__hint">For restaurant staff only. Customers log in from the main Log in page.</p>
      {isAuthenticated && (
        <p className="notice card" role="status">
          You are signed in as a customer ({user.name}). Signing in as staff replaces that session in this browser
          window. To use both at once, open the admin in a private/incognito window.
        </p>
      )}
      <form onSubmit={onSubmit} noValidate>
        <FormField id="email" label="Email" type="email" autoComplete="username" value={form.email} onChange={onChange} error={errors.email} />
        <FormField id="password" label="Password" type="password" autoComplete="current-password" value={form.password} onChange={onChange} error={errors.password} />
        {serverError && <p className="form-error" role="alert">{serverError}</p>}
        <button className="btn btn--block" type="submit" disabled={submitting}>
          {submitting ? 'Logging in...' : 'Log in as staff'}
        </button>
      </form>
      <p className="auth-card__alt"><Link to="/login">Customer login</Link></p>
    </section>
  )
}
