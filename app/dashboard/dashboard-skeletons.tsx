import styles from './dashboard-og.module.css'

export function SectionCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse">
      <div className="h-5 w-32 rounded bg-white/10" />
      <div className="mt-4 space-y-3">
        <div className="h-20 rounded-xl bg-white/10" />
        <div className="h-20 rounded-xl bg-white/10" />
        <div className="h-20 rounded-xl bg-white/10" />
      </div>
    </div>
  )
}

export function StatsSkeleton() {
  return (
    <section className={`${styles.metadataPanel} ${styles.profileSkeleton}`}>
      <div className={styles.metadataHeader}>
        <div className={styles.skeletonCopy}>
          <span />
          <strong />
        </div>
        <span className={styles.skeletonLine} />
      </div>
      <div className={styles.metadataGrid}>
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className={styles.metadataCard}
          >
            <span className={styles.skeletonLine} />
            <span className={styles.skeletonTrack} />
          </div>
        ))}
      </div>
    </section>
  )
}

export function PaintStreakSkeleton() {
  return (
    <section className={`${styles.paintStreakCard} ${styles.profileSkeleton}`}>
      <div className={styles.paintStreakCopy}>
        <span className={styles.streakIconPlate} aria-hidden="true" />
        <div className={styles.skeletonCopy}>
          <span />
          <strong />
        </div>
      </div>
      <span className={styles.skeletonLine} />
    </section>
  )
}

export function HeroCardSkeleton() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 animate-pulse">
      <div className="h-3 w-32 rounded bg-white/10" />
      <div className="mt-4 h-8 w-48 rounded bg-white/10" />
      <div className="mt-4 h-3 w-full rounded-full bg-white/10" />
    </div>
  )
}

export function TopBarSkeleton() {
  return (
    <div className="flex items-center justify-between animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-white/10" />
        <div className="space-y-2">
          <div className="h-3 w-28 rounded bg-white/10" />
          <div className="h-4 w-12 rounded bg-white/10" />
        </div>
      </div>

      <div className="h-11 w-[214px] rounded-full bg-white/10" />
    </div>
  )
}

export function FeaturedUnitSkeleton() {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 animate-pulse">
      <div className="relative min-h-[300px] sm:min-h-[320px]">
        <div className="absolute inset-0 bg-white/10" />
        <div className="relative flex min-h-[300px] flex-col justify-end p-5 sm:min-h-[320px] sm:p-6">
          <div className="flex items-end justify-between gap-4 sm:gap-5">
            <div className="min-w-0 flex-1">
              <div className="h-3 w-24 rounded bg-white/10" />
              <div className="mt-3 space-y-2">
                <div className="h-8 w-48 max-w-full rounded bg-white/10 sm:h-10 sm:w-64" />
                <div className="h-4 w-36 rounded bg-white/10" />
              </div>
              <div className="mt-5 h-12 w-40 rounded-2xl bg-white/10" />
            </div>
            <div className="h-24 w-24 rounded-full bg-white/10 sm:h-[118px] sm:w-[118px]" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ContestCardSkeleton() {
  return (
    <div className="grid min-h-[348px] grid-rows-[180px_1fr] overflow-hidden rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] animate-pulse">
      <div className="h-[180px] bg-[radial-gradient(circle_at_25%_20%,rgba(34,211,238,0.18),transparent_34%),linear-gradient(135deg,#111827,#020617)]" />
      <div className="flex min-h-0 flex-col p-4">
        <div className="h-3 w-28 rounded bg-cyan-200/20" />
        <div className="mt-3 h-7 w-48 rounded bg-white/10" />
        <div className="mt-2 h-4 w-full rounded bg-white/10" />
        <div className="mt-1 h-4 w-4/5 rounded bg-white/10" />
        <div className="mt-auto h-10 w-36 rounded-xl bg-cyan-200/20" />
      </div>
    </div>
  )
}

export function BenchUnitsSkeleton() {
  return (
    <div className="min-h-[188px] rounded-3xl border border-white/10 bg-white/5 p-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 w-36 rounded bg-white/10" />
        <div className="h-4 w-16 rounded bg-white/10" />
      </div>

      <div className="mt-4">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="h-5 w-40 rounded bg-white/10" />
          <div className="mt-2 h-3 w-32 rounded bg-white/10" />
          <div className="mt-3 h-10 w-28 rounded-2xl bg-white/10" />
        </div>
      </div>
    </div>
  )
}
