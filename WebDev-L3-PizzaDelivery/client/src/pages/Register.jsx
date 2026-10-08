import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import FormField from '../components/FormField'
import useAuth from '../hooks/useAuth'
import { getErrorMessage } from '../services/api'
import { PASSWORD_MESSAGE, validateRegister } from '../utils/validation'

const EMPTY = { name: '', email: '', password: '', confirmPassword: '' }

export default function Register() {
  const { register, isAuthenticated } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  async function onSubmit(e) {
    e.preventDefault()
    setServerError('')
    const found = validateRegister(form)
    setErrors(found)
    if (Object.keys(found).length) return
    setSubmitting(true)
    try {
      const data = await register({ name: form.name.trim(), email: form.email.trim(), password: form.password })
      setResult(data)
    } catch (err) {
      setServerError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <section className="card auth-card">
        <h1>Account created</h1>
        <p role="status">
          {result.emailSent
            ? `We sent a verification link to ${result.user.email}. Open it to activate your account (the link is valid for 24 hours).`
            : 'Your account was created, but we could not send the verification email. Go to log in and choose "Resend verification email".'}
        </p>
        <Link className="btn" to="/login">Go to log in</Link>
      </section>
    )
  }

  return (
    <section className="card auth-card">
      <h1>Create your account</h1>
      <form onSubmit={onSubmit} noValidate>
        <FormField id="name" label="Full name" autoComplete="name" value={form.name} onChange={onChange} error={errors.name} />
        <FormField id="email" label="Email" type="email" autoComplete="email" value={form.email} onChange={onChange} error={errors.email} />
        <FormField id="password" label="Password" type="password" autoComplete="new-password" value={form.password} onChange={onChange} error={errors.password} hint={PASSWORD_MESSAGE} />
        <FormField id="confirmPassword" label="Confirm password" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={onChange} error={errors.confirmPassword} />
        {serverError && <p className="form-error" role="alert">{serverError}</p>}
        <button className="btn btn--block" type="submit" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Create account'}
        </button>
      </form>
      <p className="auth-card__alt">Already have an account? <Link to="/login">Log in</Link></p>
    </section>
  )
}
