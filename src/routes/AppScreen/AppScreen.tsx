import { Link, useParams } from 'react-router-dom'
import { getApp } from '../../apps/registry'
import styles from './AppScreen.module.css'

export default function AppScreen() {
  const { id } = useParams()
  const app = getApp(id)

  if (!app) {
    return (
      <div className={styles.missing}>
        <p>Unknown app.</p>
        <Link to="/" className={styles.missingLink}>
          ← Back to menu
        </Link>
      </div>
    )
  }

  const Component = app.component

  return (
    <div className={styles.root} style={{ ['--accent' as string]: app.accent }}>
      <div className={styles.body}>
        <Component />
      </div>
    </div>
  )
}
