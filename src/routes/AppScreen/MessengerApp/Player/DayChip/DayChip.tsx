import styles from './DayChip.module.css'

interface DayChipProps {
  label: string
}

/**
 * Centered date chip shown in the chat scroll (e.g. "Yesterday", "TODAY").
 * Shared by the static past-history list and the live playback "Today"
 * divider so both renders stay visually identical.
 */
export default function DayChip({ label }: DayChipProps) {
  return <div className={styles.day}>{label}</div>
}
