import { useEffect, useRef, useState } from 'react'
import { getAudioUrl } from './audioStore'
import styles from './VoiceClip.module.css'

/** deterministic pseudo-waveform bar heights from an id, so each clip looks stable */
function barsFor(seed: string, count = 28): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff
    out.push(0.25 + (h % 1000) / 1000 * 0.75) // 0.25..1.0
  }
  return out
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

interface VoiceClipProps {
  audioId?: string
  durationSec?: number
  /** visual tone: outgoing (me) vs incoming (them) */
  tone: 'me' | 'them'
  /** when true, begin playback as soon as the clip is loaded (incoming auto-play) */
  autoPlay?: boolean
  /**
   * Explicit waveform seed. Used by outgoing actor clips that have no stored
   * audio (`audioId`) but still need stable, per-message-unique bars.
   * Falls back to `audioId` so existing recorded clips look unchanged.
   */
  seed?: string
}

export default function VoiceClip({ audioId, durationSec, tone, autoPlay, seed }: VoiceClipProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // 0..1
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // animation handle for synthetic (no-audio) playback
  const rafRef = useRef<number | null>(null)
  const bars = barsFor(seed ?? audioId ?? 'empty')

  // The clip's real length, used for BOTH the duration label and the silent
  // waveform animation so they always agree. It comes from the message itself:
  //  - incoming (them): the prerecorded clip length (set when recorded)
  //  - outgoing (me):   how long the actor "fake-recorded" during playback
  // The `?? 1` only guards malformed/hand-authored scripts; the normal flow
  // always sets `durationSec` before a VoiceClip ever renders.
  const effectiveDuration = Math.max(1, durationSec ?? 1)

  // resolve the IDB blob to an object URL; revoke on cleanup
  useEffect(() => {
    let revoked: string | null = null
    let alive = true
    if (audioId) {
      getAudioUrl(audioId).then((u) => {
        if (!alive) {
          if (u) URL.revokeObjectURL(u)
          return
        }
        if (u) {
          revoked = u
          setUrl(u)
        }
      })
    }
    return () => {
      alive = false
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [audioId])

  // autoplay once ready. with audio we wait for the url; without audio we can
  // start the silent animation immediately.
  useEffect(() => {
    if (!autoPlay) return
    if (url && audioRef.current) {
      audioRef.current.play().catch(() => {
        // autoplay may be blocked; leave it paused, user can tap play
      })
    } else if (!url) {
      startSynthetic()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, url])

  // cancel any running synthetic animation on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  /**
   * Drive the waveform from its current progress to the end over the remaining
   * fraction of `effectiveDuration`, with no sound. Used when the clip has no
   * stored audio so it is still "playable" as a silent prop animation.
   */
  function startSynthetic() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    setPlaying(true)
    const total = effectiveDuration * 1000
    // resume from wherever the bar currently sits
    const startAt = performance.now() - progress * total
    const tick = (now: number) => {
      const p = Math.min(1, (now - startAt) / total)
      setProgress(p)
      if (p >= 1) {
        rafRef.current = null
        setPlaying(false)
        setProgress(0)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function stopSynthetic() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    setPlaying(false)
  }

  function toggle() {
    // real audio path
    const el = audioRef.current
    if (url && el) {
      if (playing) el.pause()
      else el.play().catch(() => {})
      return
    }
    // silent synthetic path (no stored audio)
    if (playing) stopSynthetic()
    else startSynthetic()
  }

  const shownDuration = effectiveDuration

  return (
    <div className={`${styles.clip} ${styles[tone]}`}>
      <button
        className={styles.playBtn}
        onClick={toggle}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
      >
        {playing ? '❚❚' : '▶'}
      </button>

      <div className={styles.waveWrap}>
        <div className={styles.wave}>
          {bars.map((b, i) => {
            const filled = i / bars.length <= progress
            return (
              <span
                key={i}
                className={`${styles.bar} ${filled ? styles.barFilled : ''}`}
                style={{ height: `${Math.round(b * 100)}%` }}
              />
            )
          })}
        </div>
      </div>

      <span className={styles.duration}>{fmt(shownDuration)}</span>

      {url && (
        <audio
          ref={audioRef}
          src={url}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false)
            setProgress(0)
          }}
          onTimeUpdate={(e) => {
            const el = e.currentTarget
            if (el.duration && isFinite(el.duration)) {
              setProgress(el.currentTime / el.duration)
            }
          }}
        />
      )}
    </div>
  )
}
