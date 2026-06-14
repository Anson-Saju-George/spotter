import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { motion } from "motion/react"
import Logo from "@/components/Logo"
import TruckArt from "@/components/TruckArt"
import { useAuth } from "@/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const email = z.string().email("Enter a valid email")

// Login and Register are the same form; only the copy + password rule differ.
const MODES = {
  login: {
    schema: z.object({ email, password: z.string().min(1, "Password is required") }),
    title: "Sign in",
    description: "Plan trips and draw your ELD logs.",
    submit: "Sign in",
    pending: "Signing in…",
    success: "Welcome back!",
    error: "Invalid email or password",
    passwordPlaceholder: "••••••••",
    footer: { text: "No account?", linkLabel: "Create one", to: "/register" },
  },
  register: {
    schema: z.object({ email, password: z.string().min(6, "At least 6 characters") }),
    title: "Create account",
    description: "Start planning HOS-compliant trips.",
    submit: "Create account",
    pending: "Creating…",
    success: "Account created!",
    error: "Could not create account",
    passwordPlaceholder: "At least 6 characters",
    footer: { text: "Already have an account?", linkLabel: "Sign in", to: "/login" },
  },
}

export default function AuthForm({ mode }) {
  const cfg = MODES[mode]
  const { login, register: registerUser } = useAuth()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(cfg.schema) })

  const onSubmit = async ({ email, password }) => {
    try {
      await (mode === "login" ? login : registerUser)(email, password)
      toast.success(cfg.success)
      navigate("/")
    } catch (e) {
      toast.error(e.response?.data?.detail || cfg.error)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        <div className="mb-5 overflow-hidden rounded-2xl border bg-gradient-to-b from-amber-50 to-card p-5 text-center shadow-sm">
          <div className="flex justify-center">
            <Logo size="lg" />
          </div>
          <TruckArt className="mx-auto mt-3 h-20 w-auto" />
          <p className="mt-2 text-sm text-muted-foreground">
            Plan HOS-compliant trips & auto-draw your ELD logs.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{cfg.title}</CardTitle>
            <CardDescription>{cfg.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" {...register("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={cfg.passwordPlaceholder}
                  {...register("password")}
                />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? cfg.pending : cfg.submit}
              </Button>
            </form>
            <p className="text-sm text-muted-foreground text-center mt-4">
              {cfg.footer.text}{" "}
              <Link to={cfg.footer.to} className="text-primary font-medium hover:underline">
                {cfg.footer.linkLabel}
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
