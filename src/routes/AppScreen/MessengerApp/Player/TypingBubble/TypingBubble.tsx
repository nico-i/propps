import styles from './TypingBubble.module.css'

/** The incoming "typing…" indicator (three animated dots), left-aligned. */
export default function TypingBubble() {
  return (
    <div className={styles.bubbleRow}>
      <div className={`${styles.bubble} ${styles.typing}`}>
        <span /> <span /> <span />
      </div>
    </div>
  )
}
