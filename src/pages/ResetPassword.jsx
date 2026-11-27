import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"

export default function ResetPassword() {
  const { user, loading } = useAuth()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    document.title = "Reset password | Asterisco"
  }, [])

  async function handleResetRequest(event) {
    event.preventDefault()
    setFeedback(null)

    if (!supabase) {
      setFeedback({
        type: "error",
        message: "Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to reset your password.",
      })
      return
    }

    const formData = new FormData(event.currentTarget)
    setIsSubmitting(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.get("email"), {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setFeedback({
        type: "success",
        message: "If an account exists for this email, we’ll send a password reset link.",
      })
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to send a password reset link.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFeedback(null)

    if (!user || !supabase) {
      setFeedback({ type: "error", message: "This password reset link is invalid or has expired." })
      return
    }

    const formData = new FormData(event.currentTarget)
    const password = formData.get("password")
    const confirmPassword = formData.get("confirmPassword")
    if (password !== confirmPassword) {
      setFeedback({ type: "error", message: "The passwords do not match." })
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setFeedback({ type: "success", message: "Your password was updated." })
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Unable to update your password.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-12 text-[#202522] dark:bg-[#101311] dark:text-[#f1f3f1]">
      <section className="w-full max-w-[440px] rounded-2xl border border-[#edf0ed] bg-white p-7 shadow-[0_8px_24px_-16px_rgba(27,56,37,0.18)] dark:border-[#2b312d] dark:bg-[#171b18] sm:p-9">
        <div className="mb-7 text-center">
          <h1 className="text-[28px] font-semibold tracking-[-0.055em]">
            {user ? "Set a new password" : "Reset your password"}
          </h1>
          <p className="page-description mt-2 text-sm leading-6 text-[#737b75] dark:text-[#a3ada6]">
            {user
              ? "Choose a new password for your asterisco account."
              : "Enter your email and we’ll send you a password reset link."}
          </p>
        </div>

        {loading ? (
          <p className="text-center text-sm text-[#737b75] dark:text-[#a3ada6]">Checking your reset link...</p>
        ) : user ? (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[#303833] dark:text-[#d4dbd6]" htmlFor="password">
                New password
              </label>
              <div className="relative">
                <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-[#929a94]" />
                <Input
                  autoComplete="new-password"
                  className="h-11 rounded-2xl border-[#e3e8e4] px-10 text-sm dark:border-[#343c36] dark:bg-[#1d221f] dark:text-[#f1f3f1]"
                  id="password"
                  minLength={8}
                  name="password"
                  required
                  type={showPassword ? "text" : "password"}
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
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[#303833] dark:text-[#d4dbd6]" htmlFor="confirmPassword">
                Confirm new password
              </label>
              <div className="relative">
                <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-[#929a94]" />
                <Input
                  autoComplete="new-password"
                  className="h-11 rounded-2xl border-[#e3e8e4] px-10 text-sm dark:border-[#343c36] dark:bg-[#1d221f] dark:text-[#f1f3f1]"
                  id="confirmPassword"
                  minLength={8}
                  name="confirmPassword"
                  required
                  type={showConfirmPassword ? "text" : "password"}
                />
                <button
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-[#16803c] transition-colors hover:bg-[#edf8f0] hover:text-[#073b24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16803c] dark:text-[#9bd9ad] dark:hover:text-[#3ecf8e]"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  type="button"
                >
                  {showConfirmPassword
                    ? <EyeOff aria-hidden="true" className="size-[17px]" />
                    : <Eye aria-hidden="true" className="size-[17px]" />}
                </button>
              </div>
            </div>
            {feedback && (
              <p
                aria-live="polite"
                className={`rounded-lg px-3.5 py-3 text-sm ${
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
              {isSubmitting ? "Updating password..." : "Update password"}
            </Button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleResetRequest}>
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-[#303833] dark:text-[#d4dbd6]" htmlFor="email">
                Email
              </label>
              <div className="relative">
                <Mail aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-[#929a94]" />
                <Input
                  autoComplete="email"
                  className="h-11 rounded-2xl border-[#e3e8e4] pl-10 text-sm dark:border-[#343c36] dark:bg-[#1d221f] dark:text-[#f1f3f1]"
                  id="email"
                  name="email"
                  placeholder="you@example.com"
                  required
                  type="email"
                />
              </div>
            </div>
            {feedback && (
              <p
                aria-live="polite"
                className={`rounded-lg px-3.5 py-3 text-sm ${
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
              {isSubmitting ? "Sending reset link..." : "Send reset link"}
            </Button>
            <p className="text-center text-xs text-[#737b75] dark:text-[#a3ada6]">
              Remembered your password?{" "}
              <Link className="font-medium underline underline-offset-2" to="/login">
                Return to sign in
              </Link>
            </p>
          </form>
        )}
      </section>
    </main>
  )
}
