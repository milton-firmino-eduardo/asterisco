import { useCallback, useEffect, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  ArrowLeft,
  Check,
  Clapperboard,
  ChevronRight,
  DoorOpen,
  LoaderCircle,
  LogIn,
  LogOut,
  Menu,
  Plus,
  Radio,
  Send,
  Shield,
  UserRound,
  UsersRound,
  Video,
  X,
} from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import DirectMessages from "@/components/DirectMessages"
import { CreateRoomDialog, IncomingRoomInviteDialog } from "@/components/RoomDialogs"
import { resolveAvatarUrl } from "@/lib/avatar"
import { getDmProfilesByIds } from "@/lib/directMessages"
import { supabase } from "@/lib/supabase"

const websocketEndpoint = import.meta.env.VITE_ASTERISCO_WS_URL
const SWIPE_THRESHOLD = 64
const EDGE_SWIPE_WIDTH = 28
const homeTabs = [
  { id: "users", label: "Users", Icon: UsersRound },
  { id: "rooms", label: "Rooms", Icon: DoorOpen },
  { id: "watch", label: "Watch together", Icon: Clapperboard },
]

function getDisplayName(user) {
  return user?.user_metadata?.username
    || user?.email?.split("@")[0]
    || "Your account"
}

function createWebSocketUrl(ticket) {
  if (!websocketEndpoint) {
    throw new Error("The asterisco WebSocket address is not configured.")
  }

  let url
  try {
    url = new URL(websocketEndpoint)
  } catch {
    throw new Error("The asterisco WebSocket address is invalid.")
  }

  if (!["ws:", "wss:"].includes(url.protocol) || url.pathname !== "/ws") {
    throw new Error("The asterisco WebSocket address must use the /ws endpoint.")
  }
  if (window.location.protocol === "https:" && url.protocol !== "wss:") {
    throw new Error("A secure page requires a secure WebSocket connection.")
  }

  url.search = ""
  url.hash = ""
  url.searchParams.set("ticket", ticket)
  return url.toString()
}

function clearInviteTimer(timers, inviteId) {
  const timer = timers.current.get(inviteId)
  if (timer !== undefined) {
    window.clearTimeout(timer)
    timers.current.delete(inviteId)
  }
}

export default function Home({ preview = false }) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState("users")
  const [dmOpen, setDmOpen] = useState(false)
  const [roomCreatorOpen, setRoomCreatorOpen] = useState(false)
  const [incomingInvites, setIncomingInvites] = useState([])
  const [respondingInviteId, setRespondingInviteId] = useState(null)
  const [outgoingInvite, setOutgoingInvite] = useState(null)
  const [activeRoom, setActiveRoom] = useState(null)
  const [roomNotice, setRoomNotice] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const [connectionState, setConnectionState] = useState("offline")
  const [onlineUsers, setOnlineUsers] = useState([])
  const [profileAvatar, setProfileAvatar] = useState(null)
  const [connectionError, setConnectionError] = useState("")
  const [signingOut, setSigningOut] = useState(false)
  const socketRef = useRef(null)
  const connectingRef = useRef(false)
  const attemptRef = useRef(0)
  const heartbeatRef = useRef(null)
  const outgoingInviteTimerRef = useRef(null)
  const incomingInviteTimersRef = useRef(new Map())
  const respondingInviteIdRef = useRef(null)
  const touchStartRef = useRef(null)
  const closeButtonRef = useRef(null)
  const drawerRef = useRef(null)
  const menuButtonRef = useRef(null)
  const dmButtonRef = useRef(null)
  const menuWasOpenRef = useRef(false)
  const dmWasOpenRef = useRef(false)

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
  }, [])

  const closeDirectMessages = useCallback(() => {
    setDmOpen(false)
  }, [])

  useEffect(() => {
    if (dmOpen) {
      dmWasOpenRef.current = true
    } else if (dmWasOpenRef.current) {
      dmWasOpenRef.current = false
      dmButtonRef.current?.focus({ preventScroll: true })
    }
  }, [dmOpen])

  useEffect(() => {
    document.title = "Home | Asterisco"
    return () => {
      attemptRef.current += 1
      window.clearInterval(heartbeatRef.current)
      window.clearTimeout(outgoingInviteTimerRef.current)
      for (const timer of incomingInviteTimersRef.current.values()) {
        window.clearTimeout(timer)
      }
      incomingInviteTimersRef.current.clear()
      socketRef.current?.close(1000, "Home closed")
      socketRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!user || preview || !supabase) {
      setProfileAvatar(null)
      return undefined
    }

    let active = true
    supabase
      .from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          console.error("Could not load the account avatar.", error)
          return
        }
        if (active) setProfileAvatar(data?.avatar_url ?? null)
      })
      .catch((error) => {
        if (active) console.error("Could not load the account avatar.", error)
      })

    return () => {
      active = false
    }
  }, [preview, user])

  useEffect(() => {
    if (!menuOpen) {
      if (menuWasOpenRef.current) {
        menuWasOpenRef.current = false
        menuButtonRef.current?.focus({ preventScroll: true })
      }
      return undefined
    }

    menuWasOpenRef.current = true
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeButtonRef.current?.focus({ preventScroll: true })

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeMenu()
        return
      }

      if (event.key !== "Tab") return
      const focusable = drawerRef.current?.querySelectorAll(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable?.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = previousBodyOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [closeMenu, menuOpen])

  useEffect(() => {
    function handleTouchStart(event) {
      const touch = event.touches[0]
      if (touch) touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    }

    function handleTouchEnd(event) {
      const start = touchStartRef.current
      const touch = event.changedTouches[0]
      touchStartRef.current = null
      if (!start || !touch) return

      const deltaX = touch.clientX - start.x
      const deltaY = touch.clientY - start.y
      if (Math.abs(deltaY) > Math.abs(deltaX) || Math.abs(deltaX) < SWIPE_THRESHOLD) return

      if (!menuOpen && start.x >= window.innerWidth - EDGE_SWIPE_WIDTH && deltaX < 0) {
        setMenuOpen(true)
      } else if (menuOpen && deltaX > 0) {
        setMenuOpen(false)
      }
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true })
    window.addEventListener("touchend", handleTouchEnd, { passive: true })
    return () => {
      window.removeEventListener("touchstart", handleTouchStart)
      window.removeEventListener("touchend", handleTouchEnd)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!socketRef.current || connectionState !== "online") return undefined
    const socket = socketRef.current
    const timeout = window.setTimeout(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "search_users", query: "" }))
      }
    }, 350)
    return () => window.clearTimeout(timeout)
  }, [connectionState])

  async function connectToServer() {
    if (preview || !user) {
      navigate("/login")
      return
    }
    if (connectingRef.current || socketRef.current) return

    connectingRef.current = true
    const attempt = ++attemptRef.current
    setConnectionState("connecting")
    setConnectionError("")
    setOnlineUsers([])

    try {
      if (!supabase) throw new Error("Supabase is not configured.")
      const { data, error } = await supabase.functions.invoke("asterisco-token")
      if (error) throw error
      if (!data?.websocket_ticket) throw new Error("The server did not issue a connection ticket.")
      if (attemptRef.current !== attempt) return

      const socket = new WebSocket(createWebSocketUrl(data.websocket_ticket))
      socketRef.current = socket

      socket.onopen = () => {
        if (attemptRef.current !== attempt) return
        connectingRef.current = false
        setConnectionState("online")
      }

      socket.onmessage = ({ data: rawMessage }) => {
        if (attemptRef.current !== attempt) return
        let message
        try {
          message = JSON.parse(rawMessage)
        } catch {
          setConnectionError("The server sent an unreadable response.")
          return
        }

        if (message?.type === "connected") {
          const configuredInterval = Number(message.heartbeat_interval_seconds)
          const interval = Number.isFinite(configuredInterval) && configuredInterval > 0
            ? Math.min(configuredInterval, 60)
            : 15
          window.clearInterval(heartbeatRef.current)
          heartbeatRef.current = window.setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: "ping", ts: Date.now() }))
            }
          }, interval * 1000)
        } else if (message?.type === "users_found" && Array.isArray(message.users)) {
          setOnlineUsers(message.users.filter(
            (entry) => entry && typeof entry.user_id === "string"
          ))
        } else if (message?.type === "invite_received"
          && typeof message.invite_id === "string"
          && typeof message.from_user_id === "string") {
          const invite = {
            invite_id: message.invite_id,
            from_user_id: message.from_user_id,
            video_id: message.video_id,
          }
          clearInviteTimer(incomingInviteTimersRef, invite.invite_id)
          setIncomingInvites((current) => [
            ...current.filter((item) => item.invite_id !== invite.invite_id),
            invite,
          ])
          setRoomNotice("")
          const expiresIn = Number(message.expires_in_seconds)
          if (Number.isFinite(expiresIn) && expiresIn > 0) {
            const timer = window.setTimeout(() => {
              incomingInviteTimersRef.current.delete(invite.invite_id)
              setIncomingInvites((current) => current.filter(
                (item) => item.invite_id !== invite.invite_id
              ))
              setRoomNotice("A room invitation expired.")
            }, expiresIn * 1000)
            incomingInviteTimersRef.current.set(invite.invite_id, timer)
          }
          void getDmProfilesByIds([invite.from_user_id])
            .then((profiles) => {
              const profile = profiles.find((item) => item.user_id === invite.from_user_id)
              if (!profile) return
              setIncomingInvites((current) => current.map((item) => (
                item.invite_id === invite.invite_id
                  ? { ...item, from_username: profile.username }
                  : item
              )))
            })
            .catch((profileError) => {
              setConnectionError(
                profileError instanceof Error
                  ? profileError.message
                  : "Could not load the inviter's username."
              )
            })
        } else if (message?.type === "invite_sent"
          && typeof message.invite_id === "string") {
          window.clearTimeout(outgoingInviteTimerRef.current)
          setOutgoingInvite((current) => ({
            ...current,
            invite_id: message.invite_id,
            to_user_id: message.to_user_id ?? current?.to_user_id,
            video_id: message.video_id ?? current?.video_id,
            status: "pending",
          }))
          const expiresIn = Number(message.expires_in_seconds)
          if (Number.isFinite(expiresIn) && expiresIn > 0) {
            outgoingInviteTimerRef.current = window.setTimeout(() => {
              setOutgoingInvite((current) => (
                current?.invite_id === message.invite_id
                  ? { ...current, status: "expired" }
                  : current
              ))
              setRoomNotice("The invitation expired without a response.")
            }, expiresIn * 1000)
          }
        } else if (message?.type === "invite_rejected") {
          window.clearTimeout(outgoingInviteTimerRef.current)
          setOutgoingInvite((current) => (
            current?.invite_id === message.invite_id
              ? { ...current, status: "declined" }
              : current
          ))
          setRoomNotice("The invitation was declined.")
        } else if (message?.type === "invite_cancelled") {
          clearInviteTimer(incomingInviteTimersRef, message.invite_id)
          setIncomingInvites((current) => current.filter(
            (invite) => invite.invite_id !== message.invite_id
          ))
        } else if (message?.type === "session_start" || message?.type === "sync_state") {
          setActiveRoom({
            room_id: message.room_id,
            video_id: message.video_id,
            controller_id: message.controller_id,
            viewer_id: message.viewer_id,
            is_playing: message.is_playing ?? false,
            position: message.position ?? message.initial_position ?? 0,
            playback_rate: message.playback_rate ?? 1,
          })
          setActiveTab("rooms")
          setRoomCreatorOpen(false)
          setRoomNotice("")
          window.clearTimeout(outgoingInviteTimerRef.current)
          setOutgoingInvite(null)
          const acceptedInviteId = respondingInviteIdRef.current
          if (acceptedInviteId) {
            clearInviteTimer(incomingInviteTimersRef, acceptedInviteId)
            setIncomingInvites((current) => current.filter(
              (invite) => invite.invite_id !== acceptedInviteId
            ))
            respondingInviteIdRef.current = null
            setRespondingInviteId(null)
          }
        } else if (message?.type === "session_ended"
          || message?.type === "participant_disconnected") {
          setActiveRoom(null)
          setRoomNotice(
            message.reason === "participant_left"
              ? "The other person left the room."
              : "The room has ended."
          )
        } else if (message?.type === "error") {
          if (respondingInviteIdRef.current) {
            respondingInviteIdRef.current = null
            setRespondingInviteId(null)
          }
          setOutgoingInvite((current) => (
            current?.status === "sending" ? { ...current, status: "failed" } : current
          ))
          setConnectionError(
            typeof message.message === "string" ? message.message : "The request failed."
          )
        }
      }

      socket.onerror = () => {
        if (attemptRef.current === attempt) {
          setConnectionError("Could not connect to asterisco. Check the server address and try again.")
        }
      }

      socket.onclose = (event) => {
        if (attemptRef.current !== attempt || socketRef.current !== socket) return
        connectingRef.current = false
        socketRef.current = null
        window.clearInterval(heartbeatRef.current)
        setConnectionState("offline")
        setOnlineUsers([])
        setActiveRoom(null)
        setOutgoingInvite((current) => (
          current?.status === "sending" ? { ...current, status: "failed" } : current
        ))
        if (event.code !== 1000) setConnectionError("Connection closed. Try reconnecting.")
      }
    } catch (error) {
      if (attemptRef.current !== attempt) return
      connectingRef.current = false
      setConnectionState("offline")
      setConnectionError(error instanceof Error ? error.message : "Could not connect to asterisco.")
    }
  }

  function openRoomCreator() {
    setActiveTab("rooms")
    setRoomNotice("")
    setRoomCreatorOpen(true)
    if (!preview && user && connectionState === "offline") {
      void connectToServer()
    }
  }

  function sendRoomInvite(targetUser, videoId) {
    if (preview) {
      setOutgoingInvite({
        to_user_id: targetUser.user_id,
        to_username: targetUser.username,
        video_id: videoId,
        status: "preview",
      })
      setRoomCreatorOpen(false)
      setRoomNotice("Preview only: this invitation was not sent to the server.")
      return
    }

    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error("Connect to the server before sending an invitation.")
    }
    if (activeRoom) {
      throw new Error("End your current room before creating another one.")
    }

    socket.send(JSON.stringify({
      type: "invite_send",
      target_user_id: targetUser.user_id,
      video_id: videoId,
    }))
    setOutgoingInvite({
      to_user_id: targetUser.user_id,
      to_username: targetUser.username,
      video_id: videoId,
      status: "sending",
    })
    setRoomNotice("")
    setRoomCreatorOpen(false)
  }

  function cancelRoomInvite() {
    if (!outgoingInvite?.invite_id) return
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setConnectionError("Reconnect to the server before cancelling this invitation.")
      return
    }

    socket.send(JSON.stringify({
      type: "invite_cancel",
      invite_id: outgoingInvite.invite_id,
    }))
    window.clearTimeout(outgoingInviteTimerRef.current)
    setOutgoingInvite(null)
    setRoomNotice("Invitation cancelled.")
  }

  function respondToRoomInvite(accept) {
    const invite = incomingInvites[0]
    if (!invite || respondingInviteId) return
    const socket = socketRef.current
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setConnectionError("Reconnect to the server before responding to this invitation.")
      return
    }

    if (accept) {
      respondingInviteIdRef.current = invite.invite_id
      setRespondingInviteId(invite.invite_id)
    } else {
      clearInviteTimer(incomingInviteTimersRef, invite.invite_id)
      setIncomingInvites((current) => current.filter(
        (item) => item.invite_id !== invite.invite_id
      ))
    }

    socket.send(JSON.stringify({
      type: accept ? "invite_accept" : "invite_reject",
      invite_id: invite.invite_id,
    }))
  }

  function disconnectFromServer() {
    attemptRef.current += 1
    connectingRef.current = false
    window.clearInterval(heartbeatRef.current)
    window.clearTimeout(outgoingInviteTimerRef.current)
    for (const timer of incomingInviteTimersRef.current.values()) {
      window.clearTimeout(timer)
    }
    incomingInviteTimersRef.current.clear()
    respondingInviteIdRef.current = null
    const socket = socketRef.current
    socketRef.current = null
    socket?.close(1000, "User disconnected")
    setConnectionState("offline")
    setOnlineUsers([])
    setIncomingInvites([])
    setRespondingInviteId(null)
    setOutgoingInvite(null)
    setActiveRoom(null)
    setConnectionError("")
  }

  async function handleSignOut() {
    setSigningOut(true)
    disconnectFromServer()
    try {
      await signOut()
      closeMenu()
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : "Could not sign out.")
    } finally {
      setSigningOut(false)
    }
  }

  function openCookieSettings() {
    window.dispatchEvent(new Event("asterisco:open-cookie-preferences"))
    closeMenu()
  }

  function handleTabKeyDown(event, tabId) {
    const currentIndex = homeTabs.findIndex((tab) => tab.id === tabId)
    let nextIndex

    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % homeTabs.length
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + homeTabs.length) % homeTabs.length
    else if (event.key === "Home") nextIndex = 0
    else if (event.key === "End") nextIndex = homeTabs.length - 1
    else return

    event.preventDefault()
    const nextTab = homeTabs[nextIndex]
    setActiveTab(nextTab.id)
    document.getElementById(`home-tab-${nextTab.id}`)?.focus()
  }

  const connected = connectionState === "online"
  const name = preview ? "Guest" : getDisplayName(user)
  const profileAvatarDisplay = resolveAvatarUrl(profileAvatar)

  return (
    <main className="flex min-h-svh flex-col bg-white text-[#242424]">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-end gap-3 bg-white px-4 sm:px-6">
        <span
          aria-label={connected ? "Connected" : "Not connected"}
          className={`size-2 rounded-full ${connected ? "bg-[#3ecf8e]" : "bg-[#c6c6c6]"}`}
          role="status"
        />
        <button
          aria-label={
            connected
              ? "Disconnect"
              : connectionState === "connecting"
                ? "Connecting"
                : preview
                  ? "Sign in to connect"
                  : "Connect"
          }
          className="flex size-9 items-center justify-center rounded-full text-[#16803c] outline-none transition-colors hover:bg-[#edf8f0] focus-visible:ring-2 focus-visible:ring-[#3ecf8e] disabled:opacity-50"
          disabled={connectionState === "connecting"}
          onClick={connected ? disconnectFromServer : connectToServer}
          type="button"
        >
          {connectionState === "connecting"
            ? <LoaderCircle aria-hidden="true" className="size-[19px] animate-spin" />
            : connected
              ? <Check aria-hidden="true" className="size-[19px]" />
              : <Radio aria-hidden="true" className="size-[19px]" />}
        </button>
        <div>
          <button
            ref={menuButtonRef}
            aria-expanded={menuOpen}
            aria-label="Open account and settings menu"
            className="flex size-9 items-center justify-center rounded-full text-[#555] outline-none transition-colors hover:bg-[#f5f5f5] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]"
            onClick={() => setMenuOpen(true)}
            type="button"
          >
            <Menu aria-hidden="true" className="size-[21px]" strokeWidth={1.8} />
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pt-4 sm:px-8">
        <div
          aria-label="Home sections"
          className="mx-auto flex w-fit shrink-0 items-center gap-1 rounded-[20px] bg-[#f5f8f6] p-1"
          role="tablist"
        >
          {homeTabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              id={`home-tab-${id}`}
              aria-controls={`home-panel-${id}`}
              aria-label={label}
              aria-selected={activeTab === id}
              className={`flex size-10 items-center justify-center rounded-2xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#3ecf8e] focus-visible:ring-offset-2 ${
                activeTab === id
                  ? "bg-[#3ecf8e] text-[#073b24]"
                  : "text-[#737373] hover:bg-white hover:text-[#242424]"
              }`}
              onClick={() => setActiveTab(id)}
              onKeyDown={(event) => handleTabKeyDown(event, id)}
              role="tab"
              tabIndex={activeTab === id ? 0 : -1}
              type="button"
            >
              <Icon aria-hidden="true" className="size-5" strokeWidth={1.9} />
            </button>
          ))}
        </div>

        <div className="mt-7 flex flex-1 flex-col">
          {homeTabs.map(({ id, Icon }) => (
            <section
              key={id}
              id={`home-panel-${id}`}
              aria-labelledby={`home-tab-${id}`}
              className={activeTab === id ? "flex flex-1 flex-col" : "hidden"}
              hidden={activeTab !== id}
              role="tabpanel"
              tabIndex={activeTab === id ? 0 : -1}
            >
              {id === "rooms" ? (
                <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
                  {activeRoom ? (
                    <section aria-label="Active room" className="space-y-2 border-b border-[#edf0ed] pb-5">
                      <div className="flex items-center gap-2 text-[#16803c]">
                        <Video aria-hidden="true" className="size-[18px]" />
                        <h2 className="text-sm font-semibold">Room in progress</h2>
                      </div>
                      <p className="text-xs text-[#59635d]">Room ID: {activeRoom.room_id}</p>
                      <p className="truncate text-xs text-[#59635d]">Video ID: {activeRoom.video_id}</p>
                      <p className="text-[11px] text-[#858d88]">
                        {activeRoom.controller_id === user?.id
                          ? "You are hosting this room."
                          : "You joined someone else's room."}
                      </p>
                    </section>
                  ) : null}

                  {outgoingInvite && !activeRoom && (
                    <section
                      aria-label="Room invitation status"
                      className="flex items-start gap-3 border-b border-[#edf0ed] py-4"
                    >
                      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-[#edf8f0] text-[#16803c]">
                        <Send aria-hidden="true" className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#303833]">
                          {outgoingInvite.status === "sending"
                            ? "Sending invitation..."
                            : outgoingInvite.status === "pending"
                              ? `Waiting for @${outgoingInvite.to_username}...`
                              : outgoingInvite.status === "declined"
                                ? `@${outgoingInvite.to_username} declined the invitation.`
                                : outgoingInvite.status === "expired"
                                  ? "The invitation expired."
                                  : outgoingInvite.status === "failed"
                                    ? "Could not send the invitation."
                                    : "Preview only; invitation was not sent."}
                        </p>
                        <p className="mt-1 truncate text-xs text-[#858d88]">
                          Video ID: {outgoingInvite.video_id}
                        </p>
                      </div>
                      {outgoingInvite.status === "pending" && (
                        <button
                          aria-label="Cancel room invitation"
                          className="flex size-8 shrink-0 items-center justify-center rounded-full text-[#777] hover:bg-[#f5f8f6] hover:text-[#b42318]"
                          onClick={cancelRoomInvite}
                          type="button"
                        >
                          <X aria-hidden="true" className="size-[17px]" />
                        </button>
                      )}
                    </section>
                  )}

                  {roomNotice && (
                    <p aria-live="polite" className="border-b border-[#edf0ed] py-3 text-xs text-[#69736d]" role="status">
                      {roomNotice}
                    </p>
                  )}

                  {!activeRoom && (
                    <div className="py-5">
                      <p className="mb-4 text-center text-xs leading-5 text-[#858d88]">
                        Invite someone who's online and start a shared room after they accept.
                      </p>
                      <button
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#3ecf8e] px-4 text-sm font-semibold text-[#073b24] transition-colors hover:bg-[#32bd80] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ecf8e] disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={outgoingInvite?.status === "pending" || outgoingInvite?.status === "sending"}
                        onClick={openRoomCreator}
                        type="button"
                      >
                        <Plus aria-hidden="true" className="size-[18px]" />
                        Create a room
                      </button>
                    </div>
                  )}
                </div>
              ) : id === "users" && onlineUsers.length > 0 ? (
                <ul aria-label="Online users" className="flex flex-wrap gap-3">
                  {onlineUsers.map((onlineUser) => (
                    <li
                      key={onlineUser.user_id}
                      aria-label="Online user"
                      className="relative flex size-11 items-center justify-center rounded-full bg-[#f5f8f6] text-[#737373]"
                    >
                      <UserRound aria-hidden="true" className="size-[19px]" strokeWidth={1.8} />
                      <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-[#3ecf8e] ring-2 ring-white" />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-1 items-center justify-center py-8">
                  <span className="flex size-20 items-center justify-center rounded-full bg-[#f5f8f6] text-[#a0b0a7]">
                    <Icon aria-hidden="true" className="size-8" strokeWidth={1.5} />
                  </span>
                </div>
              )}
            </section>
          ))}

          {connectionError && (
            <p aria-live="polite" className="mt-4 text-center text-sm text-[#b42318]" role="alert">
              {connectionError}
            </p>
          )}
        </div>
      </div>

      <div
        aria-hidden={!menuOpen}
        className={`fixed inset-0 z-40 bg-black/10 transition-opacity duration-200 ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeMenu}
      />
      <aside
        ref={drawerRef}
        aria-label="Account and settings"
        aria-modal={menuOpen ? "true" : undefined}
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white transition-transform duration-300 ease-out sm:max-w-md ${
          menuOpen ? "translate-x-0" : "translate-x-full"
        }`}
        inert={!menuOpen}
        role={menuOpen ? "dialog" : undefined}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-[#f0f0f0] px-4 sm:px-6">
          <button
            ref={closeButtonRef}
            aria-label="Close menu"
            className="flex size-9 items-center justify-center rounded-full text-[#555] outline-none hover:bg-[#f5f5f5] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]"
            onClick={closeMenu}
            type="button"
          >
            <ArrowLeft aria-hidden="true" className="size-5" strokeWidth={1.8} />
          </button>
          <h2 className="text-[15px] font-medium">Account</h2>
          <span aria-hidden="true" className="size-9" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8 pt-7 sm:px-8">
          <section aria-label="Account information" className="flex items-center gap-3 border-b border-[#f0f0f0] pb-6">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#edf8f0] text-[#16803c]">
              {profileAvatarDisplay ? (
                <img
                  alt=""
                  className="size-full rounded-full object-cover"
                  src={profileAvatarDisplay}
                />
              ) : (
                <UserRound aria-hidden="true" className="size-6" strokeWidth={1.7} />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-medium">{name}</span>
              <span className="mt-1 block truncate text-[13px] text-[#777]">
                {preview ? "Preview mode" : user?.email || ""}
              </span>
            </span>
          </section>

          {!preview && (
            <Link
              className="mt-4 flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left outline-none hover:bg-[#f7f9f7] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]"
              onClick={closeMenu}
              to="/profile"
            >
              <UserRound aria-hidden="true" className="size-[18px] text-[#777]" strokeWidth={1.8} />
              <span className="flex-1 text-sm">Manage profile</span>
              <ChevronRight aria-hidden="true" className="size-4 text-[#999]" />
            </Link>
          )}

          <section className="pt-6">
            <h3 className="mb-2 px-1 text-xs font-medium uppercase tracking-[0.08em] text-[#888]">
              Settings
            </h3>
            <button
              className="flex min-h-12 w-full items-center gap-3 border-b border-[#f2f2f2] text-left outline-none hover:text-[#16803c] focus-visible:ring-2 focus-visible:ring-[#3ecf8e]"
              onClick={openCookieSettings}
              type="button"
            >
              <Shield aria-hidden="true" className="size-[18px] text-[#777]" strokeWidth={1.8} />
              <span className="flex-1 text-sm">Privacy and cookies</span>
              <ChevronRight aria-hidden="true" className="size-4 text-[#999]" />
            </button>
          </section>
        </div>

        <div className="shrink-0 border-t border-[#f0f0f0] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-8">
          {preview ? (
            <Link
              className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#3ecf8e] px-4 text-sm font-medium text-[#073b24] outline-none hover:bg-[#32bd80] focus-visible:ring-2 focus-visible:ring-[#3ecf8e] focus-visible:ring-offset-2"
              onClick={closeMenu}
              to="/login"
            >
              <LogIn aria-hidden="true" className="size-4" />
              Sign in
            </Link>
          ) : (
            <button
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-medium text-[#555] outline-none hover:bg-[#f6f6f6] focus-visible:ring-2 focus-visible:ring-[#3ecf8e] disabled:opacity-50"
              disabled={signingOut}
              onClick={handleSignOut}
              type="button"
            >
              {signingOut
                ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
                : <LogOut aria-hidden="true" className="size-4" />}
              Sign out
            </button>
          )}
        </div>
      </aside>

      {!dmOpen && (
        <button
          ref={dmButtonRef}
          aria-label={preview && !user ? "Open direct messages preview" : "Open direct messages"}
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-30 flex size-11 items-center justify-center rounded-2xl bg-[#3ecf8e] text-[#073b24] shadow-lg shadow-[#073b24]/15 transition-transform hover:scale-105 hover:bg-[#32bd80] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3ecf8e]"
          onClick={() => {
            if (user || preview) setDmOpen(true)
            else navigate("/login")
          }}
          type="button"
        >
          <Send aria-hidden="true" className="size-[18px]" strokeWidth={1.9} />
        </button>
      )}
      {roomCreatorOpen && (
        <CreateRoomDialog
          connected={connected}
          connecting={connectionState === "connecting"}
          connectionError={connectionError}
          onClose={() => setRoomCreatorOpen(false)}
          onConnect={connectToServer}
          onInvite={sendRoomInvite}
          onlineUsers={onlineUsers}
          preview={preview && !user}
        />
      )}
      {!activeRoom && incomingInvites[0] && (
        <IncomingRoomInviteDialog
          busy={respondingInviteId === incomingInvites[0].invite_id}
          invite={incomingInvites[0]}
          onAccept={() => respondToRoomInvite(true)}
          onReject={() => respondToRoomInvite(false)}
          senderUsername={incomingInvites[0].from_username}
        />
      )}
      {dmOpen && (user || preview) && (
        <DirectMessages
          onClose={closeDirectMessages}
          preview={preview && !user}
          userId={user?.id ?? "preview-user"}
        />
      )}
    </main>
  )
}
