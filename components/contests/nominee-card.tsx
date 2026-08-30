import Image from 'next/image'
import type { ContestNomination } from '../../lib/contests/types'
import styles from './contest-v3-silver.module.css'

function formatSubmittedDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export default function NomineeCard({
  nomination,
  hideIdentity,
  control,
}: {
  nomination: ContestNomination
  hideIdentity?: boolean
  control?: React.ReactNode
}) {
  return (
    <article className={styles.nomineeCard}>
      <div className={styles.nomineeImage}>
        <Image
          src={nomination.snapshot_image_url}
          alt=""
          fill
          sizes="(max-width: 768px) 50vw, 240px"
          className="object-cover"
        />
      </div>
      <div className={styles.nomineeBody}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className={styles.eyebrow}>
              {nomination.source_type}
            </p>
            <h3 className={`${styles.nomineeTitle} truncate text-base`}>
              {nomination.snapshot_title}
            </h3>
          </div>
          {control}
        </div>
        {nomination.snapshot_description ? (
          <p className={`${styles.nomineeDescription} line-clamp-3 text-sm`}>
            {nomination.snapshot_description}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {!hideIdentity && nomination.snapshot_owner_display_name ? (
            <span className={styles.nomineePill}>
              By {nomination.snapshot_owner_display_name}
            </span>
          ) : null}
          <span className={styles.nomineePill}>
            {nomination.status}
          </span>
          <span className={styles.nomineePill}>
            {formatSubmittedDate(nomination.submitted_at)}
          </span>
        </div>
      </div>
    </article>
  )
}
