const websocketEndpoint = import.meta.env.VITE_ASTERISCO_WS_URL

function getApiBaseUrl() {
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

  url.protocol = url.protocol === "wss:" ? "https:" : "http:"
  url.pathname = ""
  url.search = ""
  url.hash = ""
  return url.origin
}

export async function requestStreamPlaybackAccess(roomId, accessToken) {
  if (!roomId || typeof roomId !== "string") {
    throw new Error("The room ID is invalid.")
  }
  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("Your playback session has expired. Reconnect to the server.")
  }

  const response = await fetch(
    `${getApiBaseUrl()}/rooms/${encodeURIComponent(roomId)}/playback-access`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  )

  if (!response.ok) {
    let message = "Could not authorize video playback."
    try {
      const body = await response.json()
      if (typeof body?.detail === "string") message = body.detail
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error
    }
    throw new Error(message)
  }

  const access = await response.json()
  if (
    typeof access?.url !== "string"
    || !Number.isInteger(access.expires_at)
    || access.expires_at <= 0
  ) {
    throw new Error("The server returned invalid playback access.")
  }
  return access
}
