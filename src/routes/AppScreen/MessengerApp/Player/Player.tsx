import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_READING_DELAY,
  DEFAULT_TODAY_LABEL,
  DEFAULT_TYPING_DELAY,
  type ChatScript,
} from '../MessengerApp'
import { getImageUrl } from '../audioStore'
import Bubble from './Bubble/Bubble'
import DayChip from './DayChip/DayChip'
import TypingBubble from './TypingBubble/TypingBubble'
import SendIcon from './SendIcon/SendIcon'
import MicIcon from './MicIcon/MicIcon'
import styles from './Player.module.css'

interface PlayerProps {
  script: ChatScript
  onExit: () => void
}

export default function Player({ script, onExit }: PlayerProps) {
  // the live, animated conversation (under the "Today" divider)
  const messages = script.playbackMessages
  const total = messages.length

  // messages fully committed to the on-screen transcript
  const [revealed, setRevealed] = useState(0)
  // revealed prefix of the pending outgoing (preset) message the actor is "typing"
  const [input, setInput] = useState('')
  // id of the incoming message currently showing the typing dots (null = none)
  const [typingId, setTypingId] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  // the actor's typing field; kept focused through playback so the cursor never
  // drops mid-take (it can't be `disabled`, which would blur it — see below)
  const inputRef = useRef<HTMLInputElement>(null)
  // pending timeout ids, cleared on unmount
  const timersRef = useRef<number[]>([])
  // invalidation token: bumping it abandons any in-flight reply chain
  const runRef = useRef(0)

  // outgoing voice notes are faked: the actor "records" only to set the clip
  // length. We run a plain stopwatch (no mic, nothing stored) and use the
  // elapsed time as the bubble's duration; the waveform is random per message.
  const [recording, setRecording] = useState(false)
  const [recElapsedSec, setRecElapsedSec] = useState(0)
  const recStartRef = useRef(0)
  const recTickRef = useRef<number | null>(null)

  // resolved object URL for the contact's profile picture (if any)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  useEffect(() => {
    const id = script.contactAvatarId
    let revoked: string | null = null
    let alive = true
    if (id) {
      getImageUrl(id).then((u) => {
        if (!alive) {
          if (u) URL.revokeObjectURL(u)
          return
        }
        if (u) {
          revoked = u
          setAvatarUrl(u)
        }
      })
    } else {
      setAvatarUrl(null)
    }
    return () => {
      alive = false
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [script.contactAvatarId])

  const pending = revealed < total ? messages[revealed] : undefined
  const awaitingOutgoing = pending?.sender === 'me'
  const pendingIsVoice = pending?.kind === 'voice'
  // text outgoing uses the fake-typing input; voice outgoing uses the mic UI
  const awaitingVoice = awaitingOutgoing && pendingIsVoice

  // cleanup on unmount: abandon any in-flight reply chain and clear timers.
  // capture the ref objects locally so the cleanup closes over stable values
  // (satisfies react-hooks/exhaustive-deps without suppression).
  useEffect(() => {
    const timers = timersRef
    const run = runRef
    const tick = recTickRef
    return () => {
      run.current++
      timers.current.forEach((t) => window.clearTimeout(t))
      timers.current = []
      if (tick.current !== null) window.clearInterval(tick.current)
    }
  }, [])

  // keep the transcript pinned to the latest message / typing indicator
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [revealed, typingId])

  // keep the typing field focused whenever it's on screen (i.e. not the voice
  // branch). The input is read-only — not disabled — while replies auto-play,
  // so it can legitimately hold focus the whole time; this just re-asserts it
  // across turn changes and after the voice UI swaps back to text, so the actor
  // never has to click the field again mid-take.
  useEffect(() => {
    if (!awaitingVoice) inputRef.current?.focus()
  }, [awaitingVoice, revealed])

  /**
   * Auto-play every consecutive incoming ('them') message starting at `index`,
   * honoring each message's reading pause (delay before dots) and typing time
   * (how long dots show). Stops at the next outgoing message or the end.
   */
  function playReplies(index: number) {
    const token = runRef.current

    const step = (i: number) => {
      if (token !== runRef.current) return // abandoned by unmount
      const msg = messages[i]
      if (!msg || msg.sender !== 'them') return // reached an outgoing msg or the end

      const reading = msg.readingDelayMs ?? DEFAULT_READING_DELAY
      // for incoming voice notes the "typing" indicator stands in for the
      // other person recording, so it lasts as long as the clip itself
      const typing =
        msg.kind === 'voice'
          ? Math.max(1, msg.durationSec ?? 1) * 1000
          : msg.typingDelayMs ?? DEFAULT_TYPING_DELAY

      // 1) reading pause, then show the typing dots
      const t1 = window.setTimeout(() => {
        if (token !== runRef.current) return
        setTypingId(msg.id)

        // 2) typing time, then commit the bubble and move on
        const t2 = window.setTimeout(() => {
          if (token !== runRef.current) return
          setTypingId(null)
          setRevealed(i + 1)
          step(i + 1)
        }, typing)
        timersRef.current.push(t2)
      }, reading)
      timersRef.current.push(t1)
    }

    step(index)
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!pending) return
    const preset = pending.text
    const grew = e.target.value.length > input.length
    // reveal/hide preset characters regardless of which key was pressed
    const nextLen = grew
      ? Math.min(input.length + 1, preset.length)
      : Math.max(input.length - 1, 0)
    setInput(preset.slice(0, nextLen))
  }

  function onSend() {
    if (!pending) return
    const sentIndex = revealed
    setInput('')
    setRevealed(sentIndex + 1)
    // auto-trigger any incoming replies that follow
    playReplies(sentIndex + 1)
  }

  function stopRecTick() {
    if (recTickRef.current !== null) {
      window.clearInterval(recTickRef.current)
      recTickRef.current = null
    }
  }

  /** Actor taps the mic: start the fake-recording stopwatch (no real audio). */
  function startVoice() {
    if (!awaitingVoice) return
    recStartRef.current = Date.now()
    setRecElapsedSec(0)
    setRecording(true)
    stopRecTick()
    recTickRef.current = window.setInterval(() => {
      setRecElapsedSec((Date.now() - recStartRef.current) / 1000)
    }, 100)
  }

  /** Actor cancels: discard the in-progress fake recording. */
  function cancelVoice() {
    stopRecTick()
    setRecording(false)
    setRecElapsedSec(0)
  }

  /**
   * Actor finished the fake outgoing voice note: commit a voice bubble whose
   * length equals how long they "recorded". No audio is captured or stored —
   * VoiceClip renders a random waveform (seeded by the message id) and plays it
   * back silently when tapped. Then fire any incoming replies that follow.
   */
  function stopAndSendVoice() {
    if (!awaitingVoice || !pending) return
    const elapsed = (Date.now() - recStartRef.current) / 1000
    stopRecTick()
    setRecording(false)
    setRecElapsedSec(0)
    // mutate the pending message in place so its bubble shows the right length
    pending.durationSec = Math.max(1, Math.round(elapsed))
    const sentIndex = revealed
    setRevealed(sentIndex + 1)
    playReplies(sentIndex + 1)
  }

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSend()
    }
  }

  const typingMsg = typingId ? messages.find((m) => m.id === typingId) : undefined

  return (
    <div className={styles.phone}>
      <header className={styles.chatHead}>
        <button className={styles.back} onClick={onExit} aria-label="Back to composer">
          ‹
        </button>
        <div className={styles.avatar} aria-hidden>
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className={styles.avatarImg} />
          ) : (
            script.contactName.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className={styles.chatHeadMeta}>
          <div className={styles.chatName}>{script.contactName}</div>
          <div className={styles.chatStatus}>
            {typingMsg
              ? typingMsg.kind === 'voice'
                ? 'recording audio…'
                : 'typing…'
              : script.contactStatus}
          </div>
        </div>
      </header>

      <div className={styles.chatScroll} ref={scrollRef}>
        {script.pastEntries.map((e) =>
          e.type === 'date' ? (
            <DayChip key={e.id} label={e.label} />
          ) : (
            <Bubble key={e.id} message={e} />
          ),
        )}
        <DayChip label={script.todayLabel ?? DEFAULT_TODAY_LABEL} />
        {messages.slice(0, revealed).map((m) => (
          <Bubble key={m.id} message={m} />
        ))}
        {typingMsg && <TypingBubble />}
      </div>

      <div className={styles.inputBar}>
        {awaitingVoice ? (
          recording ? (
            <div className={styles.recBar}>
              <span className={styles.recDot} aria-hidden />
              <span className={styles.recTime}>{recElapsedSec.toFixed(1)}s</span>
              <span className={styles.recHint}>recording…</span>
              <button
                className={styles.recCancel}
                onClick={cancelVoice}
                aria-label="Cancel recording"
              >
                ✕
              </button>
              <button
                className={styles.sendBtn}
                onClick={stopAndSendVoice}
                aria-label="Stop and send voice message"
              >
                <SendIcon />
              </button>
            </div>
          ) : (
            <div className={styles.recBar}>
              <span className={styles.recPrompt}>Tap the mic to record your voice message</span>
              <button
                className={styles.micBtn}
                onClick={startVoice}
                aria-label="Record voice message"
              >
                <MicIcon />
              </button>
            </div>
          )
        ) : (
          <>
            <div className={styles.inputField}>
              <input
                ref={inputRef}
                className={styles.textInput}
                value={input}
                onChange={onInputChange}
                onKeyDown={onInputKeyDown}
                placeholder={ 'Type a message'}
                aria-label="Message"
              />
            </div>
            <button
              className={styles.sendBtn}
              onClick={onSend}
              aria-label="Send"
            >
              <SendIcon />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
