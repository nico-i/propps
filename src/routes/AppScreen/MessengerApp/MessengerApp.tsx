import { useEffect, useState } from 'react'
import Composer from './Composer/Composer'
import Player from './Player/Player'
import styles from './MessengerApp.module.css'

export type Sender = 'me' | 'them'

/** message medium: plain text bubble or a voice note */
export type MessageKind = 'text' | 'voice'

/** default "reading" pause (ms) before the typing dots appear for an incoming reply */
export const DEFAULT_READING_DELAY = 800
/** default "typing" duration (ms) the dots show before an incoming bubble appears */
export const DEFAULT_TYPING_DELAY = 1200
/**
 * Fallback for the mandatory "Today" divider label. The label is editable (so
 * productions can localize it, e.g. "HEUTE"), but never empty: this stands in
 * if a script omits it (older saved scripts) or while the field is being edited.
 */
export const DEFAULT_TODAY_LABEL = 'Today'

export interface ChatMessage {
  /** discriminates a chat bubble from a DateSeparator within a PastEntry list */
  type: 'message'
  id: string
  sender: Sender
  /** text body. For voice messages this is unused (kept optional-empty). */
  text: string
  /** clock label shown under the bubble, e.g. "14:32" */
  time: string
  /** text (default) or voice note */
  kind?: MessageKind
  /** voice-only: IndexedDB key for the recorded audio blob (see audioStore). */
  audioId?: string
  /** voice-only: clip length in seconds, for the bubble's duration label + waveform. */
  durationSec?: number
  /** incoming-only: pause before the typing dots show (ms). Ignored for 'me'. */
  readingDelayMs?: number
  /** incoming-only: how long the typing dots show before the bubble appears (ms). Ignored for 'me'. */
  typingDelayMs?: number
}

/**
 * A centered date/time chip (e.g. "Yesterday", "Mon 14 Aug") separating runs of
 * messages. Senderless, free-text. Only valid in the past backlog — the live
 * playback always sits under the automatic "Today" divider.
 */
export interface DateSeparator {
  type: 'date'
  id: string
  /** free-text label shown in the chip */
  label: string
}

/** an entry in the static backlog: either a chat bubble or a date separator */
export type PastEntry = ChatMessage | DateSeparator

export interface ChatScript {
  contactName: string
  contactStatus: string
  /** optional profile picture: IndexedDB image-blob key (see audioStore). */
  contactAvatarId?: string
  /**
   * Mandatory label for the divider between the static backlog and the live
   * playback. Editable so it can be localized (e.g. "HEUTE"); never empty —
   * read it as `todayLabel ?? DEFAULT_TODAY_LABEL` to cover older scripts.
   */
  todayLabel: string
  /**
   * Static backlog shown instantly when Play starts (no typing animation).
   * May contain custom `date` separators. Rendered above the "Today" divider.
   */
  pastEntries: PastEntry[]
  /**
   * The live conversation that animates during Play (typing dots, you type the
   * outgoing messages, incoming replies auto-play). Shown under the "Today" divider.
   */
  playbackMessages: ChatMessage[]
}

const STORAGE_KEY = 'propps:whatsup:script'

const defaultScript: ChatScript = {
  contactName: 'Alex Reuter',
  contactStatus: 'online',
  todayLabel: DEFAULT_TODAY_LABEL,
  pastEntries: [
    { type: 'date', id: 'd0', label: 'Yesterday' },
    { type: 'message', id: 'p1', sender: 'them', text: 'did you get the call sheet?', time: '18:02' },
    { type: 'message', id: 'p2', sender: 'me', text: 'yep, got it. 6am start 😵', time: '18:05' },
  ],
  playbackMessages: [
    { type: 'message', id: 'm1', sender: 'me', text: 'pulling up now. give me 5', time: '14:30' },
    { type: 'message', id: 'm2', sender: 'them', text: 'ok the director is asking for you', time: '14:31', readingDelayMs: 800, typingDelayMs: 1200 },
    { type: 'message', id: 'm3', sender: 'me', text: 'on my way 🏃', time: '14:32' },
  ],
}

function loadScript(): ChatScript {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as ChatScript
  } catch {
    // ignore malformed storage, fall back to default
  }
  return defaultScript
}

type Mode = 'compose' | 'play'

export default function MessengerApp() {
  const [script, setScript] = useState<ChatScript>(loadScript)
  const [mode, setMode] = useState<Mode>('compose')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(script))
  }, [script])

  return (
    <div className={styles.root}>
      {mode === 'compose' ? (
        <Composer script={script} setScript={setScript} onPlay={() => setMode('play')} />
      ) : (
        <Player script={script} onExit={() => setMode('compose')} />
      )}
    </div>
  )
}
