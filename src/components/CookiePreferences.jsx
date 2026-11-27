import { useEffect, useState } from "react"
import { useLocation } from "react-router-dom"

const STORAGE_KEY = "asterisco.cookie-preferences"

const defaultPreferences = {
  necessary: true,
  analytics: false,
  personalization: false,
  marketing: false,
}

function isValidPreferences(value) {
  return value
    && value.version === 1
    && value.preferences
    && typeof value.preferences.analytics === "boolean"
    && typeof value.preferences.personalization === "boolean"
    && typeof value.preferences.marketing === "boolean"
}

export default function CookiePreferences() {
  const { pathname } = useLocation()
  const [preferences, setPreferences] = useState(defaultPreferences)
  const [hasSaved, setHasSaved] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isOpen, setIsOpen] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (isValidPreferences(parsed)) {
          setPreferences({ ...parsed.preferences, necessary: true })
          setHasSaved(true)
          setIsOpen(false)
        }
      }
    } catch {
      setError("Cookie preferences could not be loaded from this browser.")
    } finally {
      setIsLoaded(true)
    }
  }, [])

  useEffect(() => {
    function openPreferences() {
      setShowSettings(true)
      setIsOpen(true)
    }

    window.addEventListener("asterisco:open-cookie-preferences", openPreferences)
    return () => window.removeEventListener("asterisco:open-cookie-preferences", openPreferences)
  }, [])

  function savePreferences(nextPreferences) {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, preferences: nextPreferences })
      )
      setPreferences(nextPreferences)
      setHasSaved(true)
      setIsOpen(false)
      setShowSettings(false)
      setError("")
    } catch {
      setError("Cookie preferences could not be saved. Please check your browser settings.")
    }
  }

  if (!isLoaded) return null

  if (!isOpen && hasSaved) {
    if (pathname === "/home") return null

    return (
      <button
        className="fixed bottom-4 right-4 z-50 rounded-2xl border border-[#e3e8e4] bg-white px-3 py-2 text-xs font-medium text-[#303833] shadow-lg hover:bg-[#f7f9f7] dark:border-[#343c36] dark:bg-[#171b18] dark:text-[#d4dbd6] dark:hover:bg-[#1d221f]"
        onClick={() => {
          setShowSettings(true)
          setIsOpen(true)
        }}
        type="button"
      >
        Cookie settings
      </button>
    )
  }

  return (
    <aside
      aria-label="Cookie preferences"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-h-[85vh] max-w-2xl overflow-y-auto rounded-xl border border-[#e3e8e4] bg-white p-5 shadow-xl dark:border-[#343c36] dark:bg-[#171b18]"
    >
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-[#202522] dark:text-[#f1f3f1]">
            Cookie preferences
          </h2>
          <p className="mt-1 text-xs leading-5 text-[#737b75] dark:text-[#a3ada6]">
            Necessary storage keeps the app working. Optional tracking tools are not currently active;
            your choices are saved for when those options are available.
          </p>
        </div>

        {showSettings && (
          <div className="space-y-2 border-y border-[#edf0ed] py-3 text-sm dark:border-[#2b312d]">
            <label className="flex items-center justify-between gap-4 text-[#303833] dark:text-[#d4dbd6]">
              <span>Necessary</span>
              <input checked disabled type="checkbox" className="size-4 accent-[#16803c]" />
            </label>
            {[
              ["analytics", "Analytics"],
              ["personalization", "Personalization"],
              ["marketing", "Marketing"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-4 text-[#303833] dark:text-[#d4dbd6]">
                <span>{label}</span>
                <input
                  checked={preferences[key]}
                  className="size-4 accent-[#16803c]"
                  onChange={(event) => setPreferences((current) => ({
                    ...current,
                    [key]: event.target.checked,
                  }))}
                  type="checkbox"
                />
              </label>
            ))}
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs text-[#b42318] dark:text-[#ffb4ad]">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {!showSettings ? (
            <>
              <button
                className="rounded-2xl border border-[#e3e8e4] px-3 py-2 text-xs font-medium text-[#303833] hover:bg-[#f7f9f7] dark:border-[#343c36] dark:text-[#d4dbd6] dark:hover:bg-[#1d221f]"
                onClick={() => savePreferences(defaultPreferences)}
                type="button"
              >
                Necessary only
              </button>
              <button
                className="rounded-2xl border border-[#e3e8e4] px-3 py-2 text-xs font-medium text-[#303833] hover:bg-[#f7f9f7] dark:border-[#343c36] dark:text-[#d4dbd6] dark:hover:bg-[#1d221f]"
                onClick={() => setShowSettings(true)}
                type="button"
              >
                Customize
              </button>
              <button
                className="rounded-2xl bg-[#3ecf8e] px-3 py-2 text-xs font-semibold text-[#073b24] hover:bg-[#32bd80]"
                onClick={() => savePreferences({
                  necessary: true,
                  analytics: true,
                  personalization: true,
                  marketing: true,
                })}
                type="button"
              >
                Allow all
              </button>
            </>
          ) : (
            <>
              <button
                className="rounded-2xl border border-[#e3e8e4] px-3 py-2 text-xs font-medium text-[#303833] hover:bg-[#f7f9f7] dark:border-[#343c36] dark:text-[#d4dbd6] dark:hover:bg-[#1d221f]"
                onClick={() => {
                  setShowSettings(false)
                  if (hasSaved) setIsOpen(false)
                }}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-2xl bg-[#3ecf8e] px-3 py-2 text-xs font-semibold text-[#073b24] hover:bg-[#32bd80]"
                onClick={() => savePreferences(preferences)}
                type="button"
              >
                Save preferences
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
