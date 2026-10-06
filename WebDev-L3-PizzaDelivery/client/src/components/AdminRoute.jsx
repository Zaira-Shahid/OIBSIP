import { Navigate, Outlet } from 'react-router-dom'
import useAuth from '../hooks/useAuth'

// Client-side convenience only; every /api/admin route is enforced on the server.
export default function AdminRoute() {
  const { isAdmin, loading } = useAuth()

  if (loading) return <p className="center-note" role="status">Checking your session...</p>
  if (!isAdmin) return <Navigate to="/admin/login" replace />
  return <Outlet />
}
