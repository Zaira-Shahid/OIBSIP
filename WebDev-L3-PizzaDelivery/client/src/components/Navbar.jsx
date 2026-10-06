import { Link, NavLink } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

export default function Navbar() {
  const { user, isAuthenticated, loading, logout } = useAuth()

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <Link to="/" className="brand" aria-label="Slice & Co. home">
          <span aria-hidden="true">🍕</span> Slice &amp; Co.
        </Link>
        <nav aria-label="Main" className="nav">
          <NavLink to="/" end className="nav-link">Home</NavLink>
          {!loading && isAuthenticated && (
            <>
              <NavLink to="/dashboard" className="nav-link">Dashboard</NavLink>
              <span className="nav-user">Hi, {user.name.split(' ')[0]}</span>
              <button type="button" className="btn btn--ghost" onClick={logout}>Log out</button>
            </>
          )}
          {!loading && !isAuthenticated && (
            <>
              <NavLink to="/login" className="nav-link">Log in</NavLink>
              <Link to="/register" className="btn">Sign up</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
