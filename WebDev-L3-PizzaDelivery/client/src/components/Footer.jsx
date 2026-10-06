import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        OIBSIP Web Development &amp; Designing - Level 3 - Pizza Delivery
        {' · '}
        <Link to="/admin/login">Staff login</Link>
      </div>
    </footer>
  )
}
