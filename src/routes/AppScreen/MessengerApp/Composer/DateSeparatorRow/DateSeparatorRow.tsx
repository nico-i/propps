import type { FocusEventHandler, ReactNode } from 'react'
import SortableRow from '../SortableRow/SortableRow'
import styles from './DateSeparatorRow.module.css'

interface DateSeparatorRowProps {
  /** current chip text */
  label: string
  onChange: (label: string) => void
  /**
   * When set, the row is a sortable list item (`<li>`) with a drag handle and
   * is reordered by this id. Omit for a standalone, non-sortable chip (the
   * mandatory playback divider, which lives outside any SortableContext).
   */
  sortableId?: string
  /**
   * When set, a delete button is shown. Omit for a chip that can't be removed
   * (again, the always-present playback divider).
   */
  onRemove?: () => void
  onBlur?: FocusEventHandler<HTMLInputElement>
  placeholder?: string
  inputAriaLabel?: string
}

/**
 * Composer editor for a date chip: a senderless centered date label
 * (e.g. "Yesterday"). Shared by two spots:
 * - past backlog: sortable + removable (`sortableId` + `onRemove` set);
 * - the mandatory "Today" playback divider: a lone, non-removable chip.
 */
export default function DateSeparatorRow({
  label,
  onChange,
  sortableId,
  onRemove,
  onBlur,
  placeholder,
  inputAriaLabel,
}: DateSeparatorRowProps) {
  const field = (handle?: ReactNode) => (
    <>
      {handle}
      <span className={styles.dateBadge} aria-hidden>
        ◷ Date
      </span>
      <input
        className={styles.dateInput}
        value={label}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        aria-label={inputAriaLabel}
      />
      {onRemove && (
        <button className={styles.del} onClick={onRemove} title="Delete">
          ✕
        </button>
      )}
    </>
  )

  // Lone divider (no id): a plain non-sortable container, not a list item.
  if (sortableId === undefined) {
    return <div className={styles.dateEdit}>{field()}</div>
  }

  return (
    <SortableRow id={sortableId}>
      {({ rootProps, handle }) => (
        <li
          ref={rootProps.ref}
          style={rootProps.style}
          className={`${styles.dateEdit} ${rootProps.className ?? ''}`}
        >
          {field(handle)}
        </li>
      )}
    </SortableRow>
  )
}
