import { useRef, useState } from 'react'
import { deleteAudio, newAudioId, putAudio } from '../../audioStore'
import VoiceClip from '../../VoiceClip'
import type { Sender } from '../../MessengerApp'
import styles from './AudioUpload.module.css'

interface AudioUploadProps {
  audioId?: string
  durationSec?: number
  /** tone for the preview clip (incoming vs outgoing styling) */
  tone: Sender
  /**
   * Commit a freshly uploaded clip: its stored blob id and the measured
   * length. Called with `undefined` id when the clip is removed.
   */
  onChange: (next: { audioId: string | undefined; durationSec?: number }) => void
}

/**
 * Read an audio file's playback length (seconds) by loading its metadata into a
 * detached <audio> element. Resolves to a sane fallback if the browser can't
 * determine the duration (e.g. a malformed or streaming-only container).
 */
function readDuration(file: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    const done = (sec: number) => {
      URL.revokeObjectURL(url)
      resolve(Math.max(1, Math.round(sec)))
    }
    audio.onloadedmetadata = () => {
      done(isFinite(audio.duration) ? audio.duration : 1)
    }
    audio.onerror = () => done(1)
    audio.preload = 'metadata'
    audio.src = url
  })
}

export default function AudioUpload({
  audioId,
  durationSec,
  tone,
  onChange,
}: AudioUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file later
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const duration = await readDuration(file)
      const id = newAudioId()
      await putAudio(id, file)
      const prev = audioId
      onChange({ audioId: id, durationSec: duration })
      if (prev) void deleteAudio(prev)
    } catch {
      setError('Could not load that audio file.')
    } finally {
      setBusy(false)
    }
  }

  function onRemove() {
    const prev = audioId
    onChange({ audioId: undefined, durationSec })
    if (prev) void deleteAudio(prev)
  }

  return (
    <div className={styles.audioUpload}>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.uploadBtn}
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          {busy ? 'Loading…' : audioId ? 'Replace audio' : 'Upload audio'}
        </button>
        {audioId && (
          <button type="button" className={styles.removeBtn} onClick={onRemove}>
            Remove
          </button>
        )}
      </div>

      {audioId && (
        <div className={styles.preview}>
          <VoiceClip audioId={audioId} durationSec={durationSec} tone={tone} />
        </div>
      )}

      {error && <span className={styles.error}>{error}</span>}

      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={(e) => void onPick(e)}
      />
    </div>
  )
}
