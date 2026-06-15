import { createContext, useContext, useEffect, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { authApi } from "@/api"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null) // { email, is_admin }
  // load only while verifying an existing token; with no token we're already settled
  const [loading, setLoading] = useState(() => !!localStorage.getItem("access"))

  // on load, if we have a token, fetch identity
  useEffect(() => {
    if (!localStorage.getItem("access")) return
    authApi
      .me()
      .then((r) => setUser(r.data))
      .catch(() => {
        localStorage.removeItem("access")
        localStorage.removeItem("refresh")
      })
      .finally(() => setLoading(false))
  }, [])

  const persist = (data) => {
    localStorage.setItem("access", data.access)
    localStorage.setItem("refresh", data.refresh)
  }

  const login = async (email, password) => {
    const { data } = await authApi.login(email, password)
    persist(data)
    const me = await authApi.me()
    setUser(me.data)
  }

  const register = async (email, password) => {
    const { data } = await authApi.register(email, password) // returns tokens (auto-login)
    persist(data)
    setUser({ email: data.email, is_admin: data.is_admin })
  }

  const logout = () => {
    localStorage.removeItem("access")
    localStorage.removeItem("refresh")
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}
