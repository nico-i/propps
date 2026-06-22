import type { ComponentType } from 'react'
import MessengerApp from '../routes/AppScreen/MessengerApp/MessengerApp'

export interface SpinoffApp {
  /** stable url-safe id, also used as route path segment */
  id: string
  /** parody display name shown in the menu */
  name: string
  /** which real app this stands in for (shown subtly, for the user's own reference) */
  standInFor: string
  /** one-line description of what it does on set */
  tagline: string
  /** accent color (custom hex, evokes the original without using its trademarked palette exactly) */
  accent: string
  /** single emoji used as a lightweight, non-infringing icon */
  glyph: string
  /** the screen component rendered at /app/:id */
  component: ComponentType
}

export const apps: SpinoffApp[] = [
  {
    id: 'whatsup',
    name: 'WhatsUp',
    standInFor: 'WhatsApp',
    tagline: 'Scripted chat you can film. Author a convo, play it back.',
    accent: '#1f8f6f',
    glyph: '💬',
    component: MessengerApp,
  },
]

export function getApp(id: string | undefined): SpinoffApp | undefined {
  return apps.find((a) => a.id === id)
}
