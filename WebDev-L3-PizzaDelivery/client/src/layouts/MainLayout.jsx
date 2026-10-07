import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import ErrorBoundary from '../components/ErrorBoundary'
import Footer from '../components/Footer'
import Navbar from '../components/Navbar'
import { titleFor } from '../utils/pageTitle'

export default function MainLayout() {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = titleFor(pathname)
  }, [pathname])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">Skip to main content</a>
      <Navbar />
      <main id="main" tabIndex={-1} className="container main">
        <ErrorBoundary key={pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  )
}
