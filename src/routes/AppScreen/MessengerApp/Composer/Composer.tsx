import { Link } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  DEFAULT_READING_DELAY,
  DEFAULT_TODAY_LABEL,
  DEFAULT_TYPING_DELAY,
  type ChatMessage,
  type ChatScript,
  type DateSeparator,
  type MessageKind,
  type PastEntry,
  type Sender,
} from '../MessengerApp'
import { deleteAudio } from '../audioStore'
import AvatarUpload from './AvatarUpload/AvatarUpload'
import MessageRow from './MessageRow/MessageRow'
import DateSeparatorRow from './DateSeparatorRow/DateSeparatorRow'
import styles from './Composer.module.css'

function uid(): string {
  return Math.random().toString(36).slice(2, 9)
}

function newMessage(sender: Sender, prevTime?: string): ChatMessage {
  const base: ChatMessage = {
    type: 'message',
    id: uid(),
    sender,
    text: '',
    time: prevTime ?? '14:30',
  }
  if (sender === 'them') {
    base.readingDelayMs = DEFAULT_READING_DELAY
    base.typingDelayMs = DEFAULT_TYPING_DELAY
  }
  return base
}

interface ComposerProps {
  script: ChatScript
  setScript: (s: ChatScript) => void
  onPlay: () => void
}

export default function Composer({ script, setScript, onPlay }: ComposerProps) {
  // Drag only starts from a row's handle (see SortableRow), but a small
  // activation distance still guards against accidental drags on tap/click.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function update(patch: Partial<ChatScript>) {
    setScript({ ...script, ...patch })
  }

  // ----- past backlog (heterogeneous: messages + date separators) -----

  function setPast(entries: PastEntry[]) {
    update({ pastEntries: entries })
  }

  /** Reorder the backlog after a drag; ids are stable per entry. */
  function onPastDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = script.pastEntries.findIndex((e) => e.id === active.id)
    const to = script.pastEntries.findIndex((e) => e.id === over.id)
    if (from === -1 || to === -1) return
    setPast(arrayMove(script.pastEntries, from, to))
  }

  /** patch a message entry in the backlog, leaving date separators untouched */
  function updatePastMessage(id: string, patch: Partial<ChatMessage>) {
    setPast(
      script.pastEntries.map((e) =>
        e.type === 'message' && e.id === id ? { ...e, ...patch } : e,
      ),
    )
  }

  function updatePastSeparator(id: string, patch: Partial<DateSeparator>) {
    setPast(
      script.pastEntries.map((e) =>
        e.type === 'date' && e.id === id ? { ...e, ...patch } : e,
      ),
    )
  }

  function removePastEntry(id: string) {
    const target = script.pastEntries.find((e) => e.id === id)
    if (target?.type === 'message' && target.audioId) void deleteAudio(target.audioId)
    setPast(script.pastEntries.filter((e) => e.id !== id))
  }

  function togglePastSender(m: ChatMessage) {
    updatePastMessage(m.id, senderTogglePatch(m))
  }

  function setPastKind(m: ChatMessage, kind: MessageKind) {
    const patch = kindPatch(m, kind)
    if (patch) updatePastMessage(m.id, patch)
  }

  function addPastMessage(sender: Sender) {
    const lastMsg = [...script.pastEntries].reverse().find((e) => e.type === 'message')
    setPast([...script.pastEntries, newMessage(sender, lastMsg?.time)])
  }

  function addPastDate() {
    const sep: DateSeparator = { type: 'date', id: uid(), label: '' }
    setPast([...script.pastEntries, sep])
  }

  // ----- live playback (messages only) -----

  function setPlayback(messages: ChatMessage[]) {
    update({ playbackMessages: messages })
  }

  /**
   * Reorder playback after a drag. The first row is pinned (the live chat must
   * open with a Me bubble), so clamp any drop target to index >= 1 to keep that
   * message anchored at the top.
   */
  function onPlaybackDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = script.playbackMessages.findIndex((m) => m.id === active.id)
    const overIndex = script.playbackMessages.findIndex((m) => m.id === over.id)
    if (from === -1 || overIndex === -1) return
    const to = Math.max(1, overIndex)
    if (from === to) return
    setPlayback(arrayMove(script.playbackMessages, from, to))
  }

  function updatePlaybackMessage(id: string, patch: Partial<ChatMessage>) {
    setPlayback(script.playbackMessages.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }

  function removePlaybackMessage(id: string) {
    // The first playback message is pinned (the live chat must open with a Me
    // bubble), so it can never be deleted.
    if (script.playbackMessages[0]?.id === id) return
    const target = script.playbackMessages.find((m) => m.id === id)
    if (target?.audioId) void deleteAudio(target.audioId)
    setPlayback(script.playbackMessages.filter((m) => m.id !== id))
  }

  function togglePlaybackSender(m: ChatMessage) {
    // The first playback message is always Me (the actor opens the live chat),
    // so block flipping row 0 to Them.
    if (script.playbackMessages[0]?.id === m.id) return
    updatePlaybackMessage(m.id, senderTogglePatch(m))
  }

  function setPlaybackKind(m: ChatMessage, kind: MessageKind) {
    const patch = kindPatch(m, kind)
    if (patch) updatePlaybackMessage(m.id, patch)
  }

  function addPlaybackMessage(sender: Sender) {
    const last = script.playbackMessages[script.playbackMessages.length - 1]
    // The live chat must open with a Me message, so the first row is forced to
    // 'me' regardless of which button was pressed.
    const resolved: Sender = script.playbackMessages.length === 0 ? 'me' : sender
    setPlayback([...script.playbackMessages, newMessage(resolved, last?.time)])
  }

  /** switching a voice message to text drops the stored clip as a side effect */
  function kindPatch(m: ChatMessage, kind: MessageKind): Partial<ChatMessage> | null {
    if (kind === m.kind || (kind === 'text' && !m.kind)) return null
    if (kind === 'text' && m.audioId) {
      void deleteAudio(m.audioId)
      return { kind: 'text', audioId: undefined, durationSec: undefined }
    }
    return { kind }
  }

  const canPlay = script.playbackMessages.length > 0

  return (
    <div className={styles.composer}>
      <header className={styles.head}>
        <Link to="/" className={styles.homeLink} aria-label="Back to menu">
          ‹ Apps
        </Link>
        <h2>Script your chat</h2>
        <button className={styles.playBtn} onClick={onPlay} disabled={!canPlay}>
          ▶ Play
        </button>
      </header>

      <section className={styles.contactCard}>
        <h3 className={styles.sectionTitle}>Contact</h3>
        <div className={styles.contactBody}>
          <AvatarUpload
            avatarId={script.contactAvatarId}
            name={script.contactName}
            onChange={(contactAvatarId) => update({ contactAvatarId })}
          />
          <div className={styles.contactFields}>
            <label>
              Contact name
              <input
                value={script.contactName}
                onChange={(e) => update({ contactName: e.target.value })}
              />
            </label>
            <label>
              Status
              <input
                value={script.contactStatus}
                onChange={(e) => update({ contactStatus: e.target.value })}
              />
            </label>
          </div>
        </div>
      </section>

      <section className={styles.scriptSection}>
        <h3 className={styles.sectionTitle}>Past messages</h3>
        <p className={styles.sectionHint}>
          Shown instantly as history when you hit play. Add date separators to mark earlier days.
        </p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onPastDragEnd}>
          <SortableContext
            items={script.pastEntries.map((e) => e.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className={styles.msgList}>
              {script.pastEntries.map((e) =>
                e.type === 'date' ? (
                  <DateSeparatorRow
                    key={e.id}
                    sortableId={e.id}
                    label={e.label}
                    onChange={(label) => updatePastSeparator(e.id, { label })}
                    onRemove={() => removePastEntry(e.id)}
                    placeholder="e.g. Yesterday, Mon 14 Aug…"
                    inputAriaLabel="Date separator label"
                  />
                ) : (
                  <MessageRow
                    key={e.id}
                    message={e}
                    variant="past"
                    onToggleSender={() => togglePastSender(e)}
                    onSetKind={(kind) => setPastKind(e, kind)}
                    onUpdate={(patch) => updatePastMessage(e.id, patch)}
                    onRemove={() => removePastEntry(e.id)}
                  />
                ),
              )}
            </ul>
          </SortableContext>
        </DndContext>

        <div className={styles.addRow}>
          <button onClick={addPastDate}>+ Date</button>
          <button onClick={() => addPastMessage('them')}>+ Them</button>
          <button onClick={() => addPastMessage('me')}>+ Me</button>
        </div>
      </section>

      <section className={styles.scriptSection}>
        <h3 className={styles.sectionTitle}>Playback · Today</h3>
        <p className={styles.sectionHint}>
          The live conversation that animates during play, under the divider below.
        </p>

        <DateSeparatorRow
          label={script.todayLabel ?? DEFAULT_TODAY_LABEL}
          onChange={(todayLabel) => update({ todayLabel })}
          // Mandatory: the divider always shows something. Allow an empty box
          // while editing (so it's fully clearable), but restore the default
          // if the user leaves it blank.
          onBlur={(e) => {
            if (e.target.value.trim() === '') update({ todayLabel: DEFAULT_TODAY_LABEL })
          }}
          inputAriaLabel="Today divider label"
        />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onPlaybackDragEnd}
        >
          <SortableContext
            items={script.playbackMessages.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className={styles.msgList}>
              {script.playbackMessages.map((m, i) => (
                <MessageRow
                  key={m.id}
                  message={m}
                  variant="playback"
                  lockSender={i === 0}
                  pinned={i === 0}
                  onToggleSender={() => togglePlaybackSender(m)}
                  onSetKind={(kind) => setPlaybackKind(m, kind)}
                  onUpdate={(patch) => updatePlaybackMessage(m.id, patch)}
                  onRemove={() => removePlaybackMessage(m.id)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        <div className={styles.addRow}>
          {/* The live chat must open with a Me message, so Them isn't offered
              until at least one message exists. */}
          {script.playbackMessages.length > 0 && (
            <button onClick={() => addPlaybackMessage('them')}>+ Them</button>
          )}
          <button onClick={() => addPlaybackMessage('me')}>+ Me</button>
        </div>
      </section>
    </div>
  )
}

/** incoming messages need seeded delays; outgoing just flips the side */
function senderTogglePatch(m: ChatMessage): Partial<ChatMessage> {
  if (m.sender === 'me') {
    return {
      sender: 'them',
      readingDelayMs: m.readingDelayMs ?? DEFAULT_READING_DELAY,
      typingDelayMs: m.typingDelayMs ?? DEFAULT_TYPING_DELAY,
    }
  }
  // A Me voice row never references a stored clip: in playback it's recorded
  // live, and in the history it renders a synthetic waveform sized by an
  // authored duration. Drop any blob the message carried as Them; the past
  // duration field re-seeds itself (defaults to 1s) when needed.
  if (m.kind === 'voice' && m.audioId) {
    void deleteAudio(m.audioId)
    return { sender: 'me', audioId: undefined, durationSec: undefined }
  }
  return { sender: 'me' }
}
