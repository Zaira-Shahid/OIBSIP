import useAuth from '../hooks/useAuth'

// Placeholder: the real pizza dashboard is built in Module 4.
export default function Dashboard() {
  const { user } = useAuth()
  return (
    <section className="card auth-card">
      <h1>Welcome, {user.name}</h1>
      <p>You are logged in as {user.email}. The pizza menu and builder arrive in the next modules.</p>
    </section>
  )
}
