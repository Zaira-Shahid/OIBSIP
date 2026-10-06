import { useCallback, useEffect, useMemo, useState } from 'react'
import { AuthContext } from './authContext'
import { getStoredToken, setUnauthorizedHandler, storeToken } from '../services/api'
import { fetchCurrentUser, loginAdmin, loginUser, registerUser } from '../services/authService'

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // Only "loading" at startup when a stored token has to be checked with the server.
  const [loading, setLoading] = useState(() => Boolean(getStoredToken()))

  const logout = useCallback(() => {
    storeToken(null)
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    if (!getStoredToken()) return undefined
    let cancelled = false
    fetchCurrentUser()
      .then((u) => !cancelled && setUser(u))
      .catch(() => !cancelled && logout())
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [logout])

  // One shared session: signing in as admin replaces a customer session in the same browser profile.
  const signInWith = useCallback((request) => async (credentials) => {
    const { token, user: u } = await request(credentials)
    storeToken(token)
    setUser(u)
    return u
  }, [])
  const login = useMemo(() => signInWith(loginUser), [signInWith])
  const adminLogin = useMemo(() => signInWith(loginAdmin), [signInWith])

  const value = useMemo(
    () => ({ user, loading, isAuthenticated: Boolean(user), isAdmin: user?.role === 'admin', login, adminLogin, register: registerUser, logout }),
    [user, loading, login, adminLogin, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
