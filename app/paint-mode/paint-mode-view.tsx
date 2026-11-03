'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import {
  capTimerSessionSeconds,
  getPaintedSeconds,
  MAX_TIMER_SESSION_SECONDS,
} from '../../utils/sessions/expire-unit-sessions'
import {
  formatShortDate,
  formatTimer,
  swatchColor,
  type PaintModeImage,
  type PaintModeSwatch,
  type PaintModeUnit,
  type PaintModeViewModel,
} from './paint-mode-model'
import {
  BrushIcon,
  CalendarIcon,
  ChevronIcon,
  ClockIcon,
  CloseIcon,
  DashedBookArt,
  DashedNoteArt,
  DashedPhotoArt,
  DashedSwatchArt,
  DeadlineIcon,
  GalleryIcon,
  HelmIcon,
  LayersIcon,
  MiniatureOutlineArt,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  StopwatchIcon,
  SwitchIcon,
} from './paint-mode-icons'
import styles from './paint-mode-og.module.css'

export type PaintModeBusy = 'start' | 'switch' | 'add' | 'end' | 'pause' | null

export type PaintModeTool =
  | 'note'
  | 'paints-used'
  | 'paints-add'
  | 'snapshot'
  | 'guide'
  | 'inspiration'
  | 'palette'
  | 'progress'

type PaintModeViewProps = {
  model: PaintModeViewModel
  focusUnit: PaintModeUnit | null
  nowMs: number
  busy: PaintModeBusy
  onClose: () => void
  onHelp: () => void
  onChooseUnit: () => void
  onSwitchUnit: () => void
  onAddUnit: () => void
  onFocusUnit: (unitId: string) => void
  onEnd: () => void
  onTogglePause: () => void
  onTool: (tool: PaintModeTool) => void
}

export function getSessionSeconds(unit: PaintModeUnit, nowMs: number) {
  const { startedAt, pausedAt, pausedSeconds } = unit.session
  return capTimerSessionSeconds(
    getPaintedSeconds({ started_at: startedAt, paused_at: pausedAt, paused_seconds: pausedSeconds }, nowMs)
  )
}

export default function PaintModeView({
  model,
  focusUnit,
  nowMs,
  busy,
  onClose,
  onHelp,
  onChooseUnit,
  onSwitchUnit,
  onAddUnit,
  onFocusUnit,
  onEnd,
  onTogglePause,
  onTool,
}: PaintModeViewProps) {
  const unit = focusUnit
  const sessionSeconds = unit ? getSessionSeconds(unit, nowMs) : 0
  const isPaused = Boolean(unit?.session.pausedAt)
  const isCapped = sessionSeconds >= MAX_TIMER_SESSION_SECONDS

  return (
    <div className={styles.page} data-feature-guide-target="paint-mode.page">
      <div className={styles.frame}>
        <section
          className={styles.hero}
          aria-label={unit ? `${unit.name} - Paint Mode` : 'Paint Mode'}
          data-feature-guide-target="paint-mode.hero"
        >
          {unit ? (
            <Image
              src={unit.heroImage}
              alt=""
              fill
              priority
              sizes="(max-width: 440px) 100vw, 440px"
              className={styles.heroImage}
            />
          ) : (
            <span className={styles.heroPlaceholder}>
              <MiniatureOutlineArt />
            </span>
          )}
          <span className={styles.heroScrim} aria-hidden="true" />

          <div className={styles.heroTop}>
            <button type="button" className={styles.roundButton} onClick={onClose} aria-label="Close Paint Mode">
              <CloseIcon size={20} />
            </button>
            <button
              type="button"
              className={styles.roundButton}
              data-feature-guide-launcher-button="true"
              onClick={onHelp}
              aria-label="Tour Paint Mode"
            >
              ?
            </button>
          </div>

          <div className={styles.heroBody}>
            {unit ? (
              <>
                <div className={styles.heroActions} data-feature-guide-target="paint-mode.unit-actions">
                  <button type="button" className={styles.heroPill} onClick={onSwitchUnit} disabled={busy !== null}>
                    <SwitchIcon size={17} /> Switch Unit
                  </button>
                  <button type="button" className={styles.heroPill} onClick={onAddUnit} disabled={busy !== null}>
                    <PlusIcon size={17} /> Add Unit
                  </button>
                </div>
                <div className={styles.heroIdentity}>
                  <div>
                    <p className={styles.eyebrow}>Unit</p>
                    <h1 className={styles.unitName}>{unit.name}</h1>
                  </div>
                  <span className={styles.modeBadge}>
                    <BrushIcon size={17} /> Paint Mode
                  </span>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className={styles.eyebrow}>Paint Mode</p>
                  <h1 className={styles.unitName}>Choose a Unit</h1>
                  <p className={styles.heroSub}>Select a unit to begin a painting session.</p>
                </div>
                <button
                  type="button"
                  className={styles.heroPill}
                  data-size="large"
                  onClick={onChooseUnit}
                  disabled={busy !== null}
                  data-feature-guide-target="paint-mode.unit-actions"
                >
                  <HelmIcon size={20} /> Choose Unit <ChevronIcon size={18} />
                </button>
              </>
            )}
          </div>
        </section>

        {model.units.length > 1 ? (
          <div className={styles.chips} role="group" aria-label="Units in this session">
            {model.units.map((sessionUnit) => (
              <button
                key={sessionUnit.unitId}
                type="button"
                className={styles.chip}
                aria-pressed={sessionUnit.unitId === unit?.unitId}
                onClick={() => onFocusUnit(sessionUnit.unitId)}
              >
                <span className={styles.chipName}>{sessionUnit.name}</span>
                <span className={styles.chipTime}>
                  {sessionUnit.session.pausedAt ? 'Paused · ' : ''}
                  {formatTimer(getSessionSeconds(sessionUnit, nowMs))}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <section className={styles.sessionPanel} aria-label="Painting session" data-feature-guide-target="paint-mode.timer">
          <header className={styles.sessionHead}>
            <p className={styles.ruledEyebrow}>
              {!unit ? 'Painting Session' : isPaused ? 'Session Paused' : 'Painting Session in Progress'}
            </p>
            <p className={styles.stageLine}>
              {unit ? (unit.stage ? `${unit.stage.label} stage` : unit.projectName) : 'Waiting for a unit'}
            </p>
          </header>

          <div className={styles.timer} data-paused={isPaused ? 'true' : undefined} role="timer" aria-live="off">
            {unit ? (
              <>
                <span className={styles.timerValue}>{formatTimer(sessionSeconds)}</span>
                {isCapped ? (
                  <span className={styles.timerNote}>Two-hour cap reached</span>
                ) : isPaused ? (
                  <span className={styles.timerNote}>Paused</span>
                ) : null}
              </>
            ) : (
              <span className={styles.timerPrompt}>
                <StopwatchIcon size={44} /> Choose unit to start timer
              </span>
            )}
          </div>

          <div className={styles.sessionControls} data-feature-guide-target="paint-mode.controls">
            <button
              type="button"
              className={styles.sessionButton}
              data-variant="end"
              onClick={onEnd}
              disabled={!unit || (busy !== null && busy !== 'end')}
              aria-busy={busy === 'end' || undefined}
            >
              <span className={styles.sessionButtonLabel}>
                <span className={styles.stopGlyph} aria-hidden="true" /> End Session
              </span>
              {!unit ? <span className={styles.buttonCaption}>Unavailable until a unit is chosen</span> : null}
            </button>
            <button
              type="button"
              className={styles.sessionButton}
              data-variant={isPaused ? 'resume' : 'pause'}
              onClick={onTogglePause}
              disabled={!unit || isCapped || (busy !== null && busy !== 'pause')}
              aria-busy={busy === 'pause' || undefined}
            >
              <span className={styles.sessionButtonLabel}>
                {isPaused ? <PlayIcon size={22} /> : <PauseIcon size={22} />}
                {isPaused ? 'Continue' : 'Pause'}
              </span>
              {!unit ? <span className={styles.buttonCaption}>Unavailable until a unit is chosen</span> : null}
            </button>
          </div>
        </section>

        <div className={styles.tiles} data-feature-guide-target="paint-mode.unit-tools">
          <Tile label="Add Note" onClick={() => onTool('note')}>
            {unit?.note ? (
              <span className={styles.noteSlip}>{unit.note}</span>
            ) : (
              <span className={styles.dashed}><DashedNoteArt /></span>
            )}
          </Tile>
          <Tile label="Paints Used" onClick={() => onTool('paints-used')} split={Boolean(unit?.stagePaints.length)}>
            <SwatchStrip paints={unit?.stagePaints ?? []} withAdd onAdd={() => onTool('paints-add')} />
          </Tile>
          <Tile label="Take Snapshot" onClick={() => onTool('snapshot')}>
            <Polaroids images={unit ? unit.snapshots.slice(-2) : []} placeholder />
          </Tile>
        </div>

        <div className={styles.tiles} data-feature-guide-target="paint-mode.reference-tools">
          <Tile label="Open Guide" onClick={() => onTool('guide')}>
            {unit?.guides.length ? (
              <Polaroids
                images={unit.guides.slice(0, 2).flatMap((guide) =>
                  guide.image ? [{ id: guide.id, src: guide.image, alt: guide.title, createdAt: null }] : []
                )}
                placeholder={false}
                fallback={<span className={styles.dashed}><DashedBookArt /></span>}
              />
            ) : (
              <span className={styles.dashed}><DashedBookArt /></span>
            )}
          </Tile>
          <Tile label={<>Inspiration<br />Gallery</>} onClick={() => onTool('inspiration')}>
            <Polaroids images={unit ? unit.inspiration.slice(0, 1) : []} placeholder />
          </Tile>
          <Tile label="Paint Palette" onClick={() => onTool('palette')}>
            <SwatchStrip paints={unit?.palette ?? []} />
          </Tile>
        </div>

        <button
          type="button"
          className={styles.row}
          onClick={() => onTool('progress')}
          data-feature-guide-target="paint-mode.progress-gallery"
        >
          <span className={styles.rowTitle}>Progress Gallery</span>
          <span className={styles.rowThumbs}>
            {Array.from({ length: 3 }, (_, index) => {
              const snapshots = unit?.snapshots ?? []
              const image = snapshots[snapshots.length - 3 + index] ?? null
              return image ? (
                <span key={image.id} className={styles.rowThumb}>
                  <Image src={image.src} alt="" fill sizes="48px" />
                </span>
              ) : (
                <span key={`empty-${index}`} className={styles.rowThumb} data-empty="true">
                  <GalleryIcon size={18} />
                </span>
              )
            })}
          </span>
          <ChevronIcon size={20} className={styles.chevron} />
        </button>

        <section className={styles.row} data-layout="stack" aria-label="Unit metrics" data-feature-guide-target="paint-mode.metrics">
          <span className={styles.metricsTitle}>Unit Metrics</span>
          <div className={styles.metrics}>
            <Metric
              icon={<ClockIcon size={18} />}
              value={unit ? formatTimer(unit.metrics.loggedSeconds + sessionSeconds) : null}
              label="Work Time"
            />
            <Metric
              icon={<LayersIcon size={18} />}
              value={unit ? String(unit.metrics.finishedSessions + 1) : null}
              label="Sessions"
            />
            <Metric
              icon={<CalendarIcon size={18} />}
              value={unit ? formatShortDate(unit.metrics.addedAt) ?? '—' : null}
              label="Added"
            />
            <Metric
              icon={<DeadlineIcon size={18} />}
              value={unit ? formatShortDate(unit.metrics.deadline) ?? 'None set' : null}
              label="Deadline"
            />
          </div>
        </section>
      </div>
    </div>
  )
}

// split: the tile holds a second button (Paints Used +), so it is a frame
// with a full-size hit button underneath instead of one button.
function Tile({
  label,
  onClick,
  children,
  split = false,
}: {
  label: ReactNode
  onClick: () => void
  children: ReactNode
  split?: boolean
}) {
  if (split) {
    return (
      <div className={styles.tile} data-split="true">
        <button type="button" className={styles.tileHit} onClick={onClick} aria-label={typeof label === 'string' ? label : undefined} />
        <span className={styles.tileVisual}>{children}</span>
        <span className={styles.tileLabel} aria-hidden="true">{label}</span>
      </div>
    )
  }

  return (
    <button type="button" className={styles.tile} onClick={onClick}>
      <span className={styles.tileVisual}>{children}</span>
      <span className={styles.tileLabel}>{label}</span>
    </button>
  )
}

export function Swatch({ paint, size }: { paint: Pick<PaintModeSwatch, 'hex' | 'swatchImageUrl' | 'name'>; size?: 'large' }) {
  return (
    <span className={styles.swatch} data-size={size} style={{ backgroundColor: swatchColor(paint) }} title={paint.name}>
      {paint.swatchImageUrl ? (
        <Image src={paint.swatchImageUrl} alt="" width={64} height={64} unoptimized />
      ) : null}
    </span>
  )
}

// With onAdd and paints logged, + is its own button: the tile opens the list,
// + opens the picker.
function SwatchStrip({ paints, withAdd = false, onAdd }: { paints: PaintModeSwatch[]; withAdd?: boolean; onAdd?: () => void }) {
  if (!paints.length) {
    return <span className={styles.dashed}><DashedSwatchArt count={3} withAdd={withAdd} /></span>
  }

  return (
    <span className={styles.swatchRow}>
      {paints.slice(0, 3).map((paint) => (
        <Swatch key={`${paint.source}-${paint.id}`} paint={paint} />
      ))}
      {withAdd && onAdd ? (
        <button type="button" className={styles.addRing} onClick={onAdd} aria-label="Add paints used">
          <PlusIcon size={16} />
        </button>
      ) : withAdd ? (
        <span className={styles.addRing}><PlusIcon size={16} /></span>
      ) : null}
    </span>
  )
}

function Polaroids({
  images,
  placeholder,
  fallback,
}: {
  images: PaintModeImage[]
  placeholder: boolean
  fallback?: ReactNode
}) {
  if (!images.length) {
    return fallback ?? <span className={styles.dashed}><DashedPhotoArt count={2} /></span>
  }

  return (
    <span className={styles.polaroids}>
      {images.map((image) => (
        <span key={image.id} className={styles.polaroid}>
          <span className={styles.polaroidImage}>
            <Image src={image.src} alt="" fill sizes="56px" />
          </span>
        </span>
      ))}
      {placeholder ? (
        <span className={`${styles.polaroid} ${styles.polaroidGhost}`}>
          <DashedPhotoArt count={1} />
        </span>
      ) : null}
    </span>
  )
}

function Metric({ icon, value, label }: { icon: ReactNode; value: string | null; label: string }) {
  return (
    <div className={styles.metric}>
      <span className={styles.metricIcon}>{icon}</span>
      <span className={styles.metricValue}>{value ?? '—'}</span>
      <span className={styles.metricLabel}>{value === null ? 'No unit selected' : label}</span>
    </div>
  )
}
