import { supabase } from "@/lib/supabase"

function getClient() {
  if (!supabase) {
    throw new Error("Supabase is not configured.")
  }
  return supabase
}

async function callRpc(functionName, parameters = {}) {
  const { data, error } = await getClient().rpc(functionName, parameters)
  if (error) throw error
  return data
}

function expectRows(data, operation) {
  if (!Array.isArray(data)) {
    throw new Error(`Unexpected response while ${operation}.`)
  }
  return data
}

export async function isDmUsernameAvailable(username) {
  const data = await callRpc("dm_is_username_available", {
    requested_username: username,
  })

  if (typeof data !== "boolean") {
    throw new Error("Unexpected response while checking username availability.")
  }

  return data
}

export async function searchDmUsers(searchTerm) {
  const data = await callRpc("dm_search_users", { search_term: searchTerm })
  return expectRows(data, "searching for people")
}

export async function getDmProfilesByIds(userIds) {
  const data = await callRpc("dm_get_profiles_by_ids", {
    target_user_ids: userIds,
  })
  return expectRows(data, "loading people")
}

export async function listDmConversations() {
  const data = await callRpc("dm_list_conversations")
  return expectRows(data, "loading messages")
}

export async function listDmMessages(conversationId, before = null) {
  let query = getClient()
    .from("dm_messages")
    .select("id,conversation_id,sender_id,body,created_at,read_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(100)

  if (before) {
    query = query.or(
      `created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id})`
    )
  }

  const { data, error } = await query
  if (error) throw error
  return expectRows(data, "loading messages").reverse()
}

export async function startDmConversation(targetUserId, messageBody) {
  const data = await callRpc("dm_start_conversation", {
    target_user_id: targetUserId,
    message_body: messageBody,
  })

  if (
    !data
    || typeof data.conversation_id !== "string"
    || !["pending", "accepted"].includes(data.status)
    || typeof data.requested_by !== "string"
    || typeof data.message_sent !== "boolean"
  ) {
    throw new Error("Unexpected response while starting a conversation.")
  }

  return data
}

export async function sendDmMessage(conversationId, messageBody) {
  const data = await callRpc("dm_send_message", {
    conversation_id: conversationId,
    message_body: messageBody,
  })

  if (typeof data !== "string") {
    throw new Error("Unexpected response while sending a message.")
  }

  return data
}

export async function respondToDmRequest(conversationId, acceptRequest) {
  const data = await callRpc("dm_respond_to_request", {
    conversation_id: conversationId,
    accept_request: acceptRequest,
  })

  if (data !== (acceptRequest ? "accepted" : "declined")) {
    throw new Error("Unexpected response while updating the message request.")
  }

  return data
}

export async function markDmConversationRead(conversationId) {
  const data = await callRpc("dm_mark_read", { conversation_id: conversationId })
  if (!Number.isInteger(data) || data < 0) {
    throw new Error("Unexpected response while marking messages as read.")
  }
  return data
}

export async function deleteDmConversationForCurrentUser(conversationId) {
  const data = await callRpc("dm_delete_conversation", { conversation_id: conversationId })
  if (data !== null) {
    throw new Error("Unexpected response while removing the conversation.")
  }
}

export function subscribeToDmInbox(userId, onChange, onError) {
  return getClient()
    .channel(`dm-inbox-${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "dm_conversations" },
      onChange
    )
    .subscribe((status, error) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onError(error ?? new Error("Real-time inbox updates are unavailable."))
      }
    })
}

export function subscribeToDmMessages(conversationId, onChange, onError) {
  return getClient()
    .channel(`dm-messages-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "dm_messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      onChange
    )
    .subscribe((status, error) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        onError(error ?? new Error("Real-time conversation updates are unavailable."))
      }
    })
}

export async function removeDmChannel(channel) {
  const result = await getClient().removeChannel(channel)
  if (result !== "ok") {
    throw new Error("Could not close the direct-message connection.")
  }
}
