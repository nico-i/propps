import type { CSSProperties, ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import styles from './SortableRow.module.css'

/**
 * Bag of props a row applies to render itself as a sortable list item.
 * `rootProps` go on the `<li>` (ref + drag transform); `handleProps` go on the
 * drag-handle button so only the handle initiates a drag (the rest of the row
 * stays interactive for editing).
 */
export interface SortableRowRenderProps {
  rootProps: {
    ref: (node: HTMLElement | null) => void
    style: CSSProperties
    className?: string
  }
  handle: ReactNode
}

interface SortableRowProps {
  id: string
  /** When set, the row can't be dragged and renders no handle (e.g. pinned). */
  disabled?: boolean
  children: (props: SortableRowRenderProps) => ReactNode
}

/**
 * Headless sortable wrapper. Owns the dnd-kit `useSortable` plumbing and hands
 * the row a ready-made drag handle + the props it must spread on its own `<li>`.
 *
 * Render-prop (not a wrapping element) so each row keeps ownership of its own
 * `<li>` and CSS module — see the repo's one-component-per-directory rule.
 */
export default function SortableRow({ id, disabled = false, children }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Lift the dragged row above its siblings and hint its grabbed state.
    zIndex: isDragging ? 2 : undefined,
    opacity: isDragging ? 0.85 : undefined,
  }

  const handle = disabled ? null : (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className={styles.handle}
      aria-label="Drag to reorder"
      title="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      ⠿
    </button>
  )

  return children({
    rootProps: {
      ref: setNodeRef,
      style,
      className: isDragging ? styles.dragging : undefined,
    },
    handle,
  })
}
