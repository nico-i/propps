import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderState = 'idle' | 'recording' | 'error'

export interface RecordingResult {
  blob: Blob
  durationSec: number
}

/**
 * Thin wrapper around MediaRecorder for capturing a single mic clip.
 *
 * Used both in the Composer (pre-recording preset clips) and the Player
 * (actor recording a live outgoing voice note at shoot time).
 *
 * Lifecycle: call `start()`, then `stop()` which resolves with the recorded
 * blob + measured duration. The mic stream is always torn down on stop,
 * on unmount, and on error so the OS mic indicator never lingers.
 */
export function useRecorder() {
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsedSec, setElapsedSec] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef<number>(0)
  const tickRef = useRef<number | null>(null)

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setState('error')
      setError('Recording is not supported in this browser.')
      return false
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorderRef.current = rec
      rec.start()
      startedAtRef.current = Date.now()
      setElapsedSec(0)
      tickRef.current = window.setInterval(() => {
        setElapsedSec((Date.now() - startedAtRef.current) / 1000)
      }, 100)
      setState('recording')
      return true
    } catch {
      cleanupStream()
      setState('error')
      setError('Microphone access was denied.')
      return false
    }
  }, [cleanupStream])

  const stop = useCallback((): Promise<RecordingResult | null> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current
      if (!rec || rec.state === 'inactive') {
        cleanupStream()
        setState('idle')
        resolve(null)
        return
      }
      rec.onstop = () => {
        const durationSec = (Date.now() - startedAtRef.current) / 1000
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || 'audio/webm',
        })
        cleanupStream()
        recorderRef.current = null
        setState('idle')
        resolve({ blob, durationSec })
      }
      rec.stop()
    })
  }, [cleanupStream])

  const cancel = useCallback(() => {
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null
      try {
        rec.stop()
      } catch {
        // already stopped
      }
    }
    recorderRef.current = null
    chunksRef.current = []
    cleanupStream()
    setState('idle')
    setElapsedSec(0)
  }, [cleanupStream])

  // hard teardown if the component unmounts mid-recording
  useEffect(() => {
    return () => {
      const rec = recorderRef.current
      if (rec && rec.state !== 'inactive') {
        rec.onstop = null
        try {
          rec.stop()
        } catch {
          // ignore
        }
      }
      cleanupStream()
    }
  }, [cleanupStream])

  return { state, elapsedSec, error, start, stop, cancel }
}
