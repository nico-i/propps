import { useEffect, useRef, useState } from 'react'
import { deleteImage, getImageUrl, newImageId, putImage } from '../../audioStore'
import styles from './AvatarUpload.module.css'

interface AvatarUploadProps {
  avatarId?: string
  name: string
  /** id of the stored image blob, or undefined when cleared */
  onChange: (avatarId: string | undefined) => void
}

export default function AvatarUpload({ avatarId, name, onChange }: AvatarUploadProps) {
  const [url, setUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // resolve the stored image blob to a preview object URL; revoke on cleanup
  useEffect(() => {
    let revoked: string | null = null
    let alive = true
    if (avatarId) {
      getImageUrl(avatarId).then((u) => {
        if (!alive) {
          if (u) URL.revokeObjectURL(u)
          return
        }
        if (u) {
          revoked = u
          setUrl(u)
        }
      })
    } else {
      setUrl(null)
    }
    return () => {
      alive = false
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [avatarId])

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file later
    if (!file) return
    const id = newImageId()
    await putImage(id, file)
    const prev = avatarId
    onChange(id)
    if (prev) void deleteImage(prev)
  }

  function onRemove() {
    const prev = avatarId
    onChange(undefined)
    if (prev) void deleteImage(prev)
  }

  const letter = name.slice(0, 1).toUpperCase() || '?'

  return (
    <div className={styles.avatarUpload}>
      <button
        type="button"
        className={styles.avatarPreview}
        onClick={() => fileRef.current?.click()}
        aria-label={avatarId ? 'Change profile picture' : 'Add profile picture'}
      >
        <span className={styles.avatarImageClip}>
          {url ? (
            <img src={url} alt="" className={styles.avatarImg} />
          ) : (
            <span className={styles.avatarLetter} aria-hidden>
              {letter}
            </span>
          )}
        </span>
        <span className={styles.avatarEditBadge} aria-hidden>
          ✎
        </span>
      </button>
      {avatarId && (
        <button type="button" className={styles.avatarRemove} onClick={onRemove}>
          Remove
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => void onPick(e)}
      />
    </div>
  )
}
