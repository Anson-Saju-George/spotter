import { useEffect } from "react"
import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { AnimatePresence } from "motion/react"
import { useAuth, ProtectedRoute } from "@/auth"
import Nav from "@/components/Nav"
import AuthForm from "@/components/AuthForm"
import Planner from "@/components/Planner"
import MyTrips from "@/components/MyTrips"

export default function App() {
  const { user } = useAuth()
  const location = useLocation()

  // keep the trailing slash on the base path in the URL bar (/spotter -> /spotter/)
  useEffect(() => {
    const base = import.meta.env.BASE_URL.replace(/\/+$/, "") // "/spotter"
    if (base && window.location.pathname === base) {
      window.history.replaceState(
        window.history.state,
        "",
        base + "/" + window.location.search + window.location.hash
      )
    }
  }, [location])

  return (
    <div className="min-h-screen flex flex-col">
      {user && <Nav />}
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/login" element={<AuthForm mode="login" />} />
          <Route path="/register" element={<AuthForm mode="register" />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Planner />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trips"
            element={
              <ProtectedRoute>
                <MyTrips />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </div>
  )
}
