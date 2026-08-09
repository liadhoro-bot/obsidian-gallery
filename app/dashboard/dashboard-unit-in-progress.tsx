import Image from 'next/image'
import Link from 'next/link'
import {
  EntityCard,
  OgBadge,
  OgBodyText,
  OgCaption,
  OgImageMount,
  OgLabel,
  OgObjectTitle,
  OgProgressTrack,
  OgTechnicalValue,
} from '@/src/components/v3'
import { getSupabaseImageUrl } from '../../utils/images/supabase-image'
import DashboardResumeButton from './dashboard-resume-button'
import type { DashboardFeedUnit } from './dashboard-data'
import styles from './dashboard-og.module.css'

function formatDate(value: string | null | undefined) {
  if (!value) return 'No deadline set'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export default function DashboardUnitInProgress({
  unit,
}: {
  unit: DashboardFeedUnit | null
}) {
  if (!unit) {
    return (
      <EntityCard
        id="featured-unit"
        className={styles.featuredCard}
        importance="featured"
      >
        <OgLabel tone="warning">Current work</OgLabel>
        <OgObjectTitle as="h2">No active units yet</OgObjectTitle>
        <OgBodyText>Add or activate a unit to make the dashboard come alive.</OgBodyText>
      </EntityCard>
    )
  }

  const progress = Math.max(0, Math.min(100, unit.progress_percent ?? 0))
  const unitHref = `/units/${unit.unit_id}`
  const heroImageUrl = getSupabaseImageUrl(unit.primary_image_url, {
    width: 640,
    quality: 40,
    resize: 'cover',
  })

  return (
    <EntityCard
      id="featured-unit"
      className={styles.featuredCard}
      importance="featured"
    >
      <Link
        href={unitHref}
        className={styles.cardLinkOverlay}
        aria-label={`Open ${unit.name}`}
      >
        <span className="sr-only">Open {unit.name}</span>
      </Link>

      <div className={styles.featuredGrid}>
        <OgImageMount className={styles.featuredImage} prominence="featured">
          <div className={styles.featuredImageFrame}>
            {heroImageUrl ? (
              <Image
                src={heroImageUrl}
                alt={unit.name}
                fill
                className="object-cover"
                sizes="(max-width: 480px) calc(100vw - 3rem), (max-width: 768px) 240px, 260px"
                priority
              />
            ) : (
              <div className={styles.noImage}>No image</div>
            )}
          </div>
        </OgImageMount>

        <div className={styles.featuredContent}>
          <div className={styles.featuredMeta}>
            <OgLabel tone={unit.is_featured ? 'special' : 'info'}>
              {unit.is_featured ? 'Featured Unit' : 'In Progress'}
            </OgLabel>
            <OgBadge tone="warning">Deadline {formatDate(unit.deadline)}</OgBadge>
          </div>

          <div>
            <OgObjectTitle as="h2">{unit.name}</OgObjectTitle>
            {unit.is_featured && (unit.parent_project_names?.length ?? 0) > 0 ? (
              <OgCaption>{unit.parent_project_names?.join(' / ')}</OgCaption>
            ) : null}
          </div>

          <div className={styles.progressLine}>
            <div className={styles.progressValue}>
              <OgCaption>Campaign progress</OgCaption>
              <OgTechnicalValue>{progress}%</OgTechnicalValue>
            </div>
            <OgProgressTrack
              className={styles.progressTrack}
              label={`${unit.name} progress`}
              value={progress}
            />
          </div>

          <div className={styles.cardActionLayer}>
            <DashboardResumeButton unitId={unit.unit_id} />
          </div>
        </div>
      </div>
    </EntityCard>
  )
}
