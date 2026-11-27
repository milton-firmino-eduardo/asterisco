import { useEffect, useRef, useState } from "react"
import { Check, Pencil, Upload, User, X } from "lucide-react"
import {
  DEFAULT_AVATARS,
  chooseDefaultAvatar,
  resolveAvatarUrl,
  uploadAvatar,
  validatePhoto,
} from "@/lib/avatar"

export default function AvatarPicker({ avatarUrl, userId, onAvatarChange, preview = false }) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const currentAvatarUrl = resolveAvatarUrl(avatarUrl)

  useEffect(() => {
    if (open) {
      setSelected(currentAvatarUrl)
      setPreviewFile(null)
      setError("")
    }
  }, [open, currentAvatarUrl])

  useEffect(() => {
    if (!previewFile?.url) return undefined
    return () => URL.revokeObjectURL(previewFile.url)
  }, [previewFile?.url])

  function handleFile(file) {
    if (!file) return
    try {
      validatePhoto(file)
    } catch (validationError) {
      setError(validationError.message)
      return
    }

    setError("")
    setPreviewFile({ file, url: URL.createObjectURL(file) })
  }

  async function handleSave() {
    setSaving(true)
    setError("")
    try {
      let savedAvatar = avatarUrl
      if (previewFile) {
        savedAvatar = preview
          ? previewFile.url
          : await uploadAvatar(previewFile.file, userId, avatarUrl)
      } else if (selected !== currentAvatarUrl) {
        savedAvatar = await chooseDefaultAvatar(selected, userId, avatarUrl)
      } else {
        setOpen(false)
        return
      }

      onAvatarChange?.(savedAvatar)
      setOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save.")
    } finally {
      setSaving(false)
    }
  }

  const display = previewFile?.url || resolveAvatarUrl(selected)
  const hasChanged = Boolean(previewFile) || selected !== currentAvatarUrl

  return (
    <>
      <div style={{ position: "relative", width: 112, height: 112, margin: "0 auto" }}>
        {currentAvatarUrl ? (
          <img
            src={currentAvatarUrl}
            alt="Avatar"
            style={{ width: 112, height: 112, borderRadius: "50%", objectFit: "cover", border: "2px solid #e5e7eb", display: "block" }}
          />
        ) : (
          <div style={{ width: 112, height: 112, borderRadius: "50%", background: "#f3f4f6", border: "2px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <User size={44} color="#9ca3af" />
          </div>
        )}
        <button
          onClick={() => setOpen(true)}
          aria-label="Edit avatar"
          style={{ position: "absolute", right: 0, bottom: 0, width: 34, height: 34, borderRadius: "50%", background: "#fff", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.12)" }}
          type="button"
        >
          <Pencil size={15} color="#111" />
        </button>
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{ background: "#fff", width: "100%", maxWidth: 520, maxHeight: "76vh", overflowY: "auto", borderRadius: 16, padding: "20px 20px 16px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.25 }}>Change avatar</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{ background: "none", border: "none", flexShrink: 0 }}
                type="button"
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "center", margin: "14px 0 12px" }}>
              {display ? (
                <img
                  src={display}
                  alt="Preview"
                  style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "cover", border: "2px solid #3ECF8E" }}
                />
              ) : (
                <div style={{ width: 88, height: 88, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #e5e7eb" }}>
                  <User size={36} color="#9ca3af" />
                </div>
              )}
            </div>

            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Default avatars</p>

            {DEFAULT_AVATARS.length === 0 ? (
              <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                Default avatars are available when connected to Supabase.
              </p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
                {DEFAULT_AVATARS.map((url) => {
                  const active = selected === url && !previewFile
                  return (
                    <button
                      key={url}
                      onClick={() => {
                        setSelected(url)
                        setPreviewFile(null)
                        setError("")
                      }}
                      aria-label={`Choose default avatar ${DEFAULT_AVATARS.indexOf(url) + 1}`}
                      aria-pressed={active}
                      style={{ position: "relative", padding: 0, border: "none", background: "none" }}
                      type="button"
                    >
                      <img
                        src={url}
                        alt=""
                        style={{ width: "100%", aspectRatio: "1", borderRadius: "50%", objectFit: "cover", display: "block", outline: active ? "2px solid #3ECF8E" : "1px solid #e5e7eb", outlineOffset: 2 }}
                      />
                      {active && (
                        <span style={{ position: "absolute", top: -2, right: -2, background: "#3ECF8E", borderRadius: "50%", width: 17, height: 17, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Check size={11} color="#fff" />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 12px" }}>
              <span style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
              <span style={{ fontSize: 12, color: "#6b7280" }}>or</span>
              <span style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(event) => {
                handleFile(event.target.files?.[0])
                event.target.value = ""
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              style={{ width: "100%", padding: 11, borderRadius: 10, border: "1px dashed #d1d5db", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 14, fontWeight: 600 }}
              type="button"
            >
              <Upload size={17} /> {previewFile ? "Change photo" : "Upload photo"}
            </button>
            <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8, textAlign: "center", lineHeight: 1.5 }}>
              JPG, PNG or WebP · Max 1MB · No GIF
            </p>

            {previewFile && (
              <button
                onClick={() => {
                  setPreviewFile(null)
                  setSelected(currentAvatarUrl)
                }}
                style={{ marginTop: 8, background: "none", border: "none", color: "#ef4444", fontSize: 13 }}
                type="button"
              >
                Remove uploaded photo
              </button>
            )}
            {error && (
              <p role="alert" style={{ color: "#ef4444", fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>
                {error}
              </p>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setOpen(false)}
                style={{ flex: 1, padding: 11, borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", fontSize: 14, fontWeight: 600 }}
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanged}
                style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: "#3ECF8E", color: "#fff", fontSize: 14, fontWeight: 700, opacity: saving || !hasChanged ? 0.5 : 1 }}
                type="button"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
