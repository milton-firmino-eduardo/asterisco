export function getExpectedPosition(room, serverNowMs) {
  const positionReferenceMs = Math.max(
    room.server_ts_ms,
    room.start_at_server_ms ?? room.server_ts_ms
  )
  const elapsedSeconds = room.is_playing
    ? Math.max(0, (serverNowMs - positionReferenceMs) / 1000)
    : 0
  return room.position + (elapsedSeconds * room.playback_rate)
}

export function exceedsDriftTolerance(actualPosition, expectedPosition, toleranceSeconds) {
  return Math.abs(actualPosition - expectedPosition) >= toleranceSeconds
}
