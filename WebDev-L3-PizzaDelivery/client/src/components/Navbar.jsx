import { Link, NavLink } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

export default function Navbar() {
  const { user, isAuthenticated, isAdmin, loading, logout } = useAuth()

  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <Link to="/" className="brand" aria-label="Slice & Co. home">
          <span aria-hidden="true">🍕</span> Slice &amp; Co.
        </Link>
        <nav aria-label="Main" className="nav">
          {!isAdmin && <NavLink to="/" end className="nav-link">Home</NavLink>}
          {!loading && isAdmin && (
            <>
              <NavLink to="/admin/dashboard" className="nav-link">Admin dashboard</NavLink>
              <span className="nav-user">Admin: {user.name}</span>
              <button type="button" className="btn btn--ghost" onClick={logout}>Log out</button>
            </>
          )}
          {!loading && isAuthenticated && !isAdmin && (
            <>
              <NavLink to="/dashboard" className="nav-link">Dashboard</NavLink>
              <NavLink to="/orders" className="nav-link">My orders</NavLink>
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
