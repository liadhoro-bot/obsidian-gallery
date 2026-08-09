'use client'

import Image from 'next/image'
import {
  EntityCard,
  OgBodyText,
  OgCaption,
  OgImageMount,
  OgLabel,
  OgObjectTitle,
  OgProgressTrack,
  OgTechnicalValue,
  SurfacePanel,
} from '@/src/components/v3'
import { getSupabaseImageUrl } from '../../utils/images/supabase-image'
import PrefetchLink from '../components/prefetch-link'
import DashboardStartPaintingButton from './dashboard-start-painting-button'
import type { DashboardStatusUnit } from './dashboard-unit-status-list'
import styles from './dashboard-og.module.css'

function formatDate(value: string | null | undefined) {
  if (!value) return '-'

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function UnitImage({
  imageUrl,
  name,
  tile = false,
}: {
  imageUrl: string | null
  name: string
  tile?: boolean
}) {
  const cardImageUrl = getSupabaseImageUrl(imageUrl, {
    width: 240,
    height: 240,
    quality: 45,
    resize: 'cover',
  })

  return (
    <OgImageMount>
      <div className={tile ? styles.unitTileImageFrame : styles.unitImageFrame}>
        {cardImageUrl ? (
          <Image
            src={cardImageUrl}
            alt={name}
            fill
            className="object-cover"
            sizes={tile ? '(max-width: 640px) 42vw, 150px' : '132px'}
          />
        ) : (
          <div className={styles.noImage}>No image</div>
        )}
      </div>
    </OgImageMount>
  )
}

function UnitWideCard({ unit }: { unit: DashboardStatusUnit }) {
  return (
    <EntityCard className={styles.unitWideCard}>
      <PrefetchLink
        href={`/units/${unit.id}`}
        className={styles.cardLinkOverlay}
        aria-label={`Open ${unit.name}`}
      >
        <span className="sr-only">Open {unit.name}</span>
      </PrefetchLink>

      <UnitImage imageUrl={unit.imageUrl} name={unit.name} />

      <div className={styles.unitContent}>
        <div>
          <OgObjectTitle as="h3" className={styles.unitTitle}>
            {unit.name}
          </OgObjectTitle>
          <OgCaption className={styles.unitMetaText}>
            Last session: {formatDate(unit.lastSession)}
          </OgCaption>
          <OgLabel tone="warning">Deadline {formatDate(unit.deadline)}</OgLabel>
        </div>

        <div className={styles.progressLine}>
          <div className={styles.progressValue}>
            <OgCaption>Progress</OgCaption>
            <OgTechnicalValue>{unit.progress}%</OgTechnicalValue>
          </div>
          <OgProgressTrack
            className={styles.progressTrack}
            label={`${unit.name} progress`}
            value={unit.progress}
          />
        </div>

        <div className={styles.cardActionLayer}>
          <DashboardStartPaintingButton unitId={unit.id} />
        </div>
      </div>
    </EntityCard>
  )
}

function UnitTileCard({ unit }: { unit: DashboardStatusUnit }) {
  return (
    <EntityCard className={styles.unitTileCard}>
      <PrefetchLink
        href={`/units/${unit.id}`}
        className={styles.cardLinkOverlay}
        aria-label={`Open ${unit.name}`}
      >
        <span className="sr-only">Open {unit.name}</span>
      </PrefetchLink>

      <UnitImage imageUrl={unit.imageUrl} name={unit.name} tile />

      <div className={styles.unitContent}>
        <OgObjectTitle as="h3" className={styles.unitTitleCompact}>
          {unit.name}
        </OgObjectTitle>
        <OgCaption className={styles.unitMetaText}>
          Last session: {formatDate(unit.lastSession)}
        </OgCaption>
        <div className={styles.progressValue}>
          <OgCaption>Progress</OgCaption>
          <OgTechnicalValue>{unit.progress}%</OgTechnicalValue>
        </div>
        <OgProgressTrack
          className={styles.progressTrack}
          label={`${unit.name} progress`}
          value={unit.progress}
        />
        <div className={styles.cardActionLayer}>
          <DashboardStartPaintingButton unitId={unit.id} />
        </div>
      </div>
    </EntityCard>
  )
}

export default function DashboardBenchCards({
  units,
  emptyMessage,
  mode = 'cards',
}: {
  units: DashboardStatusUnit[]
  emptyMessage: string
  mode?: 'cards' | 'tiles'
}) {
  if (units.length === 0) {
    return (
      <SurfacePanel className={styles.emptyPanel} density="default">
        <OgBodyText>{emptyMessage}</OgBodyText>
      </SurfacePanel>
    )
  }

  return (
    <div className={[styles.unitList, mode === 'tiles' ? styles.unitTiles : ''].join(' ')}>
      {units.map((unit) =>
        mode === 'tiles' ? (
          <UnitTileCard key={unit.id} unit={unit} />
        ) : (
          <UnitWideCard key={unit.id} unit={unit} />
        )
      )}
    </div>
  )
}
