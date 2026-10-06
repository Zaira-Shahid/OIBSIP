import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import FormField from '../components/FormField'
import { getErrorMessage } from '../services/api'
import { resetPassword } from '../services/authService'
import { PASSWORD_MESSAGE, validatePasswordPair } from '../utils/validation'

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [form, setForm] = useState({ password: '', confirmPassword: '' })
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [doneMessage, setDoneMessage] = useState('')

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }))

  if (!token) {
    return (
      <section className="card auth-card">
        <h1>Reset password</h1>
        <p className="form-error" role="alert">This link is incomplete. Please use the link from your email, or request a new one.</p>
        <Link className="btn" to="/forgot-password">Request a new link</Link>
      </section>
    )
  }

  async function onSubmit(e) {
    e.preventDefault()
    setServerError('')
    const found = validatePasswordPair(form)
    setErrors(found)
    if (Object.keys(found).length) return
    setSubmitting(true)
    try {
      setDoneMessage(await resetPassword({ token, password: form.password }))
    } catch (err) {
      setServerError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (doneMessage) {
    return (
      <section className="card auth-card">
        <h1>Password updated</h1>
        <p role="status">{doneMessage}</p>
        <Link className="btn" to="/login">Log in</Link>
      </section>
    )
  }

  return (
    <section className="card auth-card">
      <h1>Choose a new password</h1>
      <form onSubmit={onSubmit} noValidate>
        <FormField id="password" label="New password" type="password" autoComplete="new-password" value={form.password} onChange={onChange} error={errors.password} hint={PASSWORD_MESSAGE} />
        <FormField id="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={onChange} error={errors.confirmPassword} />
        {serverError && (
          <p className="form-error" role="alert">
            {serverError} <Link to="/forgot-password">Request a new link</Link>
          </p>
        )}
        <button className="btn btn--block" type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Reset password'}
        </button>
      </form>
    </section>
  )
}
