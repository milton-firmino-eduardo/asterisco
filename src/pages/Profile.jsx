import { useEffect, useState } from "react"
import { Link, Navigate } from "react-router-dom"
import { ArrowLeft, LoaderCircle, UserRound } from "lucide-react"
import AvatarPicker from "@/components/AvatarPicker"
import { useAuth } from "@/contexts/AuthContext"
import { supabase } from "@/lib/supabase"
import { isLocalPreview } from "@/lib/environment"

export default function Profile() {
  const { user, loading } = useAuth()
  const [profile, setProfile] = useState(() => (isLocalPreview ? { avatar_url: null } : null))
  const [profileLoading, setProfileLoading] = useState(!isLocalPreview)
  const [error, setError] = useState("")

  useEffect(() => {
    document.title = "Manage profile | Asterisco"
  }, [])

  useEffect(() => {
    if (loading) return undefined

    if (!user) return undefined

    if (!supabase) {
      setError("Supabase is not configured.")
      setProfileLoading(false)
      return undefined
    }

    let active = true
    setProfileLoading(true)
    supabase
      .from("profiles")
      .select("username, display_name, bio, avatar_url")
      .eq("id", user.id)
      .single()
      .then(({ data, error: loadError }) => {
        if (!active) return
        if (loadError) {
          setError(loadError.message)
          return
        }
        setProfile(data)
        setError("")
      })
      .catch((loadError) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Could not load your profile.")
        }
      })
      .finally(() => {
        if (active) setProfileLoading(false)
      })

    return () => {
      active = false
    }
  }, [loading, user])

  if (!loading && !user && !isLocalPreview) return <Navigate to="/login" replace />

  const username = profile?.username || user?.user_metadata?.username || ""

  return (
    <main className="min-h-svh bg-white text-[#242424]">
      <header className="flex h-14 items-center border-b border-[#f0f0f0] px-4 sm:px-6">
        <Link
          aria-label="Back to home"
          className="flex size-9 items-center justify-center rounded-full text-[#555] hover:bg-[#f5f8f6] focus-visible:outline-2 focus-visible:outline-[#3ecf8e]"
          to="/home"
        >
          <ArrowLeft aria-hidden="true" className="size-5" />
        </Link>
        <h1 className="ml-3 text-[15px] font-semibold">Manage profile</h1>
      </header>

      <section className="mx-auto w-full max-w-[520px] px-5 py-8 sm:px-8">
        {profileLoading ? (
          <div className="flex min-h-40 items-center justify-center text-[#8a928c]">
            <LoaderCircle aria-label="Loading profile" className="size-6 animate-spin" />
          </div>
        ) : (
          <>
            <AvatarPicker
              avatarUrl={profile?.avatar_url ?? null}
              onAvatarChange={(nextAvatarUrl) => setProfile((current) => ({
                ...current,
                avatar_url: nextAvatarUrl,
              }))}
              preview={isLocalPreview}
              userId={user?.id}
            />

            <div className="mt-5 text-center">
              <h2 className="text-base font-semibold">{username ? `@${username}` : "Your profile"}</h2>
              <p className="mt-1 text-sm text-[#737b75]">{user?.email || ""}</p>
            </div>

            <div className="mt-8 border-t border-[#edf0ed] pt-5">
              <div className="flex items-start gap-3">
                <UserRound aria-hidden="true" className="mt-0.5 size-[18px] text-[#858d88]" />
                <div>
                  <p className="text-sm font-medium">Profile photo</p>
                  <p className="mt-1 text-xs leading-5 text-[#858d88]">
                    Choose one of the defaults or upload a JPG, PNG or WebP up to 1MB.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <p aria-live="polite" className="mt-5 rounded-xl bg-[#fff1f0] px-3 py-2 text-xs text-[#b42318]" role="alert">
                {error}
              </p>
            )}
          </>
        )}
      </section>
    </main>
  )
}
