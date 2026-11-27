import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  Check,
  CheckCheck,
  LoaderCircle,
  MessageCircle,
  Search,
  Send,
  Trash2,
  UserRound,
  X,
} from "lucide-react"
import {
  deleteDmConversationForCurrentUser,
  listDmConversations,
  listDmMessages,
  markDmConversationRead,
  removeDmChannel,
  respondToDmRequest,
  searchDmUsers,
  sendDmMessage,
  startDmConversation,
  subscribeToDmInbox,
  subscribeToDmMessages,
} from "@/lib/directMessages"
import { supabase } from "@/lib/supabase"

const MESSAGE_LIMIT = 4000
const PREVIEW_CONVERSATIONS = [
  {
    conversation_id: "preview-conversation-alex",
    other_user_id: "preview-user-alex",
    username: "alex",
    status: "accepted",
    requested_by: "preview-user",
    last_message_body: "Those photos came out great!",
    last_message_sender_id: "preview-user-alex",
    last_message_at: new Date(Date.now() - 4 * 60_000).toISOString(),
    unread_count: 1,
  },
  {
    conversation_id: "preview-conversation-sam",
    other_user_id: "preview-user-sam",
    username: "sam",
    status: "pending",
    requested_by: "preview-user-sam",
    last_message_body: "Want to join our room later?",
    last_message_sender_id: "preview-user-sam",
    last_message_at: new Date(Date.now() - 18 * 60_000).toISOString(),
    unread_count: 1,
  },
  {
    conversation_id: "preview-conversation-jules",
    other_user_id: "preview-user-jules",
    username: "jules",
    status: "pending",
    requested_by: "preview-user",
    last_message_body: "Hi! I liked your latest post.",
    last_message_sender_id: "preview-user",
    last_message_at: new Date(Date.now() - 55 * 60_000).toISOString(),
    unread_count: 0,
  },
]
const PREVIEW_PROFILES = [
  { user_id: "preview-user-alex", username: "alex" },
  { user_id: "preview-user-sam", username: "sam" },
  { user_id: "preview-user-jules", username: "jules" },
  { user_id: "preview-user-riley", username: "riley" },
]

function createPreviewMessages(conversationId) {
  const now = Date.now()
  const messages = {
    "preview-conversation-alex": [
      {
        id: "preview-message-alex-1",
        conversation_id: "preview-conversation-alex",
        sender_id: "preview-user-alex",
        body: "I finally edited the photos from yesterday.",
        created_at: new Date(now - 9 * 60_000).toISOString(),
        read_at: new Date(now - 8 * 60_000).toISOString(),
      },
      {
        id: "preview-message-alex-2",
        conversation_id: "preview-conversation-alex",
        sender_id: "preview-user",
        body: "Those photos came out great!",
        created_at: new Date(now - 4 * 60_000).toISOString(),
        read_at: null,
      },
    ],
    "preview-conversation-sam": [
      {
        id: "preview-message-sam-1",
        conversation_id: "preview-conversation-sam",
        sender_id: "preview-user-sam",
        body: "Want to join our room later?",
        created_at: new Date(now - 18 * 60_000).toISOString(),
        read_at: null,
      },
    ],
    "preview-conversation-jules": [
      {
        id: "preview-message-jules-1",
        conversation_id: "preview-conversation-jules",
        sender_id: "preview-user",
        body: "Hi! I liked your latest post.",
        created_at: new Date(now - 55 * 60_000).toISOString(),
        read_at: null,
      },
    ],
  }

  return messages[conversationId] ?? []
}

function getErrorMessage(error, fallback) {
  if (typeof error?.message === "string") return error.message
  if (typeof error === "string") return error
  return fallback
}

function mergeMessages(current, additions) {
  const byId = new Map(current.map((message) => [message.id, message]))
  for (const message of additions) {
    byId.set(message.id, message)
  }
  return [...byId.values()].sort((first, second) => (
    first.created_at.localeCompare(second.created_at)
    || first.id.localeCompare(second.id)
  ))
}

function formatTime(value) {
  if (!value) return ""
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

function formatInboxTime(value) {
  if (!value) return ""
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return formatTime(value)
  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

export default function DirectMessages({ userId, onClose, preview = false }) {
  const [screen, setScreen] = useState("inbox")
  const [inboxTab, setInboxTab] = useState("messages")
  const [conversations, setConversations] = useState(() => (
    preview ? PREVIEW_CONVERSATIONS.map((conversation) => ({ ...conversation })) : []
  ))
  const [previewMessages, setPreviewMessages] = useState(() => (
    Object.fromEntries(PREVIEW_CONVERSATIONS.map(({ conversation_id }) => [
      conversation_id,
      createPreviewMessages(conversation_id),
    ]))
  ))
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [draftRecipient, setDraftRecipient] = useState(null)
  const [threadOrigin, setThreadOrigin] = useState("inbox")
  const [messages, setMessages] = useState([])
  const [searchTerm, setSearchTerm] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [messageText, setMessageText] = useState("")
  const [inboxLoading, setInboxLoading] = useState(!preview)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [olderMessagesLoading, setOlderMessagesLoading] = useState(false)
  const [hasOlderMessages, setHasOlderMessages] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [respondingId, setRespondingId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")
  const closeButtonRef = useRef(null)
  const dialogRef = useRef(null)
  const messageListRef = useRef(null)
  const messageEndRef = useRef(null)
  const messageInputRef = useRef(null)
  const preserveScrollRef = useRef(null)
  const activeThreadKeyRef = useRef(null)

  useLayoutEffect(() => {
    activeThreadKeyRef.current = screen === "thread"
      ? selectedConversation?.conversation_id ?? (draftRecipient ? `draft:${draftRecipient.user_id}` : null)
      : null
  }, [draftRecipient?.user_id, screen, selectedConversation?.conversation_id])

  const refreshInbox = useCallback(async () => {
    try {
      const rows = await listDmConversations()
      setConversations(rows)
      return rows
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Could not load your messages."))
      return null
    }
  }, [])

  const incomingRequests = conversations.filter(
    (conversation) => conversation.status === "pending" && conversation.requested_by !== userId
  )
  const visibleConversations = inboxTab === "requests"
    ? incomingRequests
    : conversations.filter(
      (conversation) => conversation.status === "accepted" || conversation.requested_by === userId
    )

  useEffect(() => {
    closeButtonRef.current?.focus({ preventScroll: true })
    const previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose()
        return
      }

      if (event.key !== "Tab") return
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
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
    return () => {
      document.body.style.overflow = previousBodyOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  useEffect(() => {
    if (preview) {
      setInboxLoading(false)
      return undefined
    }

    if (!supabase) {
      setError("Supabase is not configured.")
      setInboxLoading(false)
      return undefined
    }

    let active = true
    let refreshTimer
    setInboxLoading(true)
    void refreshInbox().finally(() => {
      if (active) setInboxLoading(false)
    })

    const channel = subscribeToDmInbox(
      userId,
      () => {
        window.clearTimeout(refreshTimer)
        refreshTimer = window.setTimeout(() => {
          if (active) void refreshInbox()
        }, 150)
      },
      (channelError) => {
        if (active) {
          setError(getErrorMessage(channelError, "Real-time inbox updates are unavailable."))
        }
      }
    )

    return () => {
      active = false
      window.clearTimeout(refreshTimer)
      void removeDmChannel(channel).catch((cleanupError) => {
        console.error("Could not close the direct-message inbox subscription.", cleanupError)
      })
    }
  }, [preview, refreshInbox, userId])

  useEffect(() => {
    if (screen !== "search") return undefined

    const query = searchTerm.trim()
    if (query.length < 2) {
      setSearchResults([])
      setSearchLoading(false)
      return undefined
    }

    if (preview) {
      const normalizedQuery = query.toLocaleLowerCase()
      setSearchResults(PREVIEW_PROFILES.filter((profile) => (
        profile.user_id !== userId
        && profile.username.toLocaleLowerCase().startsWith(normalizedQuery)
      )))
      setSearchLoading(false)
      return undefined
    }

    let active = true
    setSearchLoading(true)
    const timeout = window.setTimeout(async () => {
      try {
        const results = await searchDmUsers(query)
        if (active) setSearchResults(results)
      } catch (searchError) {
        if (active) setError(getErrorMessage(searchError, "Could not search for people."))
      } finally {
        if (active) setSearchLoading(false)
      }
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [preview, screen, searchTerm, userId])

  useEffect(() => {
    const conversationId = selectedConversation?.conversation_id
    if (screen !== "thread" || !conversationId) return undefined

    if (preview) {
      setMessages(previewMessages[conversationId] ?? [])
      setMessagesLoading(false)
      setHasOlderMessages(false)
      return undefined
    }
    if (!supabase) return undefined

    let active = true
    setMessages([])
    setMessagesLoading(true)
    setHasOlderMessages(false)

    const channel = subscribeToDmMessages(
      conversationId,
      (payload) => {
        if (!active) return
        if (payload.eventType === "DELETE") {
          const deletedId = payload.old?.id
          if (deletedId) {
            setMessages((current) => current.filter((message) => message.id !== deletedId))
          }
          return
        }

        const changedMessage = payload.new
        if (!changedMessage || typeof changedMessage.id !== "string") return
        setMessages((current) => mergeMessages(current, [changedMessage]))

        if (payload.eventType === "INSERT" && changedMessage.sender_id !== userId) {
          void markDmConversationRead(conversationId)
            .then(() => refreshInbox())
            .catch((readError) => {
              if (active) {
                setError(getErrorMessage(readError, "Could not mark the message as read."))
              }
            })
        } else if (payload.eventType === "UPDATE") {
          void refreshInbox()
        }
      },
      (channelError) => {
        if (active) {
          setError(getErrorMessage(channelError, "Real-time conversation updates are unavailable."))
        }
      }
    )

    async function loadMessages() {
      try {
        const rows = await listDmMessages(conversationId)
        if (!active) return
        setMessages((current) => mergeMessages(current, rows))
        setHasOlderMessages(rows.length === 100)
        await markDmConversationRead(conversationId)
        if (active) {
          setConversations((current) => current.map((conversation) => (
            conversation.conversation_id === conversationId
              ? { ...conversation, unread_count: 0 }
              : conversation
          )))
        }
      } catch (loadError) {
        if (active) setError(getErrorMessage(loadError, "Could not load this conversation."))
      } finally {
        if (active) setMessagesLoading(false)
      }
    }

    void loadMessages()
    return () => {
      active = false
      void removeDmChannel(channel).catch((cleanupError) => {
        console.error("Could not close the direct-message conversation subscription.", cleanupError)
      })
    }
  }, [preview, previewMessages, refreshInbox, screen, selectedConversation?.conversation_id, userId])

  useEffect(() => {
    if (screen !== "thread") {
      preserveScrollRef.current = null
      return
    }
    const previousScroll = preserveScrollRef.current
    if (previousScroll) {
      preserveScrollRef.current = null
      const list = messageListRef.current
      list?.scrollTo({
        top: previousScroll.scrollTop + list.scrollHeight - previousScroll.scrollHeight,
      })
      return
    }
    messageEndRef.current?.scrollIntoView({ block: "end" })
  }, [messages, screen])

  function openConversation(conversation, origin = screen) {
    setError("")
    setDraftRecipient(null)
    setSelectedConversation(conversation)
    setThreadOrigin(origin)
    setScreen("thread")
  }

  function selectSearchResult(profile) {
    const existing = conversations.find(
      (conversation) => conversation.other_user_id === profile.user_id
    )
    if (existing) {
      openConversation(existing, "search")
      return
    }

    setError("")
    setMessages([])
    setMessageText("")
    setSelectedConversation(null)
    setDraftRecipient(profile)
    setThreadOrigin("search")
    setScreen("thread")
  }

  function returnToThreadOrigin() {
    setSelectedConversation(null)
    setDraftRecipient(null)
    setMessages([])
    setError("")
    setScreen(threadOrigin)
  }

  async function handleRequestResponse(conversation, acceptRequest) {
    setRespondingId(conversation.conversation_id)
    setError("")
    try {
      const status = preview
        ? acceptRequest ? "accepted" : "declined"
        : await respondToDmRequest(conversation.conversation_id, acceptRequest)
      if (preview) {
        setConversations((current) => current.map((item) => (
          item.conversation_id === conversation.conversation_id ? { ...item, status } : item
        )))
      } else {
        await refreshInbox()
      }
      if (activeThreadKeyRef.current === conversation.conversation_id) {
        if (acceptRequest) {
          setSelectedConversation((current) => (
            current?.conversation_id === conversation.conversation_id
              ? { ...current, status }
              : current
          ))
        } else {
          setSelectedConversation((current) => (
            current?.conversation_id === conversation.conversation_id ? null : current
          ))
          setMessages([])
          setInboxTab("requests")
          setScreen("inbox")
        }
      }
    } catch (responseError) {
      setError(getErrorMessage(responseError, "Could not update this message request."))
    } finally {
      setRespondingId(null)
    }
  }

  async function handleDeleteConversation() {
    if (!selectedConversation) return
    const conversationId = selectedConversation.conversation_id
    const confirmed = window.confirm(
      "Remove this conversation from your inbox? The other person keeps their copy."
    )
    if (!confirmed) return

    setDeleting(true)
    setError("")
    try {
      if (preview) {
        setConversations((current) => current.filter(
          (conversation) => conversation.conversation_id !== conversationId
        ))
      } else {
        await deleteDmConversationForCurrentUser(conversationId)
      }
      if (activeThreadKeyRef.current === conversationId) {
        setSelectedConversation(null)
        setMessages([])
        setInboxTab("messages")
        setScreen("inbox")
      }
      if (!preview) await refreshInbox()
    } catch (deleteError) {
      setError(getErrorMessage(deleteError, "Could not remove this conversation."))
    } finally {
      setDeleting(false)
    }
  }

  async function handleLoadOlderMessages() {
    const conversationId = selectedConversation?.conversation_id
    const oldestMessage = messages[0]
    if (!conversationId || !oldestMessage || olderMessagesLoading) return

    setOlderMessagesLoading(true)
    try {
      const older = await listDmMessages(conversationId, {
        createdAt: oldestMessage.created_at,
        id: oldestMessage.id,
      })
      if (activeThreadKeyRef.current !== conversationId) return
      const messageList = messageListRef.current
      if (older.length > 0 && messageList) {
        preserveScrollRef.current = {
          scrollTop: messageList.scrollTop,
          scrollHeight: messageList.scrollHeight,
        }
      }
      setMessages((current) => mergeMessages(older, current))
      setHasOlderMessages(older.length === 100)
    } catch (loadError) {
      preserveScrollRef.current = null
      setError(getErrorMessage(loadError, "Could not load older messages."))
    } finally {
      setOlderMessagesLoading(false)
    }
  }

  async function handleSendMessage(event) {
    event.preventDefault()
    const body = messageText.trim()
    if (!body || sending) return

    setSending(true)
    setError("")
    try {
      if (draftRecipient) {
        const recipient = draftRecipient
        const draftKey = `draft:${recipient.user_id}`
        if (preview) {
          const conversationId = `preview-conversation-${recipient.user_id}`
          const createdAt = new Date().toISOString()
          const message = {
            id: `preview-message-${Date.now()}`,
            conversation_id: conversationId,
            sender_id: userId,
            body,
            created_at: createdAt,
            read_at: null,
          }
          const conversation = {
            conversation_id: conversationId,
            other_user_id: recipient.user_id,
            username: recipient.username,
            status: "pending",
            requested_by: userId,
            unread_count: 0,
            last_message_body: body,
            last_message_sender_id: userId,
            last_message_at: createdAt,
          }

          setPreviewMessages((current) => ({ ...current, [conversationId]: [message] }))
          setConversations((current) => [conversation, ...current])
          setSelectedConversation(conversation)
          setDraftRecipient(null)
          setThreadOrigin("inbox")
          setMessageText("")
          return
        }

        const started = await startDmConversation(recipient.user_id, body)
        if (activeThreadKeyRef.current !== draftKey) {
          await refreshInbox()
          return
        }
        const conversation = {
          conversation_id: started.conversation_id,
          other_user_id: recipient.user_id,
          username: recipient.username,
          status: started.status,
          requested_by: started.requested_by,
          unread_count: 0,
          last_message_body: started.message_sent ? body : null,
          last_message_sender_id: started.message_sent ? userId : null,
          last_message_at: null,
        }

        setSelectedConversation(conversation)
        setDraftRecipient(null)
        setThreadOrigin("inbox")
        if (started.message_sent) setMessageText("")
        else {
          setError(
            started.requested_by === userId
              ? "Your message request is still pending."
              : "This person sent you a request. Accept it before replying."
          )
        }

        const rows = await refreshInbox()
        const refreshedConversation = rows?.find(
          (item) => item.conversation_id === started.conversation_id
        )
        if (refreshedConversation) setSelectedConversation(refreshedConversation)
      } else if (selectedConversation?.status === "accepted") {
        const conversationId = selectedConversation.conversation_id
        if (preview) {
          const createdAt = new Date().toISOString()
          const message = {
            id: `preview-message-${Date.now()}`,
            conversation_id: conversationId,
            sender_id: userId,
            body,
            created_at: createdAt,
            read_at: null,
          }
          setPreviewMessages((current) => ({
            ...current,
            [conversationId]: mergeMessages(current[conversationId] ?? [], [message]),
          }))
          setConversations((current) => current.map((conversation) => (
            conversation.conversation_id === conversationId
              ? {
                ...conversation,
                last_message_body: body,
                last_message_sender_id: userId,
                last_message_at: createdAt,
                unread_count: 0,
              }
              : conversation
          )))
          setMessageText("")
          return
        }

        await sendDmMessage(conversationId, body)
        if (activeThreadKeyRef.current !== conversationId) {
          await refreshInbox()
          return
        }
        setMessageText("")
        const [latestPage] = await Promise.all([
          listDmMessages(conversationId),
          refreshInbox(),
        ])
        if (activeThreadKeyRef.current === conversationId) {
          setMessages((current) => mergeMessages(current, latestPage))
        }
      } else {
        setError("This conversation is not ready for messages yet.")
      }
    } catch (sendError) {
      setError(getErrorMessage(sendError, "Could not send this message."))
    } finally {
      setSending(false)
    }
  }

  const conversationTitle = selectedConversation
    ? `@${selectedConversation.username}`
    : draftRecipient
      ? `@${draftRecipient.username}`
      : ""
  const requestRecipient = selectedConversation?.status === "pending"
    && selectedConversation.requested_by !== userId
  const outgoingRequest = selectedConversation?.status === "pending"
    && selectedConversation.requested_by === userId
  const messageComposerEnabled = Boolean(draftRecipient) || selectedConversation?.status === "accepted"

  return (
    <section
      ref={dialogRef}
      aria-label="Direct messages"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex flex-col bg-white shadow-2xl sm:inset-auto sm:bottom-24 sm:right-6 sm:h-[min(44rem,calc(100dvh-7rem))] sm:w-[min(26rem,calc(100vw-3rem))] sm:rounded-2xl sm:border sm:border-[#e7ece8]"
      role="dialog"
    >
      <header className="flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center justify-between border-b border-[#edf0ed] px-4 pt-[env(safe-area-inset-top)] sm:h-14 sm:rounded-t-2xl sm:pt-0">
        <div className="flex min-w-0 items-center gap-2">
          {screen === "thread" && (
            <button
              aria-label="Back to messages"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#555] hover:bg-[#f5f8f6] focus-visible:outline-2 focus-visible:outline-[#3ecf8e]"
              onClick={returnToThreadOrigin}
              type="button"
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
            </button>
          )}
          {screen === "search" && (
            <button
              aria-label="Back to messages"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#555] hover:bg-[#f5f8f6] focus-visible:outline-2 focus-visible:outline-[#3ecf8e]"
              onClick={() => setScreen("inbox")}
              type="button"
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
            </button>
          )}
          {screen === "inbox" && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#edf8f0] text-[#16803c]">
              <MessageCircle aria-hidden="true" className="size-[18px]" />
            </span>
          )}
          <h2 className="truncate text-[15px] font-semibold">
            {screen === "inbox"
              ? "Messages"
              : screen === "search"
                ? "New message"
                : conversationTitle}
          </h2>
          {preview && (
            <span className="shrink-0 rounded-full bg-[#f2f5f3] px-2 py-1 text-[10px] font-medium text-[#737b75]">
              Preview
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {screen === "inbox" && (
            <button
              aria-label="Find people"
              className="flex size-9 items-center justify-center rounded-full text-[#555] hover:bg-[#f5f8f6] focus-visible:outline-2 focus-visible:outline-[#3ecf8e]"
              onClick={() => {
                setSearchTerm("")
                setSearchResults([])
                setError("")
                setScreen("search")
              }}
              type="button"
            >
              <Search aria-hidden="true" className="size-[19px]" />
            </button>
          )}
          {screen === "thread" && selectedConversation && (
            <button
              aria-label="Delete conversation for me"
              className="flex size-9 items-center justify-center rounded-full text-[#777] hover:bg-[#fdf0ef] hover:text-[#b42318] focus-visible:outline-2 focus-visible:outline-[#3ecf8e] disabled:opacity-50"
              disabled={deleting}
              onClick={handleDeleteConversation}
              type="button"
            >
              {deleting
                ? <LoaderCircle aria-hidden="true" className="size-[18px] animate-spin" />
                : <Trash2 aria-hidden="true" className="size-[18px]" />}
            </button>
          )}
          <button
            ref={closeButtonRef}
            aria-label="Close direct messages"
            className="flex size-9 items-center justify-center rounded-full text-[#555] hover:bg-[#f5f8f6] focus-visible:outline-2 focus-visible:outline-[#3ecf8e]"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
      </header>

      {screen === "inbox" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div aria-label="Message folders" className="flex shrink-0 border-b border-[#f1f3f1] px-4">
            {[
              { id: "messages", label: "Messages" },
              { id: "requests", label: "Requests", count: incomingRequests.length },
            ].map((tab) => (
              <button
                key={tab.id}
                aria-pressed={inboxTab === tab.id}
                className={`relative flex min-h-11 items-center gap-2 px-3 text-sm font-medium ${
                  inboxTab === tab.id
                    ? "text-[#073b24] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[#3ecf8e]"
                    : "text-[#7a817d] hover:text-[#303833]"
                }`}
                onClick={() => setInboxTab(tab.id)}
                type="button"
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="flex min-w-5 items-center justify-center rounded-full bg-[#3ecf8e] px-1.5 py-0.5 text-[10px] font-semibold text-[#073b24]">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {error && (
            <p aria-live="polite" className="mx-4 mt-3 rounded-xl bg-[#fff1f0] px-3 py-2 text-xs text-[#b42318]" role="alert">
              {error}
            </p>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {inboxLoading ? (
              <div className="flex h-full items-center justify-center text-[#8a928c]">
                <LoaderCircle aria-label="Loading messages" className="size-6 animate-spin" />
              </div>
            ) : visibleConversations.length === 0 ? (
              <div className="flex min-h-full flex-col items-center justify-center px-6 py-10 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-[#f5f8f6] text-[#9aa9a0]">
                  {inboxTab === "requests"
                    ? <UserRound aria-hidden="true" className="size-6" />
                    : <MessageCircle aria-hidden="true" className="size-6" />}
                </span>
                <p className="mt-3 text-sm font-medium text-[#303833]">
                  {inboxTab === "requests" ? "No message requests" : "No conversations yet"}
                </p>
                <p className="mt-1 text-xs text-[#858d88]">
                  {inboxTab === "requests"
                    ? "New requests from people will appear here."
                    : "Find someone to start a private conversation."}
                </p>
              </div>
            ) : inboxTab === "requests" ? (
              <ul aria-label="Message requests" className="divide-y divide-[#f1f3f1]">
                {visibleConversations.map((conversation) => (
                  <li key={conversation.conversation_id} className="p-4">
                    <button
                      aria-label={`Read message request from @${conversation.username}`}
                      className="flex w-full items-center gap-3 text-left"
                      onClick={() => openConversation(conversation, "inbox")}
                      type="button"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f5f8f6] text-[#738078]">
                        <UserRound aria-hidden="true" className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">@{conversation.username}</span>
                        <span className="mt-0.5 block truncate text-xs text-[#818983]">
                          {conversation.last_message_body}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-[#929a94]">
                        {formatInboxTime(conversation.last_message_at)}
                      </span>
                    </button>
                    <div className="mt-3 flex justify-end gap-2">
                      <button
                        className="min-h-9 rounded-xl border border-[#e7ece8] px-3 text-xs font-medium text-[#5b625e] hover:bg-[#f7f9f7] disabled:opacity-50"
                        disabled={respondingId === conversation.conversation_id}
                        onClick={() => handleRequestResponse(conversation, false)}
                        type="button"
                      >
                        Decline
                      </button>
                      <button
                        className="min-h-9 rounded-xl bg-[#3ecf8e] px-3 text-xs font-semibold text-[#073b24] hover:bg-[#32bd80] disabled:opacity-50"
                        disabled={respondingId === conversation.conversation_id}
                        onClick={() => handleRequestResponse(conversation, true)}
                        type="button"
                      >
                        {respondingId === conversation.conversation_id ? "Updating..." : "Accept"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <ul aria-label="Conversations" className="divide-y divide-[#f1f3f1]">
                {visibleConversations.map((conversation) => (
                  <li key={conversation.conversation_id}>
                    <button
                      aria-label={`Open conversation with @${conversation.username}`}
                      className="flex min-h-[76px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#fafcfb]"
                      onClick={() => openConversation(conversation, "inbox")}
                      type="button"
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#f5f8f6] text-[#738078]">
                        <UserRound aria-hidden="true" className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">@{conversation.username}</span>
                        <span className="mt-1 block truncate text-xs text-[#818983]">
                          {conversation.status === "pending"
                            ? "Message request pending"
                            : `${conversation.last_message_sender_id === userId ? "You: " : ""}${conversation.last_message_body ?? ""}`}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1.5">
                        <span className="text-[10px] text-[#929a94]">
                          {conversation.status === "pending" ? "Pending" : formatInboxTime(conversation.last_message_at)}
                        </span>
                        {conversation.unread_count > 0 && (
                          <span className="flex min-w-5 items-center justify-center rounded-full bg-[#3ecf8e] px-1.5 py-0.5 text-[10px] font-semibold text-[#073b24]">
                            {conversation.unread_count}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {screen === "search" && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 p-4">
            <label className="relative block">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-[17px] -translate-y-1/2 text-[#929a94]" />
              <input
                autoComplete="off"
                autoFocus
                className="h-11 w-full rounded-2xl border border-[#e3e8e4] bg-white pl-10 pr-3 text-sm outline-none focus:border-[#3ecf8e] focus:ring-2 focus:ring-[#3ecf8e]/20"
                onChange={(event) => {
                  setSearchTerm(event.target.value)
                  setError("")
                }}
                placeholder="Search usernames"
                type="search"
                value={searchTerm}
              />
            </label>
          </div>

          {error && (
            <p aria-live="polite" className="mx-4 mb-2 rounded-xl bg-[#fff1f0] px-3 py-2 text-xs text-[#b42318]" role="alert">
              {error}
            </p>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {searchLoading ? (
              <div className="flex h-full items-center justify-center text-[#8a928c]">
                <LoaderCircle aria-label="Searching" className="size-6 animate-spin" />
              </div>
            ) : searchTerm.trim().length < 2 ? (
              <p className="px-5 py-4 text-sm text-[#818983]">Enter at least 2 characters to search.</p>
            ) : searchResults.length === 0 ? (
              <p className="px-5 py-4 text-sm text-[#818983]">No people found.</p>
            ) : (
              <ul aria-label="People" className="divide-y divide-[#f1f3f1]">
                {searchResults.map((profile) => (
                  <li key={profile.user_id}>
                    <button
                      aria-label={`Start a conversation with @${profile.username}`}
                      className="flex min-h-16 w-full items-center gap-3 px-4 text-left hover:bg-[#fafcfb]"
                      onClick={() => selectSearchResult(profile)}
                      type="button"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f5f8f6] text-[#738078]">
                        <UserRound aria-hidden="true" className="size-5" />
                      </span>
                      <span className="flex-1 truncate text-sm font-medium">@{profile.username}</span>
                      <MessageCircle aria-hidden="true" className="size-[18px] text-[#16803c]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {screen === "thread" && (
        <div className="flex min-h-0 flex-1 flex-col">
          {error && (
            <p aria-live="polite" className="mx-4 mt-3 rounded-xl bg-[#fff1f0] px-3 py-2 text-xs text-[#b42318]" role="alert">
              {error}
            </p>
          )}

          {requestRecipient && (
            <div className="shrink-0 border-b border-[#edf0ed] bg-[#f8fbf9] px-4 py-3">
              <p className="text-xs leading-5 text-[#59635d]">
                This person wants to message you. Accept the request to continue the conversation.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  className="min-h-9 flex-1 rounded-xl border border-[#e3e8e4] text-xs font-medium text-[#59635d] hover:bg-white disabled:opacity-50"
                  disabled={respondingId === selectedConversation.conversation_id}
                  onClick={() => handleRequestResponse(selectedConversation, false)}
                  type="button"
                >
                  Decline
                </button>
                <button
                  className="min-h-9 flex-1 rounded-xl bg-[#3ecf8e] text-xs font-semibold text-[#073b24] hover:bg-[#32bd80] disabled:opacity-50"
                  disabled={respondingId === selectedConversation.conversation_id}
                  onClick={() => handleRequestResponse(selectedConversation, true)}
                  type="button"
                >
                  {respondingId === selectedConversation.conversation_id ? "Updating..." : "Accept"}
                </button>
              </div>
            </div>
          )}

          {outgoingRequest && (
            <p className="shrink-0 border-b border-[#edf0ed] bg-[#f8fbf9] px-4 py-3 text-xs text-[#59635d]">
              Your message request is waiting for a response.
            </p>
          )}

          <div
            ref={messageListRef}
            aria-label={`Messages with ${conversationTitle}`}
            aria-live="polite"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4"
            role="log"
          >
            {hasOlderMessages && (
              <div className="mb-4 text-center">
                <button
                  className="rounded-full px-3 py-1.5 text-xs font-medium text-[#16803c] hover:bg-[#f5f8f6] disabled:opacity-50"
                  disabled={olderMessagesLoading}
                  onClick={handleLoadOlderMessages}
                  type="button"
                >
                  {olderMessagesLoading ? "Loading..." : "Load earlier messages"}
                </button>
              </div>
            )}
            {messagesLoading && messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[#8a928c]">
                <LoaderCircle aria-label="Loading conversation" className="size-6 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-[#f5f8f6] text-[#9aa9a0]">
                  <MessageCircle aria-hidden="true" className="size-6" />
                </span>
                <p className="mt-3 text-sm font-medium text-[#303833]">Start the conversation</p>
                <p className="mt-1 text-xs text-[#858d88]">Messages are private and text-only.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {messages.map((message) => {
                  const isOwnMessage = message.sender_id === userId
                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 ${
                          isOwnMessage
                            ? "rounded-br-md bg-[#3ecf8e] text-[#073b24]"
                            : "rounded-bl-md bg-[#f2f5f3] text-[#303833]"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm leading-5">{message.body}</p>
                        <span className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${
                          isOwnMessage ? "text-[#275c43]" : "text-[#858d88]"
                        }`}>
                          <time dateTime={message.created_at}>{formatTime(message.created_at)}</time>
                          {isOwnMessage && message.read_at && (
                            <>
                              <span className="sr-only">Seen</span>
                              <CheckCheck aria-hidden="true" className="size-3.5" />
                            </>
                          )}
                          {isOwnMessage && !message.read_at && (
                            <Check aria-label="Sent" className="size-3" />
                          )}
                        </span>
                      </div>
                    </div>
                  )
                })}
                <div ref={messageEndRef} />
              </div>
            )}
          </div>

          {messageComposerEnabled && (
            <form
              className="flex shrink-0 items-end gap-2 border-t border-[#edf0ed] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
              onSubmit={handleSendMessage}
            >
              <input
                ref={messageInputRef}
                aria-label="Write a message"
                className="h-11 min-w-0 flex-1 rounded-2xl border border-[#e3e8e4] bg-white px-3.5 text-sm outline-none focus:border-[#3ecf8e] focus:ring-2 focus:ring-[#3ecf8e]/20"
                maxLength={MESSAGE_LIMIT}
                onChange={(event) => setMessageText(event.target.value)}
                placeholder="Message..."
                value={messageText}
              />
              <button
                aria-label="Send message"
                className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#3ecf8e] text-[#073b24] transition-colors hover:bg-[#32bd80] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ecf8e] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!messageText.trim() || sending}
                type="submit"
              >
                {sending
                  ? <LoaderCircle aria-hidden="true" className="size-[19px] animate-spin" />
                  : <Send aria-hidden="true" className="size-[19px]" />}
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  )
}
