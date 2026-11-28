import { useEffect, useRef, useState } from "react"
import { LoaderCircle, Search, Send, UserRound, Video, X } from "lucide-react"
import { getDmProfilesByIds } from "@/lib/directMessages"

const PREVIEW_ONLINE_USERS = [
  { user_id: "preview-online-alex", username: "alex" },
  { user_id: "preview-online-morgan", username: "morgan" },
  { user_id: "preview-online-riley", username: "riley" },
]

function getErrorMessage(error, fallback) {
  if (typeof error?.message === "string") return error.message
  if (typeof error === "string") return error
  return fallback
}

export function CreateRoomDialog({
  preview,
  connected,
  connecting,
  connectionError,
  onlineUsers,
  onConnect,
  onClose,
  onInvite,
}) {
  const [usernameQuery, setUsernameQuery] = useState("")
  const [profiles, setProfiles] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [videoId, setVideoId] = useState("")
  const [searchLoading, setSearchLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const closeButtonRef = useRef(null)
  const dialogRef = useRef(null)

  useEffect(() => {
    closeButtonRef.current?.focus({ preventScroll: true })

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose()
        return
      }

      if (event.key !== "Tab") return
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable?.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const focusIsInside = dialogRef.current?.contains(document.activeElement)
      if (event.shiftKey && (document.activeElement === first || !focusIsInside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !focusIsInside)) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  useEffect(() => {
    const query = usernameQuery.trim()
    if (query.length < 2) {
      setProfiles([])
      setSearchLoading(false)
      return undefined
    }

    if (preview) {
      const normalizedQuery = query.toLocaleLowerCase()
      setProfiles(PREVIEW_ONLINE_USERS.filter((profile) => (
        profile.username.toLocaleLowerCase().startsWith(normalizedQuery)
      )))
      setSearchLoading(false)
      return undefined
    }

    if (!connected) {
      setProfiles([])
      setSearchLoading(false)
      return undefined
    }

    let active = true
    setSearchLoading(true)
    const timeout = window.setTimeout(async () => {
      try {
        const availableIds = new Set(
          onlineUsers
            .filter((user) => user.online && !user.in_room)
            .map((user) => user.user_id)
        )
        const matches = await getDmProfilesByIds([...availableIds])
        if (active) {
          const normalizedQuery = query.toLocaleLowerCase()
          setProfiles(matches.filter((profile) => (
            availableIds.has(profile.user_id)
            && profile.username.toLocaleLowerCase().startsWith(normalizedQuery)
          )))
        }
      } catch (searchError) {
        if (active) {
          setProfiles([])
          setError(getErrorMessage(searchError, "Could not search for online people."))
        }
      } finally {
        if (active) setSearchLoading(false)
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [connected, onlineUsers, preview, usernameQuery])

  async function handleSubmit(event) {
    event.preventDefault()
    const cleanedVideoId = videoId.trim()
    if (!selectedUser || !cleanedVideoId || submitting) return

    setSubmitting(true)
    setError("")
    try {
      await onInvite(selectedUser, cleanedVideoId)
    } catch (inviteError) {
      setError(getErrorMessage(inviteError, "Could not send this invitation."))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        aria-label="Close room creation"
        className="fixed inset-0 z-[60] bg-black/10"
        onClick={onClose}
        type="button"
      />
      <section
        ref={dialogRef}
        aria-label="Create a room"
        aria-modal="true"
        className="fixed inset-0 z-[70] flex flex-col bg-white shadow-2xl sm:inset-auto sm:bottom-6 sm:left-1/2 sm:h-[min(42rem,calc(100dvh-3rem))] sm:w-[min(27rem,calc(100vw-3rem))] sm:-translate-x-1/2 sm:rounded-2xl sm:border sm:border-[#e7ece8]"
        role="dialog"
      >
        <header className="flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center justify-between border-b border-[#edf0ed] px-4 pt-[env(safe-area-inset-top)] sm:h-14 sm:rounded-t-2xl sm:pt-0">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#edf8f0] text-[#16803c]">
              <Video aria-hidden="true" className="size-[18px]" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold">Create a room</h2>
              <p className="text-[11px] text-[#858d88]">Invite someone to watch together</p>
            </div>
            {preview && (
              <span className="shrink-0 rounded-full bg-[#f2f5f3] px-2 py-1 text-[10px] font-medium text-[#737b75]">
                Preview
              </span>
            )}
          </div>
          <button
            ref={closeButtonRef}
            aria-label="Close room creation"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#555] hover:bg-[#f5f8f6] focus-visible:outline-2 focus-visible:outline-[#3ecf8e]"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </header>

        <form className="flex min-h-0 flex-1 flex-col" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            <p className="text-xs leading-5 text-[#69736d]">
              The room starts when the other person accepts your invitation.
            </p>

            {!preview && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-[#f5f8f6] p-3">
                <p className="text-xs text-[#59635d]">
                  {connected
                    ? "Connected. Choose someone who's online."
                    : connecting
                      ? "Connecting to the server..."
                      : "Connect to find people who are online."}
                </p>
                {!connected && !connecting && (
                  <button
                    className="min-h-9 shrink-0 rounded-xl bg-[#3ecf8e] px-3 text-xs font-semibold text-[#073b24] hover:bg-[#32bd80]"
                    onClick={onConnect}
                    type="button"
                  >
                    Connect
                  </button>
                )}
              </div>
            )}

            <label className="mt-5 block text-xs font-medium text-[#59635d]" htmlFor="room-user-search">
              Online person
            </label>
            <div className="relative mt-2">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-[#929a94]" />
              <input
                autoComplete="off"
                className="h-11 w-full rounded-2xl border border-[#e3e8e4] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#3ecf8e] focus:ring-2 focus:ring-[#3ecf8e]/20 disabled:bg-[#f7f9f7]"
                disabled={!preview && !connected}
                id="room-user-search"
                onChange={(event) => {
                  setUsernameQuery(event.target.value)
                  setSelectedUser(null)
                  setError("")
                }}
                placeholder="Search usernames"
                type="search"
                value={usernameQuery}
              />
            </div>

            {searchLoading ? (
              <div className="flex h-24 items-center justify-center text-[#8a928c]">
                <LoaderCircle aria-label="Searching online people" className="size-6 animate-spin" />
              </div>
            ) : usernameQuery.trim().length < 2 ? (
              <p className="px-1 py-3 text-xs text-[#858d88]">Enter at least 2 characters.</p>
            ) : profiles.length === 0 ? (
              <p className="px-1 py-3 text-xs text-[#858d88]">
                No available online people found.
              </p>
            ) : (
              <ul aria-label="Available people" className="mt-2 divide-y divide-[#f1f3f1]">
                {profiles.map((profile) => (
                  <li key={profile.user_id}>
                    <button
                      aria-pressed={selectedUser?.user_id === profile.user_id}
                      className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left ${
                        selectedUser?.user_id === profile.user_id
                          ? "bg-[#edf8f0] text-[#073b24]"
                          : "hover:bg-[#fafcfb]"
                      }`}
                      onClick={() => setSelectedUser(profile)}
                      type="button"
                    >
                      <span className="flex size-8 items-center justify-center rounded-full bg-white text-[#738078]">
                        <UserRound aria-hidden="true" className="size-[17px]" />
                      </span>
                      <span className="flex-1 truncate text-sm font-medium">@{profile.username}</span>
                      <span className="size-2 rounded-full bg-[#3ecf8e]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <label className="mt-5 block text-xs font-medium text-[#59635d]" htmlFor="room-video-id">
              Bunny Stream video ID
            </label>
            <input
              autoComplete="off"
              className="mt-2 h-11 w-full rounded-2xl border border-[#e3e8e4] bg-white px-3.5 text-sm outline-none focus:border-[#3ecf8e] focus:ring-2 focus:ring-[#3ecf8e]/20"
              id="room-video-id"
              maxLength={36}
              pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
              onChange={(event) => setVideoId(event.target.value)}
              placeholder="Paste the Bunny Stream video GUID"
              required
              value={videoId}
            />
            <p className="mt-2 text-[11px] leading-5 text-[#858d88]">
              Enter the video's GUID, not its full URL.
            </p>

            {(error || connectionError) && (
              <p aria-live="polite" className="mt-4 rounded-xl bg-[#fff1f0] px-3 py-2 text-xs text-[#b42318]" role="alert">
                {error || connectionError}
              </p>
            )}
          </div>

          <div className="shrink-0 border-t border-[#edf0ed] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#3ecf8e] text-sm font-semibold text-[#073b24] hover:bg-[#32bd80] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ecf8e] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={(!preview && !connected) || !selectedUser || !videoId.trim() || submitting}
              type="submit"
            >
              {submitting
                ? <LoaderCircle aria-hidden="true" className="size-[18px] animate-spin" />
                : <Send aria-hidden="true" className="size-[18px]" />}
              {submitting ? "Sending invitation..." : "Send invite"}
            </button>
          </div>
        </form>
      </section>
    </>
  )
}

export function IncomingRoomInviteDialog({
  invite,
  senderUsername,
  busy,
  onAccept,
  onReject,
}) {
  if (!invite) return null

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-[60] bg-black/20" />
      <section
        aria-label="Room invitation"
        aria-modal="true"
        className="fixed inset-x-4 bottom-4 z-[70] mx-auto max-w-sm rounded-2xl border border-[#e7ece8] bg-white p-5 shadow-2xl sm:inset-x-auto sm:bottom-8"
        role="dialog"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#edf8f0] text-[#16803c]">
            <Video aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[#202522]">Room invitation</h2>
            <p className="mt-1 text-xs leading-5 text-[#69736d]">
              <span className="font-medium text-[#303833]">
                {senderUsername ? `@${senderUsername}` : "Someone"}
              </span>
              {" "}invited you to watch together.
            </p>
            <p className="mt-2 truncate rounded-xl bg-[#f5f8f6] px-3 py-2 text-xs text-[#59635d]">
              Video ID: {invite.video_id}
            </p>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-[#858d88]">
          The room starts after you accept.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            className="min-h-10 flex-1 rounded-xl border border-[#e3e8e4] text-xs font-medium text-[#59635d] hover:bg-[#f7f9f7] disabled:opacity-50"
            disabled={busy}
            onClick={onReject}
            type="button"
          >
            Decline
          </button>
          <button
            className="min-h-10 flex-1 rounded-xl bg-[#3ecf8e] text-xs font-semibold text-[#073b24] hover:bg-[#32bd80] disabled:opacity-50"
            disabled={busy}
            onClick={onAccept}
            type="button"
          >
            {busy ? "Starting..." : "Accept"}
          </button>
        </div>
      </section>
    </>
  )
}
