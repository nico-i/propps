/**
 * Tiny promise-based IndexedDB store for voice-message audio blobs.
 *
 * Audio is kept out of the localStorage script (which only stores small
 * `audioId` references) because recordings are far too large for the
 * ~5MB localStorage budget. One object store, keyed by string id.
 */

const DB_NAME = 'propps'
const DB_VERSION = 1
const STORE = 'audio'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(
  db: IDBDatabase,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE)
}

/** Generate a stable, url-safe id for a new clip. */
export function newAudioId(): string {
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Store a blob under `id` (overwrites any existing). Resolves on commit. */
export async function putAudio(id: string, blob: Blob): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const store = tx(db, 'readwrite')
    const req = store.put(blob, id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** Read a blob by id, or undefined if missing. */
export async function getAudio(id: string): Promise<Blob | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const store = tx(db, 'readonly')
    const req = store.get(id)
    req.onsuccess = () => resolve(req.result as Blob | undefined)
    req.onerror = () => reject(req.error)
  })
}

/** Delete a blob by id (no-op if absent). */
export async function deleteAudio(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const store = tx(db, 'readwrite')
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/**
 * Resolve an audio id to a short-lived object URL for playback.
 * Caller is responsible for URL.revokeObjectURL when done.
 */
export async function getAudioUrl(id: string): Promise<string | undefined> {
  const blob = await getAudio(id)
  return blob ? URL.createObjectURL(blob) : undefined
}

/* --------------------------------------------------------------------------
 * Image blobs (e.g. a contact's profile picture).
 *
 * Images are stored exactly like audio — small blobs are far too large for the
 * localStorage script budget, so the script only keeps a string id reference.
 * These are thin, intent-revealing aliases over the same object store; no
 * separate store or db-version bump is needed.
 * ------------------------------------------------------------------------ */

/** Generate a stable, url-safe id for a new image blob. */
export function newImageId(): string {
  return `i_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Store an image blob under `id` (overwrites any existing). */
export const putImage = putAudio

/** Delete an image blob by id (no-op if absent). */
export const deleteImage = deleteAudio

/** Resolve an image id to a short-lived object URL. Revoke when done. */
export const getImageUrl = getAudioUrl
