const streamSubdomain = import.meta.env.VITE_CLOUDFLARE_STREAM_SUBDOMAIN

export function resolveStreamManifest(videoId) {
  if (!streamSubdomain) {
    throw new Error("Cloudflare Stream is not configured.")
  }

  if (!/^[a-z0-9-]+\.cloudflarestream\.com$/i.test(streamSubdomain)) {
    throw new Error("The Cloudflare Stream subdomain is invalid.")
  }

  if (typeof videoId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(videoId)) {
    throw new Error("The video ID is invalid.")
  }

  return `https://${streamSubdomain}/${encodeURIComponent(videoId)}/manifest/video.m3u8`
}
