import { Link, NavLink } from 'react-router-dom'

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="container navbar__inner">
        <Link to="/" className="brand" aria-label="Slice & Co. home">
          <span aria-hidden="true">🍕</span> Slice &amp; Co.
        </Link>
        <nav aria-label="Main">
          <NavLink to="/" end className="nav-link">
            Home
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
