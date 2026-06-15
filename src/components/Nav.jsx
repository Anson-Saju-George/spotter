import { NavLink, useNavigate } from "react-router-dom"
import { LogOut } from "lucide-react"
import Logo from "@/components/Logo"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/auth"

export default function Nav() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const linkClass = ({ isActive }) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? "bg-primary/20 text-primary"
        : "text-secondary-foreground/70 hover:text-secondary-foreground"
    }`

  return (
    <header className="sticky top-0 z-20 border-b border-black/20 bg-secondary text-secondary-foreground print:hidden">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
        <Logo />
        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={linkClass}>
            Planner
          </NavLink>
          <NavLink to="/trips" className={linkClass}>
            My Trips
          </NavLink>
        </nav>
        <div className="flex items-center gap-3">
          <span className="text-xs text-secondary-foreground/60 hidden sm:block">
            {user?.email}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              logout()
              navigate("/login")
            }}
            className="text-secondary-foreground hover:bg-white/10"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  )
}
