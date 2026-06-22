import { type ChatMessage, type MessageKind } from '../../MessengerApp'
import { useRecorder } from '../../useRecorder'
import { newAudioId, putAudio } from '../../audioStore'
import VoiceClip from '../../VoiceClip'
import NumberField from '../NumberField/NumberField'
import SortableRow from '../SortableRow/SortableRow'
import styles from './MessageRow.module.css'

interface MessageRowProps {
  message: ChatMessage
  onToggleSender: () => void
  onSetKind: (kind: MessageKind) => void
  onUpdate: (patch: Partial<ChatMessage>) => void
  onRemove: () => void
  /**
   * Which list this row belongs to. Drives the field behavior that differs
   * between the two backlogs:
   * - `past`: static history, shown instantly at play time — no typing
   *   animation, so the reading/typing delay fields are not rendered.
   * - `playback`: the live animated conversation — delay fields apply.
   */
  variant: 'past' | 'playback'
  /** When set, the sender side is fixed and the toggle is disabled. */
  lockSender?: boolean
  /**
   * When set, the row is anchored in place: it renders no drag handle, can't
   * be reordered, and can't be deleted. Used to pin the first playback message
   * (the live chat must open with a Me bubble).
   */
  pinned?: boolean
}

export default function MessageRow({
  message: m,
  onToggleSender,
  onSetKind,
  onUpdate,
  onRemove,
  variant,
  lockSender = false,
  pinned = false,
}: MessageRowProps) {
  const recorder = useRecorder()
  const isVoice = m.kind === 'voice'
  // Delay fields only make sense for the animated playback list; past history
  // renders instantly with no typing dots.
  const showDelays = variant === 'playback'

  async function handleStop() {
    const result = await recorder.stop()
    if (!result) return
    const id = m.audioId ?? newAudioId()
    await putAudio(id, result.blob)
    onUpdate({ audioId: id, durationSec: Math.max(1, Math.round(result.durationSec)) })
  }

  return (
    <SortableRow id={m.id} disabled={pinned}>
      {({ rootProps, handle }) => (
        <li
          ref={rootProps.ref}
          style={rootProps.style}
          className={`${styles.msgEdit} ${styles[m.sender]} ${rootProps.className ?? ''}`}
        >
          <div className={styles.msgEditControls}>
            {handle}
            <button
              className={styles.sideToggle}
              onClick={onToggleSender}
              disabled={lockSender}
              title={lockSender ? 'First playback message is always Me' : 'Toggle sender'}
            >
              {m.sender === 'me' ? 'Me →' : '← Them'}
            </button>

            <div className={styles.kindToggle} role="group" aria-label="Message type">
              <button
                className={!isVoice ? styles.kindActive : ''}
                onClick={() => onSetKind('text')}
                type="button"
              >
                Text
              </button>
              <button
                className={isVoice ? styles.kindActive : ''}
                onClick={() => onSetKind('voice')}
                type="button"
              >
                Voice
              </button>
            </div>

            <input
              className={styles.timeInput}
              value={m.time}
              onChange={(e) => onUpdate({ time: e.target.value })}
            />
            {!pinned && (
              <button className={styles.del} onClick={onRemove} title="Delete">
                ✕
              </button>
            )}
          </div>

          {isVoice ? (
            m.sender === 'them' ? (
              <div className={styles.voiceEdit}>
                {recorder.state === 'recording' ? (
                  <button className={styles.recStop} onClick={handleStop} type="button">
                    ■ Stop · {recorder.elapsedSec.toFixed(1)}s
                  </button>
                ) : (
                  <button
                    className={styles.recStart}
                    onClick={() => void recorder.start()}
                    type="button"
                  >
                    ● {m.audioId ? 'Re-record' : 'Record'}
                  </button>
                )}
                {m.audioId && recorder.state !== 'recording' && (
                  <div className={styles.voicePreview}>
                    <VoiceClip audioId={m.audioId} durationSec={m.durationSec} tone={m.sender} />
                  </div>
                )}
                {recorder.error && <span className={styles.recError}>{recorder.error}</span>}
              </div>
            ) : variant === 'playback' ? (
              // In the live conversation, outgoing voice notes are "recorded" by the
              // actor during playback (the fake-recording stopwatch), so there is
              // nothing to capture or configure here.
              <p className={styles.voiceMeNote}>Recorded live during playback</p>
            ) : (
              // In the static history there is no live recording step, so the
              // outgoing memo needs an authored length: the playback bubble renders
              // a silent synthetic waveform sized to this duration.
              <div className={styles.delayRow}>
                <label className={styles.delayField}>
                  <span title="Length of the synthetic voice note in the history">
                    Voice length
                  </span>
                  <span className={styles.delayInputWrap}>
                    <NumberField
                      min={1}
                      step={1}
                      value={m.durationSec}
                      onChange={(v) => onUpdate({ durationSec: v })}
                    />
                    <span className={styles.delayUnit}>s</span>
                  </span>
                </label>
              </div>
            )
          ) : (
            <textarea
              className={styles.msgText}
              rows={2}
              value={m.text}
              placeholder="Type message…"
              onChange={(e) => onUpdate({ text: e.target.value })}
            />
          )}

          {m.sender === 'them' && showDelays && (
            <div className={styles.delayRow}>
              <label className={styles.delayField}>
                <span title="Pause before the typing dots appear">Reading pause</span>
                <span className={styles.delayInputWrap}>
                  <NumberField
                    min={0}
                    step={100}
                    value={m.readingDelayMs}
                    onChange={(v) => onUpdate({ readingDelayMs: v })}
                  />
                  <span className={styles.delayUnit}>ms</span>
                </span>
              </label>
              {isVoice ? (
                <span
                  className={styles.delayNote}
                  title="Recording indicator matches the clip length"
                >
                  Typing time = voice length
                </span>
              ) : (
                <label className={styles.delayField}>
                  <span title="How long the typing dots show before the bubble">Typing time</span>
                  <span className={styles.delayInputWrap}>
                    <NumberField
                      min={0}
                      step={100}
                      value={m.typingDelayMs}
                      onChange={(v) => onUpdate({ typingDelayMs: v })}
                    />
                    <span className={styles.delayUnit}>ms</span>
                  </span>
                </label>
              )}
            </div>
          )}
        </li>
      )}
    </SortableRow>
  )
}
