import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"

export default function Login() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(() => (
    searchParams.get("confirmed") === "1"
      ? { type: "success", message: "Your email is confirmed. You can now sign in." }
      : null
  ))

  useEffect(() => {
    document.title = "Sign in | Asterisco"
  }, [])

  useEffect(() => {
    if (user) navigate("/home", { replace: true })
  }, [navigate, user])

  async function handleSubmit(event) {
    event.preventDefault()
    setFeedback(null)

    if (!supabase) {
      setFeedback({
        type: "error",
        message: "Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable login.",
      })
      return
    }

    const formData = new FormData(event.currentTarget)
    setIsSubmitting(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: formData.get("email"),
        password: formData.get("password"),
      })

      if (error) throw error
      setFeedback({ type: "success", message: "Signed in successfully." })
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Invalid email or password.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-12 text-[#202522] dark:bg-[#101311] dark:text-[#f1f3f1]">
      <section className="relative w-full max-w-[440px]">
        <div className="rounded-2xl border border-[#edf0ed] bg-white p-7 shadow-[0_8px_24px_-16px_rgba(27,56,37,0.18)] dark:border-[#2b312d] dark:bg-[#171b18] dark:shadow-[0_8px_24px_-16px_rgba(0,0,0,0.7)] sm:p-9">
          <div className="mb-7 text-center">
            <h1 className="text-[28px] font-semibold tracking-[-0.055em] text-[#202522] dark:text-[#f1f3f1]">
              Sign in
            </h1>
            <p className="page-description mt-2 text-sm leading-6 text-[#737b75] dark:text-[#a3ada6]">
              Sign in to your account to continue.
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[#303833] dark:text-[#d4dbd6]" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-[#929a94]" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="h-11 rounded-2xl border-[#e3e8e4] pl-10 text-sm placeholder:text-[#a1a8a3] focus-visible:border-[#3ecf8e] focus-visible:ring-[#3ecf8e]/20 dark:border-[#343c36] dark:bg-[#1d221f] dark:text-[#f1f3f1] dark:placeholder:text-[#87918a]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[#303833] dark:text-[#d4dbd6]" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-[#929a94]" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  className="h-11 rounded-2xl border-[#e3e8e4] px-10 text-sm placeholder:text-[#a1a8a3] focus-visible:border-[#3ecf8e] focus-visible:ring-[#3ecf8e]/20 dark:border-[#343c36] dark:bg-[#1d221f] dark:text-[#f1f3f1] dark:placeholder:text-[#87918a]"
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-[#16803c] transition-colors hover:bg-[#edf8f0] hover:text-[#073b24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16803c] dark:text-[#9bd9ad] dark:hover:text-[#3ecf8e]"
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  {showPassword
                    ? <EyeOff aria-hidden="true" className="size-[17px]" />
                    : <Eye aria-hidden="true" className="size-[17px]" />}
                </button>
              </div>
            </div>

            {feedback && (
              <p
                aria-live="polite"
                className={`rounded-lg px-3.5 py-3 text-sm leading-5 ${
                  feedback.type === "success"
                    ? "bg-[#edf8f0] text-[#176b36] dark:bg-[#192a20] dark:text-[#9bd9ad]"
                    : "bg-[#fff1f0] text-[#b42318] dark:bg-[#321d1c] dark:text-[#ffb4ad]"
                }`}
                role={feedback.type === "error" ? "alert" : "status"}
              >
                {feedback.message}
              </p>
            )}

            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-11 w-full rounded-2xl bg-[#3ecf8e] text-sm font-semibold text-[#073b24] shadow-sm transition-colors hover:bg-[#32bd80] focus-visible:ring-[#3ecf8e]/30"
            >
              {isSubmitting ? "Signing in..." : "Sign in"}
            </Button>

            <div className="space-y-2 text-center text-xs text-[#737b75] dark:text-[#a3ada6]">
              <p>
                Having trouble signing in?{" "}
                <Link className="font-medium text-[#16803c] hover:underline dark:text-[#8bd4a8]" to="/reset-password">
                  Reset your password
                </Link>
              </p>
              <p>
                New to asterisco?{" "}
                <Link className="font-medium text-[#16803c] hover:underline dark:text-[#8bd4a8]" to="/signup">
                  Create an account
                </Link>
              </p>
            </div>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#edf0ed] dark:bg-[#2b312d]" />
            <span className="text-xs text-[#9aa19c] dark:text-[#89938c]">simple and secure</span>
            <div className="h-px flex-1 bg-[#edf0ed] dark:bg-[#2b312d]" />
          </div>

        </div>
      </section>
    </main>
  )
}
