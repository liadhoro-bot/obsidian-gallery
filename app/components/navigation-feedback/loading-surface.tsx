import { routeLabel } from './route-label'
import styles from './navigation-feedback.module.css'

export function LoadingPanels({ progress = false }: { progress?: boolean }) {
  return (
    <div className={styles.panels} aria-hidden="true">
      <div className={styles.panel}>
        <div className={styles.line} />
        <div className={styles.feature} />
        <div className={styles.line} data-short />
      </div>
      {progress ? (
        <div className={styles.grid}>
          {Array.from({ length: 6 }, (_, index) => <div className={styles.tile} key={index}><div className={styles.line} /><div className={styles.line} data-short /></div>)}
        </div>
      ) : <div className={styles.panel}><div className={styles.line} /><div className={styles.feature} /></div>}
    </div>
  )
}

export default function LoadingSurface({ href = '/', onDashboardTab }: {
  href?: string
  onDashboardTab?: (tab: 'painting-table' | 'profile') => void
}) {
  const { title, dashboard, progress } = routeLabel(href)
  return (
    <section className={styles.surface} data-navigation-loading={title} aria-busy="true" aria-label={`Loading ${title}`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <span className={styles.circle} aria-hidden="true" />
          <h1>{title}</h1>
          <span className={styles.circle} aria-hidden="true" />
        </header>
        {dashboard ? <div className={styles.tabs} role="tablist" aria-label="Dashboard sections">
          {(['painting-table', 'profile'] as const).map(tab => <button key={tab} type="button" role="tab" aria-selected={(tab === 'profile') === progress} disabled={!onDashboardTab} onClick={() => onDashboardTab?.(tab)}>{tab === 'profile' ? 'My Progress' : 'Active Units'}</button>)}
        </div> : null}
        <p className={styles.status} role="status">Loading {dashboard && progress ? 'My Progress' : title}…</p>
        <LoadingPanels progress={progress} />
      </div>
    </section>
  )
}
