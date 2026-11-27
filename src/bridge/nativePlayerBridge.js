import Hls from "hls.js"

export class NativePlayerBridge {
  constructor(video, onEvent) {
    this.video = video
    this.onEvent = onEvent
    this.hls = null
    this.listeners = []
    this.lastProgressAt = 0

    this.listen("loadedmetadata", () => {
      if (Number.isFinite(this.initialPositionSec)) {
        video.currentTime = this.initialPositionSec
      }
      if (Number.isFinite(this.playbackRate)) {
        video.playbackRate = this.playbackRate
      }
      this.emit({
        type: "READY",
        durationSec: Number.isFinite(video.duration) ? video.duration : 0,
      })
      if (this.autoPlay) {
        void video.play().catch((error) => this.emit({
          type: "ERROR",
          code: "PLAYBACK_BLOCKED",
          message: error.message || "The browser blocked automatic playback.",
        }))
      }
    })
    this.listen("play", () => this.emit({ type: "PLAY", positionSec: video.currentTime }))
    this.listen("pause", () => this.emit({ type: "PAUSE", positionSec: video.currentTime }))
    this.listen("seeked", () => this.emit({ type: "SEEKED", positionSec: video.currentTime }))
    this.listen("ratechange", () => this.emit({ type: "RATE_CHANGED", playbackRate: video.playbackRate }))
    this.listen("waiting", () => this.emit({ type: "BUFFERING_START", positionSec: video.currentTime }))
    this.listen("playing", () => this.emit({ type: "BUFFERING_END", positionSec: video.currentTime }))
    this.listen("ended", () => this.emit({ type: "ENDED" }))
    this.listen("error", () => this.emit({
      type: "ERROR",
      code: video.error?.code ?? "MEDIA_ERROR",
      message: video.error?.message || "The video could not be played.",
    }))
    this.listen("timeupdate", () => {
      const now = performance.now()
      if (now - this.lastProgressAt < 500) return
      this.lastProgressAt = now
      this.emit({
        type: "PROGRESS",
        positionSec: video.currentTime,
        isPlaying: !video.paused,
      })
    })
  }

  listen(type, handler) {
    this.video.addEventListener(type, handler)
    this.listeners.push([type, handler])
  }

  emit(event) {
    this.onEvent(event)
  }

  async loadStream({ url, initialPositionSec = 0, playbackRate = 1, autoPlay = false }) {
    this.stopAndRelease()
    this.initialPositionSec = initialPositionSec
    this.playbackRate = playbackRate
    this.autoPlay = autoPlay
    this.video.playbackRate = playbackRate
    this.video.preload = "auto"
    this.video.playsInline = true

    if (this.video.canPlayType("application/vnd.apple.mpegurl")) {
      this.video.src = url
      this.video.load()
    } else if (Hls.isSupported()) {
      this.hls = new Hls()
      this.hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          this.emit({
            type: "ERROR",
            code: data.type,
            message: data.details || "The video stream could not be loaded.",
          })
        }
      })
      this.hls.loadSource(url)
      this.hls.attachMedia(this.video)
    } else {
      throw new Error("This browser does not support HLS video playback.")
    }

  }

  async play(positionSec) {
    if (Number.isFinite(positionSec)) this.video.currentTime = positionSec
    await this.video.play()
  }

  pause(positionSec) {
    if (Number.isFinite(positionSec)) this.video.currentTime = positionSec
    this.video.pause()
  }

  seekTo(positionSec) {
    if (!Number.isFinite(positionSec)) return
    this.video.currentTime = Math.max(0, positionSec)
  }

  setPlaybackRate(rate) {
    if (Number.isFinite(rate) && rate > 0 && rate <= 4) {
      this.video.playbackRate = rate
    }
  }

  stopAndRelease() {
    this.hls?.destroy()
    this.hls = null
    this.video.pause()
    this.video.removeAttribute("src")
    this.video.load()
  }

  release() {
    this.stopAndRelease()
    for (const [type, handler] of this.listeners) {
      this.video.removeEventListener(type, handler)
    }
    this.listeners = []
  }
}
