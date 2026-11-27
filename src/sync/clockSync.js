export function createClockSync() {
  let offsetMs = 0
  let hasSample = false

  return {
    observe(sentAt, serverAt, receivedAt = Date.now()) {
      if (![sentAt, serverAt, receivedAt].every(Number.isFinite) || receivedAt < sentAt) return

      const sample = serverAt - ((sentAt + receivedAt) / 2)
      offsetMs = hasSample ? (offsetMs * 0.75) + (sample * 0.25) : sample
      hasSample = true
    },
    getOffsetMs() {
      return offsetMs
    },
  }
}
