import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/AuthContext"
import { Input } from "@/components/ui/input"
import { isDmUsernameAvailable } from "@/lib/directMessages"
import { supabase } from "@/lib/supabase"

const ageGroups = [
  { maxAge: 12, label: "Under 13" },
  { maxAge: 15, label: "13–15" },
  { maxAge: 17, label: "16–17" },
  { maxAge: Infinity, label: "18+" },
]

const countryCodes = `
  AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
  BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
  CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
  DE DJ DK DM DO DZ
  EC EE EG EH ER ES ET
  FI FJ FK FM FO FR
  GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
  HK HM HN HR HT HU
  ID IE IL IM IN IO IQ IR IS IT
  JE JM JO JP
  KE KG KH KI KM KN KP KR KW KY KZ
  LA LB LC LI LK LR LS LT LU LV LY
  MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
  NA NC NE NF NG NI NL NO NP NR NU NZ
  OM
  PA PE PF PG PH PK PL PM PN PR PS PT PW PY
  QA
  RE RO RS RU RW
  SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
  TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
  UA UG UM US UY UZ
  VA VC VE VG VI VN VU
  WF WS
  YE YT
  ZA ZM ZW
`.trim().split(/\s+/)

const countryNames = new Intl.DisplayNames(["en"], { type: "region" })
const countryOptions = countryCodes
  .map((code) => ({ code, name: countryNames.of(code) }))
  .filter(({ name }) => name)
  .sort((first, second) => first.name.localeCompare(second.name))

function getAgeGroup(birthDateValue) {
  const birthDate = new Date(`${birthDateValue}T00:00:00`)
  const today = new Date()

  if (Number.isNaN(birthDate.getTime()) || birthDate > today) return null

  let age = today.getFullYear() - birthDate.getFullYear()
  const birthdayHasNotPassed = today.getMonth() < birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
  if (birthdayHasNotPassed) age -= 1

  return ageGroups.find((group) => age <= group.maxAge)?.label ?? null
}

function getTodayDateValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export default function Signup() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState("eligibility")
  const [country, setCountry] = useState("")
  const [birthDate, setBirthDate] = useState("")
  const [ageGroup, setAgeGroup] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    document.title = "Create account | Asterisco"
  }, [])

  useEffect(() => {
    if (user) navigate("/home", { replace: true })
  }, [navigate, user])

  function handleEligibilitySubmit(event) {
    event.preventDefault()
    setFeedback(null)

    const calculatedAgeGroup = getAgeGroup(birthDate)
    if (!country.trim() || !calculatedAgeGroup) {
      setFeedback({
        type: "error",
        message: "Select your country and enter a valid date of birth.",
      })
      return
    }

    setAgeGroup(calculatedAgeGroup)
    setStep("account")
  }

  async function handleSignup(event) {
    event.preventDefault()
    setFeedback(null)

    if (!supabase) {
      setFeedback({
        type: "error",
        message: "Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable signup.",
      })
      return
    }

    const form = event.currentTarget
    const formData = new FormData(form)
    const email = String(formData.get("email") ?? "")
    const username = String(formData.get("username") ?? "").trim()
    const password = String(formData.get("password") ?? "")

    if (!username || username.length > 64) {
      setFeedback({
        type: "error",
        message: "Choose a username between 1 and 64 characters.",
      })
      return
    }

    setIsSubmitting(true)
    try {
      const usernameAvailable = await isDmUsernameAvailable(username)
      if (!usernameAvailable) {
        setFeedback({
          type: "error",
          message: "That username is already taken. Choose another one.",
        })
        return
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirmed`,
          data: {
            username,
            country_code: country,
            birth_date: birthDate,
          },
        },
      })

      if (error) throw error

      if (data.session) {
        setFeedback({
          type: "success",
          message: "Your account has been created.",
        })
        form.reset()
        return
      }

      setFeedback({
        type: "success",
        message: `We sent a confirmation link to ${email}.`,
      })
      form.reset()
    } catch (error) {
      setFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "We couldn't create your account. Please try again.",
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
              {step === "eligibility" ? "Let’s get started" : "Create your account"}
            </h1>
            <p className="page-description mt-2 text-sm leading-6 text-[#737b75] dark:text-[#a3ada6]">
              {step === "eligibility"
                ? "First, tell us where you live and your date of birth."
                : "Choose a username and your sign-in details."}
            </p>
            <p className="mt-3 text-xs text-[#8a928c] dark:text-[#89938c]">
              Step {step === "eligibility" ? "1" : "2"} of 2
            </p>
          </div>

          {step === "eligibility" ? (
            <form className="space-y-4" onSubmit={handleEligibilitySubmit}>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-[#303833] dark:text-[#d4dbd6]" htmlFor="country">
                  Country of residence
                </label>
                <select
                  autoComplete="country-name"
                  className="h-11 w-full rounded-2xl border border-[#e3e8e4] bg-white px-3 text-sm text-[#202522] focus-visible:border-[#3ecf8e] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#3ecf8e]/20 dark:border-[#343c36] dark:bg-[#1d221f] dark:text-[#f1f3f1]"
                  id="country"
                  onChange={(event) => setCountry(event.target.value)}
                  required
                  value={country}
                >
                  <option disabled value="">
                    Select your country
                  </option>
                  {countryOptions.map(({ code, name }) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[13px] font-medium text-[#303833] dark:text-[#d4dbd6]" htmlFor="birthDate">
                  Date of birth
                </label>
                <Input
                  autoComplete="bday"
                  className="h-11 rounded-2xl border-[#e3e8e4] text-sm focus-visible:border-[#3ecf8e] focus-visible:ring-[#3ecf8e]/20 dark:border-[#343c36] dark:bg-[#1d221f] dark:text-[#f1f3f1]"
                  id="birthDate"
                  max={getTodayDateValue()}
                  onChange={(event) => setBirthDate(event.target.value)}
                  required
                  type="date"
                  value={birthDate}
                />
                <p className="page-description text-xs leading-5 text-[#8a928c] dark:text-[#89938c]">
                  Your country and date of birth are saved in your Supabase account metadata.
                </p>
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
                className="h-11 w-full rounded-2xl bg-[#3ecf8e] text-sm font-semibold text-[#073b24] shadow-sm transition-colors hover:bg-[#32bd80] focus-visible:ring-[#3ecf8e]/30"
                type="submit"
              >
                Continue
                <ArrowRight aria-hidden="true" className="ml-1 size-4" />
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-[#f7f9f7] px-3.5 py-3 text-sm leading-5 text-[#536057] dark:bg-[#1d221f] dark:text-[#b6c0b9]">
                <p>
                  Preliminary age group: <strong>{ageGroup}</strong>
                </p>
                <p className="page-description mt-1 text-xs">
                  Based on your entry; age is not verified.
                </p>
              </div>

              <form className="space-y-4" onSubmit={handleSignup}>
                <fieldset className="space-y-4">
                <legend className="sr-only">Account details</legend>
                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-[#303833] dark:text-[#d4dbd6]" htmlFor="username">
                    Username
                  </label>
                  <div className="relative">
                    <UserRound aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-[#929a94]" />
                    <Input
                      autoComplete="username"
                      className="h-11 rounded-2xl border-[#e3e8e4] pl-10 text-sm placeholder:text-[#a1a8a3] dark:border-[#343c36] dark:bg-[#1d221f] dark:text-[#f1f3f1] dark:placeholder:text-[#87918a]"
                      id="username"
                      maxLength={64}
                      minLength={1}
                      name="username"
                      placeholder="Choose a username"
                      required
                    />
                  </div>
                  <p className="text-xs text-[#8a928c] dark:text-[#89938c]">
                    Usernames are unique, ignoring letter case.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[13px] font-medium text-[#303833] dark:text-[#d4dbd6]" htmlFor="email">
                    Email
                  </label>
                  <div className="relative">
                    <Mail aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-[#929a94]" />
                    <Input
                      autoComplete="email"
                      className="h-11 rounded-2xl border-[#e3e8e4] pl-10 text-sm placeholder:text-[#a1a8a3] dark:border-[#343c36] dark:bg-[#1d221f] dark:text-[#f1f3f1] dark:placeholder:text-[#87918a]"
                      id="email"
                      name="email"
                      placeholder="you@example.com"
                      required
                      type="email"
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
                      autoComplete="new-password"
                      className="h-11 rounded-2xl border-[#e3e8e4] px-10 text-sm placeholder:text-[#a1a8a3] dark:border-[#343c36] dark:bg-[#1d221f] dark:text-[#f1f3f1] dark:placeholder:text-[#87918a]"
                      id="password"
                      minLength={8}
                      name="password"
                      placeholder="At least 8 characters"
                      required
                      type={showPassword ? "text" : "password"}
                    />
                    <button
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-[#16803c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16803c] dark:text-[#9bd9ad]"
                      onClick={() => setShowPassword((visible) => !visible)}
                      type="button"
                    >
                      {showPassword
                        ? <EyeOff aria-hidden="true" className="size-[17px]" />
                        : <Eye aria-hidden="true" className="size-[17px]" />}
                    </button>
                  </div>
                </div>
                </fieldset>

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
                  className="h-11 w-full rounded-2xl bg-[#3ecf8e] text-sm font-semibold text-[#073b24] shadow-sm transition-colors hover:bg-[#32bd80] focus-visible:ring-[#3ecf8e]/30"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Creating your account..." : "Create account"}
                </Button>
              </form>

              <Button
                className="w-full rounded-2xl border border-[#e3e8e4] bg-transparent text-sm text-[#303833] hover:bg-[#f7f9f7] dark:border-[#343c36] dark:text-[#d4dbd6] dark:hover:bg-[#1d221f]"
                onClick={() => setStep("eligibility")}
                type="button"
                variant="outline"
              >
                <ArrowLeft aria-hidden="true" className="mr-1 size-4" />
                Back to age details
              </Button>
            </div>
          )}

          <p className="mt-5 text-center text-xs text-[#737b75] dark:text-[#a3ada6]">
            Already have an account?{" "}
            <Link className="font-medium text-[#16803c] hover:underline dark:text-[#8bd4a8]" to="/login">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}
