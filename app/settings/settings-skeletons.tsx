import styles from '../settings-support-silver.module.css'

export function SettingsProfileSkeleton() {
  return (
    <div className={`${styles.skeleton} animate-pulse`}>
      <div className={styles.skeletonAvatar} />
      <div className={styles.skeletonLine} style={{ width: 160 }} />
      <div className={styles.skeletonLine} style={{ width: 208 }} />
      <div className={styles.skeletonButton} />
    </div>
  )
}

export function SettingsCardSkeleton() {
  return (
    <div className={`${styles.skeleton} animate-pulse`}>
      <div className={styles.skeletonLine} style={{ width: 176, marginInline: 0 }} />
      <div>
        <div className={styles.skeletonLine} style={{ width: '100%', marginInline: 0 }} />
        <div className={styles.skeletonLine} style={{ width: '100%', marginInline: 0 }} />
        <div className={styles.skeletonLine} style={{ width: '100%', marginInline: 0 }} />
      </div>
    </div>
  )
}
