import { Link } from 'react-router-dom'
import { apps } from '../../apps/registry'
import styles from './Menu.module.css'

export default function Menu() {
  return (
    <div className={styles.root}>
      <header className={styles.head}>
        <h1 className={styles.title}>Propps</h1>
        <p className={styles.sub}>Filmable stand-ins for the apps you can’t put on screen.</p>
      </header>

      <ul className={styles.grid}>
        {apps.map((app) => (
          <li key={app.id}>
            <Link
              to={`/app/${app.id}`}
              className={styles.card}
              style={{ ['--accent' as string]: app.accent }}
            >
              <span className={styles.glyph} aria-hidden>
                {app.glyph}
              </span>
              <span className={styles.cardBody}>
                <span className={styles.cardName}>{app.name}</span>
                <span className={styles.cardStandin}>stand-in for {app.standInFor}</span>
                <span className={styles.cardTagline}>{app.tagline}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <footer className={styles.foot}>
        Parody tools for film & video. Not affiliated with, endorsed by, or connected to any
        referenced product.
      </footer>
    </div>
  )
}
