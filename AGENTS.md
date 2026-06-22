# AGENTS.md

Guidance for AI coding agents working in this repo. Read this first.

## What this project is

**Propps** is a PWA of **filmable parody stand-ins** for real apps you
can't legally show on screen in film/video productions. The menu lists fake
apps; selecting one opens a full-screen, prop-quality clone.

Today there is exactly one app: **WhatsUp** (a stand-in for WhatsApp) — a
scripted-chat tool. You author a conversation in a Composer, then "Play" it
back as a realistic, animated chat you can point a camera at (the actor types
preset lines, incoming replies auto-play with typing dots, voice notes, a
contact avatar, etc.).

Everything is **client-side only** — no backend. Scripts persist in
`localStorage`; audio/image blobs persist in `IndexedDB`.

## Stack

- **Vite 7** + **React 19** + **TypeScript** (strict)
- **react-router-dom v7** (data router, `createBrowserRouter`)
- **CSS Modules** (no CSS framework)
- **vite-plugin-pwa** (Workbox; offline/installable)
- **Bun** as the package manager / runner

## Commands

| Task   | Command          | Notes                                   |
| ------ | ---------------- | --------------------------------------- |
| Dev    | `bun run dev`    | Vite dev server                         |
| Build  | `bun run build`  | `tsc -b && vite build` — **typechecks** |
| Lint   | `bunx eslint .`  | Clean = **no output**                   |

Always run **both** `bun run build` and `bunx eslint .` before considering work
done. The build is the typecheck gate; lint enforces React-hooks rules.

## Coding conventions

### Components

- **One component per file.** A `.tsx` file exports exactly one React component
  as its `default`. Do not define a second component in the same file.
- **One component per directory.** Each component lives in its own folder named
  after it, with the component file and its co-located styles:
  ```
  ComponentName/
    ComponentName.tsx          # default export
    ComponentName.module.css   # ONLY this component's classes
  ```
- **CSS Modules are split per component.** A component's `.module.css` contains
  only the classes that component uses. When you extract a component, move its
  classes into the new component's module; remove them from the old one.
- **ALWAYS extract a component when markup/logic is repeated.** If the same JSX
  (or near-identical JSX) would appear in more than one place, factor it into a
  shared presentational component in its own directory rather than duplicating
  it. This is a hard rule, not a preference. (Example already in the codebase:
  `Player/Bubble` is shared by both the static past-history list and the live
  playback list; `Player/TypingBubble` isolates the typing-dots indicator.)
- Tiny pure SVGs are still components and follow the same rules (see
  `Player/SendIcon`, `Player/MicIcon`).

### Types & shared values

- Co-locate types/constants with the component that has the **largest domain
  correlation** — the natural owner — rather than a generic `types.ts`.
- For the WhatsUp chat domain, that hub is
  `routes/AppScreen/MessengerApp/MessengerApp.tsx`. It owns and exports the
  chat data model (`ChatScript`, `ChatMessage`, `DateSeparator`, `PastEntry`,
  `Sender`, `MessageKind`) and the timing constants
  (`DEFAULT_READING_DELAY`, `DEFAULT_TYPING_DELAY`). Import these **from
  `MessengerApp`**, not from sibling components.
- Watch for **circular imports**: components import shared types *from the hub*
  (one direction). Don't make the hub import a type back from a leaf component.

### Style of the codebase

- Comments explain **why**, not what; keep them where behavior is subtle
  (timers, object-URL revocation, fake-vs-real recording).
- Always revoke object URLs created from blobs (`URL.revokeObjectURL`) in effect
  cleanups — see `VoiceClip`, `AvatarUpload`, `Player` avatar effect.
- No emojis in code/comments unless they're product copy (the seed script and
  menu glyphs intentionally contain emoji).

## Where things live

```
src/
  main.tsx                     # React root (StrictMode)
  App.tsx                      # router: "/" -> Menu, "/app/:id" -> AppScreen
  apps/registry.ts             # SpinoffApp[] catalog + getApp(id); add new apps here
  routes/
    Menu/                      # app grid (landing page)
    AppScreen/                 # resolves :id via registry, renders the app
      MessengerApp/            # the WhatsUp app (see docs/ARCHITECTURE.md)
docs/
  ARCHITECTURE.md              # deep dive on the data model + playback engine
```

To add a new parody app: create its component (own dir), then register it in
`src/apps/registry.ts`. Routing/menu are data-driven from that array.

See **`docs/ARCHITECTURE.md`** for the WhatsUp data model and the Player
playback state machine.
