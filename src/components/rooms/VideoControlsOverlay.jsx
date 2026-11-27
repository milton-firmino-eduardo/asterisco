import { useState } from "react"
import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react"

const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 2]

export default function VideoControlsOverlay({
  role,
  position,
  duration,
  isPlaying,
  playbackReady,
  videoRef,
  onPlay,
  onPause,
  onSeekPreview,
  onSeekCommit,
  onPlaybackRate,
  needsPlaybackGesture,
  onEnablePlayback,
  onLeave,
}) {
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)

  function updateVolume(value) {
    const nextVolume = Number(value)
    setVolume(nextVolume)
    if (videoRef.current) videoRef.current.volume = nextVolume
  }

  function toggleMuted() {
    const nextMuted = !muted
    setMuted(nextMuted)
    if (videoRef.current) videoRef.current.muted = nextMuted
  }

  async function toggleFullscreen() {
    const player = videoRef.current
    if (!player) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await player.requestFullscreen()
    }
  }

  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0

  return (
    <div className="space-y-3 rounded-b-2xl bg-[#111] p-3 text-white">
      <label className="sr-only" htmlFor="watch-position">Playback position</label>
      <input
        className="w-full accent-[#3ecf8e]"
        id="watch-position"
        max={safeDuration || 1}
        min="0"
        onChange={(event) => onSeekPreview(Number(event.target.value))}
        onKeyUp={(event) => onSeekCommit(Number(event.currentTarget.value))}
        onPointerUp={(event) => onSeekCommit(Number(event.currentTarget.value))}
        disabled={role !== "CONTROLLER" || !safeDuration}
        type="range"
        value={Math.min(position, safeDuration || position)}
      />

      <div className="flex items-center gap-3">
        {needsPlaybackGesture && (
          <button
            className="rounded-lg bg-[#3ecf8e] px-3 py-2 text-xs font-semibold text-[#073b24]"
            onClick={onEnablePlayback}
            type="button"
          >
            Start synced playback
          </button>
        )}
        {role === "CONTROLLER" && (
          <>
            <button
              aria-label={isPlaying ? "Pause video" : "Play video"}
              className="flex size-9 items-center justify-center rounded-full hover:bg-white/10"
              disabled={!playbackReady}
              onClick={isPlaying ? onPause : onPlay}
              type="button"
            >
              {isPlaying ? <Pause aria-hidden="true" size={18} /> : <Play aria-hidden="true" size={18} />}
            </button>
            <button
              aria-label="Seek backward 10 seconds"
              className="rounded px-2 py-1 text-xs hover:bg-white/10"
              disabled={!playbackReady}
              onClick={() => onSeekCommit(Math.max(0, position - 10))}
              type="button"
            >
              -10s
            </button>
            <button
              aria-label="Seek forward 10 seconds"
              className="rounded px-2 py-1 text-xs hover:bg-white/10"
              disabled={!playbackReady}
              onClick={() => onSeekCommit(Math.min(safeDuration || position + 10, position + 10))}
              type="button"
            >
              +10s
            </button>
            <select
              aria-label="Playback speed"
              className="rounded bg-transparent text-xs"
              onChange={(event) => onPlaybackRate(Number(event.target.value))}
              disabled={!playbackReady}
              value={videoRef.current?.playbackRate ?? 1}
            >
              {playbackRates.map((rate) => (
                <option className="text-black" key={rate} value={rate}>{rate}x</option>
              ))}
            </select>
          </>
        )}

        {role === "VIEWER" && (
          <span className="text-xs text-white/75">Synced with host</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            aria-label={muted ? "Unmute local audio" : "Mute local audio"}
            className="flex size-9 items-center justify-center rounded-full hover:bg-white/10"
            onClick={toggleMuted}
            type="button"
          >
            {muted || volume === 0
              ? <VolumeX aria-hidden="true" size={18} />
              : <Volume2 aria-hidden="true" size={18} />}
          </button>
          <input
            aria-label="Local volume"
            className="w-20 accent-[#3ecf8e]"
            max="1"
            min="0"
            onChange={(event) => updateVolume(event.target.value)}
            step="0.05"
            type="range"
            value={volume}
          />
          <button
            aria-label="Enter fullscreen"
            className="flex size-9 items-center justify-center rounded-full hover:bg-white/10"
            onClick={() => void toggleFullscreen()}
            type="button"
          >
            <Maximize aria-hidden="true" size={18} />
          </button>
          <button
            className="rounded-lg px-3 py-2 text-xs hover:bg-white/10"
            onClick={onLeave}
            type="button"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  )
}
