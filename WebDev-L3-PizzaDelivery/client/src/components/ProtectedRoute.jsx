import { Navigate, Outlet, useLocation } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

// Client-side convenience only; the API enforces access on the server.
export default function ProtectedRoute() {
  const { isAuthenticated, isAdmin, loading } = useAuth()
  const location = useLocation()

  if (loading) return <p className="center-note" role="status">Loading your account...</p>
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  // Staff accounts have their own area; the customer pages are not for them.
  if (isAdmin) return <Navigate to="/admin/dashboard" replace />
  return <Outlet />
}
