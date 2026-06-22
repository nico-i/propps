# Architecture

Deep dive on **Propps** internals, with emphasis on the **WhatsUp**
chat app. Pair this with the conventions in the root `AGENTS.md`.

## Top-level shell

- `src/main.tsx` mounts `<App/>` in `<StrictMode>`.
- `src/App.tsx` builds the router with `createBrowserRouter`:
  - `/` → `Menu`
  - `/app/:id` → `AppScreen`
  - Also renders `<PWABadge/>` (offline-ready / update prompt) alongside the
    router.
- `src/PWABadge.tsx` + `vite-plugin-pwa` provide the installable/offline PWA
  shell (Workbox service worker). Not part of app logic.

## App catalog (data-driven)

`src/apps/registry.ts` is the single source of truth for which parody apps
exist. Routing and the menu are both derived from it.

```ts
interface SpinoffApp {
  id: string            // url-safe id, also the /app/:id route segment
  name: string          // parody display name (e.g. "WhatsUp")
  standInFor: string    // the real app it imitates (e.g. "WhatsApp")
  tagline: string       // one-liner shown in the menu
  accent: string        // hex accent color (exposed as CSS var --accent)
  glyph: string         // single emoji icon
  component: ComponentType  // the screen rendered at /app/:id
}

export const apps: SpinoffApp[]
export function getApp(id: string | undefined): SpinoffApp | undefined
```

- `Menu` (`routes/Menu/Menu.tsx`) maps `apps` to a grid of `<Link to={/app/:id}>`
  cards, each setting `--accent` inline.
- `AppScreen` (`routes/AppScreen/AppScreen.tsx`) reads `:id` via `useParams`,
  looks it up with `getApp`, renders the component (or an "Unknown app"
  fallback), and sets `--accent` on its root.

**To add an app:** build its component in its own directory, then append one
entry to `apps`. No routing changes needed.

Currently the only entry is `whatsup` → `MessengerApp` (accent `#1f8f6f`).

## WhatsUp (MessengerApp)

Location: `src/routes/AppScreen/MessengerApp/`.

### Component tree

```
MessengerApp/                    # state hub + data model owner
  MessengerApp.tsx               # mode switch (compose|play), localStorage persistence
  audioStore.ts                  # IndexedDB blob store (audio + images)
  useRecorder.ts                 # MediaRecorder hook (real mic capture)
  VoiceClip.tsx                  # voice-note bubble UI (waveform + play)
  Composer/                      # the authoring/editing screen
    Composer.tsx
    AvatarUpload/                # contact picture picker
    MessageRow/                  # one editable message (text/voice + delays)
    DateSeparatorRow/            # one editable date chip (past section only)
  Player/                        # the playback/filming screen
    Player.tsx                   # reveal/typing state machine
    Bubble/                      # shared chat bubble (text or voice)
    TypingBubble/                # the "typing…" three-dots indicator
    SendIcon/  MicIcon/          # pure SVG icons
```

`MessengerApp.tsx` holds the `script` in `useState`, persists it to
`localStorage` on every change (`STORAGE_KEY = 'propps:whatsup:script'`),
and toggles between `<Composer>` (mode `compose`) and `<Player>` (mode `play`).
Composer gets `script`/`setScript`/`onPlay`; Player gets `script`/`onExit`.

### Data model (owned by `MessengerApp.tsx`)

These types/constants are exported from `MessengerApp.tsx` and imported by all
sibling components. **This is the chat-domain hub** (largest domain
correlation) — import from here, never redefine.

```ts
type Sender = 'me' | 'them'
type MessageKind = 'text' | 'voice'

const DEFAULT_READING_DELAY = 800   // ms pause before typing dots (incoming)
const DEFAULT_TYPING_DELAY  = 1200  // ms the dots show before the bubble (incoming)

interface ChatMessage {
  type: 'message'        // discriminator (vs DateSeparator) within a PastEntry
  id: string
  sender: Sender
  text: string           // body; unused/empty for voice notes
  time: string           // clock label under the bubble, e.g. "14:32"
  kind?: MessageKind     // 'text' (default) | 'voice'
  audioId?: string       // voice-only: IndexedDB key for the recorded blob
  durationSec?: number   // voice-only: clip length (duration label + waveform)
  readingDelayMs?: number // incoming-only: overrides DEFAULT_READING_DELAY
  typingDelayMs?: number  // incoming-only: overrides DEFAULT_TYPING_DELAY
}

interface DateSeparator {
  type: 'date'           // discriminator
  id: string
  label: string          // free text, e.g. "Yesterday", "Mon 14 Aug"
}

type PastEntry = ChatMessage | DateSeparator

interface ChatScript {
  contactName: string
  contactStatus: string
  contactAvatarId?: string   // IndexedDB image-blob key
  pastEntries: PastEntry[]   // static backlog (may contain date separators)
  playbackMessages: ChatMessage[]  // the live, animated conversation
}
```

### The two-zone chat model (important)

A chat is split into two distinct zones:

1. **Past backlog** (`pastEntries`) — static history. Rendered **instantly**
   when Play starts, with **no typing animation**. This is the only zone that
   may contain **custom date separators** (the centered date chips). Mix
   messages and `DateSeparator`s freely here to mark earlier days.

2. **Playback** (`playbackMessages`) — the live conversation that **animates**
   during Play. It always sits under a single automatic **"TODAY"** divider
   that the Player renders (it is *not* a stored entry, not editable). Custom
   timestamps are **not** available here by design — everything in playback
   happens "today".

The Composer mirrors this with two `<section>`s: **"Past messages"**
(`+ Date / + Them / + Me`) and **"Playback · Today"** (`+ Them / + Me`).

### Persistence & blob storage

- The `ChatScript` (small JSON) lives in **localStorage**.
- Audio recordings and the contact image are **too large for localStorage**, so
  only their string ids live in the script; the blobs live in **IndexedDB** via
  `audioStore.ts`:

```ts
// audio
newAudioId(): string
putAudio(id, blob): Promise<void>
getAudio(id): Promise<Blob | undefined>
deleteAudio(id): Promise<void>
getAudioUrl(id): Promise<string | undefined>   // caller must revoke the URL

// images — thin aliases over the SAME object store (no separate store/version)
newImageId(): string
putImage  = putAudio
deleteImage = deleteAudio
getImageUrl = getAudioUrl
```

One DB (`propps`, v1), one object store (`audio`), keyed by string id.
**Always `URL.revokeObjectURL` after `getAudioUrl`/`getImageUrl`** (done in
effect cleanups in `VoiceClip`, `AvatarUpload`, and the Player avatar effect).

### `useRecorder` hook

`useRecorder.ts` wraps `MediaRecorder` for capturing one mic clip. Returns
`{ state: 'idle'|'recording'|'error', elapsedSec, error, start(), stop(), cancel() }`.
`stop()` resolves `{ blob, durationSec } | null`. The mic stream is always torn
down on stop/unmount/error so the OS mic indicator never lingers. Used by
**Composer/MessageRow** to pre-record real preset clips.

> Note the asymmetry: the **Composer records real audio** (stored in IndexedDB,
> referenced by `audioId`). The **Player fakes outgoing voice notes** — see
> below.

### `VoiceClip` component

Presentational voice-note bubble: a play/pause button, a **deterministic
pseudo-waveform** (bar heights hashed from a `seed` or `audioId`, so a clip
always looks the same), and a duration label. Props:
`{ audioId?, durationSec?, tone: 'me'|'them', autoPlay?, seed? }`. If `audioId`
resolves to a blob it plays real audio; with only a `seed` (no audio) it renders
inert bars (used for the Player's faked outgoing clips).

## Player playback state machine

`Player/Player.tsx` drives the live zone. Key state:

- `revealed: number` — how many `playbackMessages` are committed on screen.
- `input: string` — the revealed prefix of the current outgoing preset message
  (the actor "types" it).
- `typingId: string | null` — id of the incoming message currently showing the
  typing dots.
- `runRef` — an invalidation token; bumping it abandons any in-flight reply
  chain (used on unmount). `timersRef` collects timeout ids for cleanup.

### Render order

`pastEntries` (instant: `DateSeparator` → `.chatDay` chip, message →
`<Bubble>`) → automatic `TODAY` `.chatDay` chip → `playbackMessages.slice(0,
revealed)` as `<Bubble>` → `<TypingBubble/>` while `typingId` is set.

### Flow

The conversation alternates between **outgoing** (`me`) messages the actor
performs and **incoming** (`them`) messages that auto-play:

- **`pending`** = `playbackMessages[revealed]` (the next message to surface).
- If `pending.sender === 'me'`:
  - **text** → the input bar is active. `onInputChange` reveals/hides preset
    characters one at a time **regardless of which key is pressed** (so the
    actor can mash the keyboard and the correct scripted text appears).
    `onSend`/Enter commits the bubble, advances `revealed`, then calls
    `playReplies`.
  - **voice** → the mic UI is shown. Recording here is **faked**: a stopwatch
    runs (no mic, nothing stored); on stop, the elapsed seconds are written to
    `pending.durationSec` (in place) and the bubble renders a random seeded
    waveform via `VoiceClip`. Then `playReplies` fires.
- `playReplies(index)` auto-plays each consecutive **incoming** message:
  1. wait `readingDelayMs ?? DEFAULT_READING_DELAY`, then show typing dots
     (`setTypingId`).
  2. wait the **typing time**, then commit the bubble (`setRevealed(i+1)`) and
     recurse. Typing time = `typingDelayMs ?? DEFAULT_TYPING_DELAY` for text;
     for an incoming **voice** note it equals the clip length
     (`durationSec * 1000`), since the dots stand in for the other person
     recording.
  It stops when it reaches the next outgoing message or the end.

Every scheduled `setTimeout` is checked against the `runRef` token and pushed to
`timersRef` so an unmount mid-chain cancels cleanly.

### Header

Shows the contact avatar (resolved from `contactAvatarId` via `getImageUrl`,
revoked on cleanup), the name, and a live status line that reads `typing…`
(or `recording audio…` for an incoming voice note) while dots are showing,
otherwise `contactStatus`.
