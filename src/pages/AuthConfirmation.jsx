import { useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useAuth } from "@/contexts/AuthContext"

export default function AuthConfirmation() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const isConfirmed = Boolean(user?.email_confirmed_at || user?.confirmed_at)

  useEffect(() => {
    document.title = isConfirmed ? "Email confirmed | Asterisco" : "Confirm account | Asterisco"
  }, [isConfirmed])

  useEffect(() => {
    if (loading || !isConfirmed) return

    const timeoutId = window.setTimeout(() => {
      navigate("/login?confirmed=1", { replace: true })
    }, 3000)

    return () => window.clearTimeout(timeoutId)
  }, [isConfirmed, loading, navigate])

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-12 text-[#202522] dark:bg-[#101311] dark:text-[#f1f3f1]">
      <section className="w-full max-w-[440px] text-center">
        {loading ? (
          <>
            <h1 className="text-[28px] font-semibold tracking-[-0.055em]">Confirming your account</h1>
            <p className="page-description mt-2 text-sm leading-6 text-[#737b75] dark:text-[#a3ada6]">
              Please wait while we verify your confirmation link.
            </p>
          </>
        ) : isConfirmed ? (
          <>
            <h1 className="text-[28px] font-semibold tracking-[-0.055em]">Email confirmed</h1>
            <p className="page-description mt-2 text-sm leading-6 text-[#737b75] dark:text-[#a3ada6]">
              Your asterisco account is confirmed. Redirecting you to sign in...
            </p>
          </>
        ) : (
          <>
            <h1 className="text-[28px] font-semibold tracking-[-0.055em]">Confirmation not completed</h1>
            <p className="page-description mt-2 text-sm leading-6 text-[#737b75] dark:text-[#a3ada6]">
              This link expired or was used.
            </p>
          </>
        )}

        <p className="page-description mt-6 text-xs leading-6 text-[#737b75] dark:text-[#a3ada6] sm:text-sm">
          Redirect stuck? Refresh or open{" "}
          <Link className="font-medium text-[#16803c] hover:underline dark:text-[#8bd4a8]" to="/login">
            sign in
          </Link>
          .
        </p>
      </section>
    </main>
  )
}
