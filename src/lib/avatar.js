import { supabase } from "@/lib/supabase"
import { isLocalPreview } from "@/lib/environment"

const projectUrl = import.meta.env.VITE_SUPABASE_PROJECT_URL || import.meta.env.VITE_SUPABASE_URL
const hasProjectUrl = typeof projectUrl === "string"
  && projectUrl.startsWith("https://")
  && !projectUrl.includes("<")

export const MAX_AVATAR_SIZE = 1024 * 1024
export const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"]
export const DEFAULT_AVATARS = isLocalPreview
  ? Array.from({ length: 52 }, (_, index) => `/avatar-pack/${String(index).padStart(2, "0")}.png`)
  : hasProjectUrl
    ? Array.from({ length: 52 }, (_, index) => {
        const number = String(index + 1).padStart(2, "0")
        return `${projectUrl.replace(/\/+$/, "")}/storage/v1/object/public/avatars/defaults/avatar-${number}.png`
      })
    : []

export function resolveAvatarUrl(value) {
  if (!value) return null
  if (/^https?:\/\//i.test(value) || value.startsWith("blob:") || value.startsWith("/")) return value
  if (!supabase) return null
  return supabase.storage.from("avatars").getPublicUrl(value).data.publicUrl
}

export function validatePhoto(file) {
  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    throw new Error("Only JPG, PNG or WebP. GIF is not allowed.")
  }
  if (file.size > MAX_AVATAR_SIZE) {
    throw new Error("Photo must be 1MB or less.")
  }
}

function isCustomAvatar(url) {
  return Boolean(url && (url.includes("/avatars/users/") || url.startsWith("users/")))
}

function extractStoragePath(value) {
  if (!value) return null
  const marker = "/avatars/"
  const markerIndex = value.indexOf(marker)
  const rawPath = markerIndex >= 0
    ? value.slice(markerIndex + marker.length)
    : value.startsWith("users/")
      ? value
      : null
  if (!rawPath) return null

  try {
    return decodeURIComponent(rawPath.split("?")[0])
  } catch {
    throw new Error("The current avatar path is invalid.")
  }
}

async function saveAvatarUrl(url, userId) {
  if (!supabase) throw new Error("Supabase is not configured.")
  const { data, error } = await supabase
    .from("profiles")
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("id")
    .maybeSingle()

  if (error) throw error
  if (!data) throw new Error("Your profile could not be found.")
}

async function deletePreviousCustomAvatar(currentUrl) {
  if (!supabase || !isCustomAvatar(currentUrl)) return
  const path = extractStoragePath(currentUrl)
  if (!path) return

  const { error } = await supabase.storage.from("avatars").remove([path])
  if (error) console.error("Could not remove the previous custom avatar.", error)
}

export async function chooseDefaultAvatar(url, userId, currentUrl) {
  if (isLocalPreview) return url
  if (!supabase) throw new Error("Supabase is not configured.")
  if (!userId) throw new Error("Missing user.")

  const storagePath = extractStoragePath(url)
  if (!storagePath?.startsWith("defaults/")) {
    throw new Error("Choose one of the available default avatars.")
  }

  await saveAvatarUrl(storagePath, userId)
  await deletePreviousCustomAvatar(currentUrl)
  return storagePath
}

export async function uploadAvatar(file, userId, currentUrl) {
  validatePhoto(file)
  if (isLocalPreview) return URL.createObjectURL(file)
  if (!supabase) throw new Error("Supabase is not configured.")
  if (!userId) throw new Error("Missing user.")

  const extensionByType = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }
  const path = `users/${userId}/avatar-${Date.now()}.${extensionByType[file.type]}`
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: false, contentType: file.type })
  if (uploadError) throw uploadError

  try {
    await saveAvatarUrl(path, userId)
  } catch (saveError) {
    const { error: cleanupError } = await supabase.storage.from("avatars").remove([path])
    if (cleanupError) {
      console.error("Could not remove the newly uploaded avatar after profile update failed.", cleanupError)
    }
    throw saveError
  }
  await deletePreviousCustomAvatar(currentUrl)
  return path
}
