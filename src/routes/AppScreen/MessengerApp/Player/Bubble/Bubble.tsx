import type { ChatMessage } from '../../MessengerApp'
import VoiceClip from '../../VoiceClip'
import styles from './Bubble.module.css'

interface BubbleProps {
  message: ChatMessage
}

/** A single chat bubble (text or voice), aligned left/right by sender. */
export default function Bubble({ message: m }: BubbleProps) {
  const isVoice = m.kind === 'voice'
  return (
    <div className={`${styles.bubbleRow} ${styles[m.sender]}`}>
      <div className={`${styles.bubble} ${isVoice ? styles.bubbleVoice : ''}`}>
        {isVoice ? (
          <VoiceClip
            audioId={m.audioId}
            durationSec={m.durationSec}
            tone={m.sender}
            seed={m.sender === 'me' ? m.id : undefined}
          />
        ) : (
          <span className={styles.bubbleText}>{m.text}</span>
        )}
        <span className={styles.bubbleTime}>{m.time}</span>
      </div>
    </div>
  )
}
