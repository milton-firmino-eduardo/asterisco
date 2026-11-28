import { useCallback, useEffect, useRef, useState } from "react"
import { NativePlayerBridge } from "@/bridge/nativePlayerBridge"
import {
  exceedsDriftTolerance,
  getExpectedPosition,
} from "@/sync/driftController"
import VideoControlsOverlay from "@/components/rooms/VideoControlsOverlay"

export default function WatchRoomView({
  room,
  currentUserId,
  onRequestPlaybackAccess,
  clockOffsetMs,
  onPlaybackAction,
  onRequestSync,
  onLeave,
}) {
  const videoRef = useRef(null)
  const bridgeRef = useRef(null)
  const readyRef = useRef(false)
  const roomRef = useRef(room)
  const clockOffsetRef = useRef(clockOffsetMs)
  const callbacksRef = useRef({ onPlaybackAction, onRequestSync, onLeave })
  const startTimerRef = useRef(null)
  const skipNextRoomApplyRef = useRef(false)
  const [playerState, setPlayerState] = useState({
    position: room.position,
    duration: 0,
    isPlaying: false,
    playbackBlocked: false,
    error: "",
  })

  roomRef.current = room
  clockOffsetRef.current = clockOffsetMs
  callbacksRef.current = { onPlaybackAction, onRequestSync, onLeave }
  const role = room.controller_id === currentUserId ? "CONTROLLER" : "VIEWER"

  const startRoomPlayback = useCallback(async (state) => {
    const bridge = bridgeRef.current
    if (!bridge || !readyRef.current) return
    window.clearTimeout(startTimerRef.current)

    bridge.setPlaybackRate(state.playback_rate)
    if (!state.is_playing) {
      bridge.pause(state.position)
      return
    }

    const serverNow = Date.now() + clockOffsetRef.current
    const delay = Math.max(0, (state.start_at_server_ms ?? 0) - serverNow)
    const expectedPosition = getExpectedPosition(state, serverNow)
    if (delay === 0) bridge.seekTo(expectedPosition)
    startTimerRef.current = window.setTimeout(() => {
      void bridge.play(delay > 0 ? state.position : expectedPosition).catch((error) => {
        setPlayerState((current) => ({
          ...current,
          playbackBlocked: true,
          error: error instanceof Error ? error.message : "The video could not be started.",
        }))
      })
    }, delay)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined

    let active = true
    let refreshTimer
    let bridge
    try {
      bridge = new NativePlayerBridge(video, (event) => {
        if (!active) return
        if (event.type === "ERROR") {
          setPlayerState((current) => ({ ...current, error: event.message }))
        } else if (event.type === "READY") {
          readyRef.current = true
          setPlayerState((current) => ({ ...current, duration: event.durationSec, error: "" }))
          void startRoomPlayback(roomRef.current)
        } else if (event.type === "PROGRESS") {
          setPlayerState((current) => ({
            ...current,
            position: event.positionSec,
            isPlaying: event.isPlaying,
          }))
        } else if (event.type === "PLAY") {
          setPlayerState((current) => ({
            ...current,
            isPlaying: true,
            playbackBlocked: false,
          }))
        } else if (event.type === "PAUSE") {
          setPlayerState((current) => ({
            ...current,
            position: event.positionSec,
            isPlaying: false,
          }))
        } else if (event.type === "BUFFERING_END") {
          callbacksRef.current.onRequestSync()
        }
      })
      bridgeRef.current = bridge
      const loadAuthorizedStream = async () => {
        const access = await onRequestPlaybackAccess(room.room_id)
        if (!active) return

        await bridge.loadStream({
          url: access.url,
          initialPositionSec: Number.isFinite(video.currentTime)
            ? video.currentTime
            : roomRef.current.position,
          playbackRate: roomRef.current.playback_rate,
          autoPlay: false,
        })

        const serverNow = Date.now() + clockOffsetRef.current
        const refreshInMs = Math.max(30_000, access.expires_at * 1000 - serverNow - 60_000)
        refreshTimer = window.setTimeout(() => {
          loadAuthorizedStream().catch((error) => {
            if (active) {
              setPlayerState((current) => ({
                ...current,
                error: error instanceof Error ? error.message : "Could not renew video access.",
              }))
            }
          })
        }, refreshInMs)
      }

      void loadAuthorizedStream().catch((error) => {
        if (active) {
          setPlayerState((current) => ({
            ...current,
            error: error instanceof Error ? error.message : "The video stream could not be loaded.",
          }))
        }
      })
    } catch (error) {
      setPlayerState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "The video stream could not be loaded.",
      }))
    }

    return () => {
      active = false
      readyRef.current = false
      window.clearTimeout(refreshTimer)
      window.clearTimeout(startTimerRef.current)
      bridge?.release()
      if (bridgeRef.current === bridge) bridgeRef.current = null
    }
  }, [onRequestPlaybackAccess, room.room_id, room.video_id, startRoomPlayback])

  useEffect(() => {
    if (!bridgeRef.current) return
    if (skipNextRoomApplyRef.current) {
      skipNextRoomApplyRef.current = false
      return
    }
    void startRoomPlayback(room)
  }, [room.is_playing, room.position, room.playback_rate, room.server_ts_ms, room.start_at_server_ms, startRoomPlayback])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const bridge = bridgeRef.current
      const state = roomRef.current
      if (!bridge || !state.is_playing || !videoRef.current || videoRef.current.paused) return
      const expected = getExpectedPosition(state, Date.now() + clockOffsetRef.current)
      if (exceedsDriftTolerance(
        videoRef.current.currentTime,
        expected,
        state.drift_tolerance_seconds ?? 0.4
      )) {
        bridge.seekTo(expected)
      }
    }, 2000)

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") callbacksRef.current.onRequestSync()
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  function performAction(action, timestamp = videoRef.current?.currentTime ?? 0, playbackRate) {
    const bridge = bridgeRef.current
    if (!bridge || !readyRef.current || role !== "CONTROLLER") return

    if (action === "play") {
      void bridge.play(timestamp).catch((error) => {
        setPlayerState((current) => ({
          ...current,
          playbackBlocked: true,
          error: error instanceof Error ? error.message : "The video could not be started.",
        }))
      })
    } else if (action === "pause") bridge.pause(timestamp)
    else if (action === "seek") bridge.seekTo(timestamp)
    else if (action === "playback_rate") bridge.setPlaybackRate(playbackRate)

    const sent = callbacksRef.current.onPlaybackAction({
      action,
      timestamp,
      playback_rate: playbackRate,
    })
    skipNextRoomApplyRef.current = sent === true
  }

  function previewSeek(position) {
    if (readyRef.current && role === "CONTROLLER") bridgeRef.current?.seekTo(position)
  }

  function enablePlaybackFromGesture() {
    const state = roomRef.current
    if (!state.is_playing) return
    const expected = getExpectedPosition(state, Date.now() + clockOffsetRef.current)
    void bridgeRef.current?.play(expected).then(() => {
      setPlayerState((current) => ({ ...current, error: "", playbackBlocked: false }))
    }).catch((error) => {
      setPlayerState((current) => ({
        ...current,
        playbackBlocked: true,
        error: error instanceof Error ? error.message : "The video could not be started.",
      }))
    })
  }

  return (
    <section aria-label="Shared video player" className="mt-5 overflow-hidden rounded-2xl bg-black">
      <video
        ref={videoRef}
        aria-label="Shared video"
        className="aspect-video w-full bg-black"
        controls={false}
        playsInline
      />
      {playerState.error && (
        <p aria-live="polite" className="bg-[#fff1f0] px-3 py-2 text-xs text-[#b42318]" role="alert">
          {playerState.error}
        </p>
      )}
      <VideoControlsOverlay
        duration={playerState.duration}
        isPlaying={playerState.isPlaying}
        onLeave={onLeave}
        onEnablePlayback={enablePlaybackFromGesture}
        onPause={() => performAction("pause")}
        onPlaybackRate={(rate) => performAction("playback_rate", videoRef.current?.currentTime, rate)}
        onPlay={() => performAction("play")}
        onSeekCommit={(position) => performAction("seek", position)}
        onSeekPreview={previewSeek}
        position={playerState.position}
        playbackReady={playerState.duration > 0}
        needsPlaybackGesture={playerState.playbackBlocked}
        role={role}
        videoRef={videoRef}
      />
    </section>
  )
}
