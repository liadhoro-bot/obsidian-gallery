'use client'

import Image from 'next/image'
import Link from '@/app/components/navigation-feedback/navigation-link'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  formatShortDate,
  formatTimer,
  type PaintModeGuide,
  type PaintModeGuideCards,
  type PaintModeImage,
  type PaintModeProjectGroup,
  type PaintModeSwatch,
  type PaintModeUnit,
} from './paint-mode-model'
import { loadPaintModeGuideCards } from './actions'
import DeckCardViewer from '../guides/decks/[id]/deck-card-viewer'
import { deckCardEntries, guideCardNodes } from '../guides/shared/deck-card-entries'
import { guideCardKey, resolveGuideCards } from '../guides/shared/guide-card-layout'
import { BackIcon, CheckIcon, ChevronIcon, CloseIcon } from './paint-mode-icons'
import { Swatch } from './paint-mode-view'
import styles from './paint-mode-og.module.css'

function Sheet({
  title,
  onClose,
  placement = 'bottom',
  children,
  leading,
}: {
  title: string
  onClose: () => void
  placement?: 'bottom' | 'center'
  children: ReactNode
  leading?: ReactNode
}) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className={styles.overlay}
      data-placement={placement}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className={styles.sheet} role="dialog" aria-modal="true" aria-label={title}>
        <header className={styles.sheetHead}>
          {leading}
          <h2 className={styles.sheetTitle}>{title}</h2>
          <button ref={closeRef} type="button" className={styles.sheetClose} onClick={onClose} aria-label="Back to Paint Mode">
            <CloseIcon size={18} />
          </button>
        </header>
        <div className={styles.sheetBody}>{children}</div>
      </section>
    </div>
  )
}

export type UnitPickerIntent = 'start' | 'switch' | 'add'

const pickerTitles: Record<UnitPickerIntent, string> = {
  start: 'Choose a Unit',
  switch: 'Switch Unit',
  add: 'Add a Unit',
}

const pickerHints: Record<UnitPickerIntent, string> = {
  start: 'Pick the unit on your table. The session timer starts as soon as you choose.',
  switch: 'The current session ends and is logged, then a new session starts on the unit you pick.',
  add: 'The new unit gets its own timer. Your current session keeps running.',
}

export function UnitPickerSheet({
  intent,
  projects,
  sessionUnitIds,
  focusUnitId,
  onPick,
  onClose,
}: {
  intent: UnitPickerIntent
  projects: PaintModeProjectGroup[]
  sessionUnitIds: string[]
  focusUnitId: string | null
  onPick: (unitId: string) => void
  onClose: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [openFolders, setOpenFolders] = useState<Set<string>>(
    () => new Set(projects.length === 1 ? [projects[0].id] : [])
  )

  return (
    <Sheet title={pickerTitles[intent]} onClose={onClose}>
      <p className={styles.sheetText}>{pickerHints[intent]}</p>
      {projects.length === 0 ? (
        <p className={styles.sheetText}>
          No units to paint yet.{' '}
          <Link href="/units/new" className={styles.textLink}>Add a unit</Link> first.
        </p>
      ) : null}
      {projects.map((project) => {
        const isOpen = openFolders.has(project.id)
        return (
          <div key={project.id} className={styles.folder}>
            <button
              type="button"
              className={styles.folderHead}
              aria-expanded={isOpen}
              onClick={() =>
                setOpenFolders((current) => {
                  const next = new Set(current)
                  if (next.has(project.id)) next.delete(project.id)
                  else next.add(project.id)
                  return next
                })
              }
            >
              <ChevronIcon size={18} className={styles.folderChevron} />
              {project.name}
              <span className={styles.folderCount}>{project.units.length}</span>
            </button>
            {isOpen ? (
              <div className={styles.folderUnits} role="radiogroup" aria-label={project.name}>
                {project.units.map((unit) => {
                  const inSession = sessionUnitIds.includes(unit.id)
                  // Switching to or adding a unit that already has a timer would do nothing.
                  const unavailable = intent !== 'start' && inSession
                  const isSelected = selected === unit.id
                  return (
                    <button
                      key={unit.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={styles.unitOption}
                      disabled={unavailable}
                      onClick={() => setSelected(unit.id)}
                    >
                      <span className={styles.check} aria-hidden="true">
                        {isSelected ? <CheckIcon size={16} /> : null}
                      </span>
                      <span className={styles.unitOptionThumb}>
                        {unit.image ? <Image src={unit.image} alt="" fill sizes="40px" /> : null}
                      </span>
                      <span className={styles.unitOptionName}>{unit.name}</span>
                      {inSession ? (
                        <span className={styles.unitOptionTag}>
                          {unit.id === focusUnitId ? 'On the table' : 'In session'}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        )
      })}
      <div className={styles.sheetActions}>
        <button
          type="button"
          className={styles.actionButton}
          data-variant="primary"
          disabled={!selected}
          onClick={() => selected && onPick(selected)}
        >
          {intent === 'switch' ? 'Switch and start timer' : 'Start painting'}
        </button>
      </div>
    </Sheet>
  )
}

export function EndSessionDialog({
  unit,
  unitCount,
  sessionSeconds,
  onEndUnit,
  onEndAll,
  onClose,
}: {
  unit: PaintModeUnit
  unitCount: number
  sessionSeconds: number
  onEndUnit: () => void
  onEndAll: () => void
  onClose: () => void
}) {
  return (
    <Sheet title="End session?" onClose={onClose} placement="center">
      <p className={styles.sheetText}>
        {unitCount > 1
          ? `${formatTimer(sessionSeconds)} will be logged to ${unit.name}. Other units keep their timers unless you end them all.`
          : `${formatTimer(sessionSeconds)} will be logged to ${unit.name} and Paint Mode will close.`}
      </p>
      <div className={styles.sheetActions}>
        <button type="button" className={styles.actionButton} data-variant="danger" onClick={onEndUnit}>
          {unitCount > 1 ? `End ${unit.name}` : 'End session'}
        </button>
        {unitCount > 1 ? (
          <button type="button" className={styles.actionButton} data-variant="danger" onClick={onEndAll}>
            End all {unitCount} sessions
          </button>
        ) : null}
        <button type="button" className={styles.actionButton} onClick={onClose}>
          Keep painting
        </button>
      </div>
    </Sheet>
  )
}

export function SnapshotSheet({
  onCamera,
  onGallery,
  onClose,
}: {
  onCamera: () => void
  onGallery: () => void
  onClose: () => void
}) {
  return (
    <Sheet title="Take Snapshot" onClose={onClose}>
      <div className={styles.sheetActions}>
        <button type="button" className={styles.actionButton} onClick={onCamera}>
          Take a photo
        </button>
        <button type="button" className={styles.actionButton} onClick={onGallery}>
          Choose from gallery
        </button>
      </div>
    </Sheet>
  )
}

export function NoteSheet({
  unit,
  onSave,
  onClose,
}: {
  unit: PaintModeUnit
  onSave: (notes: string) => Promise<void>
  onClose: () => void
}) {
  const [draft, setDraft] = useState(unit.note)
  const [saving, setSaving] = useState(false)

  return (
    <Sheet title={unit.note ? 'Unit Note' : 'Add Note'} onClose={onClose}>
      <label className={styles.srOnly} htmlFor="paint-mode-note">Note for {unit.name}</label>
      <textarea
        id="paint-mode-note"
        className={styles.noteField}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Mixes, ratios, what to try next time..."
        maxLength={4000}
      />
      <p className={styles.sheetText}>Saved on the unit, so it is there next session too.</p>
      <div className={styles.sheetActions}>
        <button
          type="button"
          className={styles.actionButton}
          data-variant="primary"
          disabled={saving || draft.trim() === unit.note.trim()}
          onClick={async () => {
            setSaving(true)
            try {
              await onSave(draft)
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? 'Saving...' : 'Save note'}
        </button>
      </div>
    </Sheet>
  )
}

function PaintList({
  paints,
  showOwned = false,
}: {
  paints: Array<Pick<PaintModeSwatch, 'id' | 'name' | 'brand' | 'hex' | 'swatchImageUrl'> & { line?: string | null; ratioText?: string | null; owned?: boolean }>
  showOwned?: boolean
}) {
  return (
    <ul className={styles.paintList}>
      {paints.map((paint, index) => (
        <li key={`${paint.id}-${index}`} className={styles.paintItem}>
          <Swatch paint={paint} size="large" />
          <div>
            <p className={styles.paintName}>{paint.name}</p>
            {paint.brand || paint.line ? (
              <p className={styles.paintMeta}>{[paint.brand, paint.line].filter(Boolean).join(' · ')}</p>
            ) : null}
          </div>
          {paint.ratioText ? <span className={styles.paintRatio}>{paint.ratioText}</span> : null}
          {showOwned ? (
            <span className={styles.ownedTag} data-owned={paint.owned ? 'true' : 'false'}>
              {paint.owned ? 'Owned' : 'Not owned'}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export function PaintsUsedSheet({
  unit,
  onAdd,
  onClose,
}: {
  unit: PaintModeUnit
  onAdd: () => void
  onClose: () => void
}) {
  return (
    <Sheet title={unit.stage ? `Paints Used · ${unit.stage.label}` : 'Paints Used'} onClose={onClose}>
      <PaintList paints={unit.stagePaints} showOwned />
      <div className={styles.sheetActions}>
        <button type="button" className={styles.actionButton} data-variant="primary" onClick={onAdd}>
          Add paints
        </button>
      </div>
    </Sheet>
  )
}

export function PaletteSheet({
  unit,
  unitHref,
  onClose,
}: {
  unit: PaintModeUnit
  unitHref: string
  onClose: () => void
}) {
  return (
    <Sheet title="Paint Palette" onClose={onClose}>
      {unit.palette.length ? (
        <PaintList paints={unit.palette} />
      ) : (
        <p className={styles.sheetText}>
          No palette yet. Paints you log with Paints Used are added here, or build one on the{' '}
          <Link href={unitHref} className={styles.textLink}>unit page</Link>.
        </p>
      )}
    </Sheet>
  )
}

// The cards the guide's own view mode shows, in the same order.
function guideViewerCards(guide: PaintModeGuide, { decks, layout }: PaintModeGuideCards) {
  if (!layout) return deckCardEntries(decks[0])
  const resolved = resolveGuideCards(decks, layout)
  const nodes = guideCardNodes(decks, resolved, {
    id: guide.id,
    title: guide.title,
    description: guide.subtitle,
    image: guide.image,
  })
  return resolved
    .filter((card) => !card.hidden)
    .map((card) => ({ key: guideCardKey(card), node: nodes.get(guideCardKey(card)) }))
}

export function GuidesSheet({
  guides,
  initialGuideId,
  unitHref,
  onClose,
}: {
  guides: PaintModeGuide[]
  initialGuideId: string | null
  unitHref: string
  onClose: () => void
}) {
  const [guideId, setGuideId] = useState<string | null>(initialGuideId)
  const guide = guides.find((item) => item.id === guideId) ?? null
  const [fetchedCards, setFetchedCards] = useState<Record<string, PaintModeGuideCards>>({})
  const [failedGuideId, setFailedGuideId] = useState<string | null>(null)
  const cards = guide ? guide.cards ?? fetchedCards[guide.id] ?? null : null
  const pendingGuideId = guide && !cards ? guide.id : null
  const backFromGuide = guides.length > 1 ? () => setGuideId(null) : onClose

  useEffect(() => {
    if (!pendingGuideId) return
    let stale = false
    loadPaintModeGuideCards(pendingGuideId)
      .then((loaded) => {
        if (stale) return
        if (loaded) setFetchedCards((current) => ({ ...current, [pendingGuideId]: loaded }))
        else setFailedGuideId(pendingGuideId)
      })
      .catch((error) => {
        console.error('[paint-mode] open guide', error)
        if (!stale) setFailedGuideId(pendingGuideId)
      })
    return () => {
      stale = true
    }
  }, [pendingGuideId])

  if (guide && !cards) {
    return (
      <Sheet title={guide.title} onClose={backFromGuide}>
        <p className={styles.sheetText} role="status">
          {failedGuideId === guide.id ? 'This guide could not be opened. Check your connection and try again.' : 'Opening guide...'}
        </p>
      </Sheet>
    )
  }

  if (!guide || !cards) {
    return (
      <Sheet title="Open Guide" onClose={onClose}>
        {guides.length ? (
          guides.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.guideOption}
              onClick={() => setGuideId(item.id)}
            >
              <span className={styles.guideThumb}>
                {item.image ? <Image src={item.image} alt="" fill sizes="64px" /> : null}
              </span>
              <span>
                <span className={styles.paintName}>{item.title}</span>
                {item.cardCount ? <span className={styles.paintMeta}> {item.cardCount} cards</span> : null}
              </span>
            </button>
          ))
        ) : (
          <p className={styles.sheetText}>
            No guides are assigned to this unit yet. Add one from the Guides card on the{' '}
            <Link href={unitHref} className={styles.textLink}>unit page</Link>.
          </p>
        )}
      </Sheet>
    )
  }

  // The guide's own view mode, layered over Paint Mode. Back returns to the
  // guide list when there is one, otherwise straight back to Paint Mode.
  return (
    <div className={styles.guideViewerLayer}>
      <DeckCardViewer
        cards={guideViewerCards(guide, cards)}
        title={guide.title}
        backHref={unitHref}
        onBack={backFromGuide}
        featureGuides={[]}
      />
    </div>
  )
}

export function ImagesSheet({
  title,
  images,
  emptyText,
  showDates,
  onClose,
}: {
  title: string
  images: PaintModeImage[]
  emptyText: ReactNode
  showDates: boolean
  onClose: () => void
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const openImage = openIndex === null ? null : images[openIndex] ?? null

  if (openImage && openIndex !== null) {
    return (
      <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.lightboxHead}>
          <button type="button" className={styles.roundButton} onClick={() => setOpenIndex(null)} aria-label={`Back to ${title}`}>
            <BackIcon size={20} />
          </button>
          <span>{showDates ? formatShortDate(openImage.createdAt) : title}</span>
          <button type="button" className={styles.roundButton} onClick={onClose} aria-label="Back to Paint Mode">
            <CloseIcon size={20} />
          </button>
        </div>
        <div className={styles.lightboxImage}>
          <Image src={openImage.src} alt={openImage.alt} fill sizes="100vw" />
        </div>
        <div className={styles.lightboxNav}>
          <button
            type="button"
            className={styles.roundButton}
            disabled={openIndex === 0}
            onClick={() => setOpenIndex(openIndex - 1)}
            aria-label="Previous photo"
          >
            <BackIcon size={20} />
          </button>
          <span>{openIndex + 1} / {images.length}</span>
          <button
            type="button"
            className={styles.roundButton}
            disabled={openIndex >= images.length - 1}
            onClick={() => setOpenIndex(openIndex + 1)}
            aria-label="Next photo"
          >
            <ChevronIcon size={20} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <Sheet title={title} onClose={onClose}>
      {images.length ? (
        <div className={styles.imageGrid}>
          {images.map((image, index) => (
            <button key={image.id} type="button" className={styles.imageCell} onClick={() => setOpenIndex(index)}>
              <span className={styles.imageCellFrame}>
                <Image src={image.src} alt={image.alt} fill sizes="140px" />
              </span>
              {showDates ? formatShortDate(image.createdAt) : null}
            </button>
          ))}
        </div>
      ) : (
        <p className={styles.sheetText}>{emptyText}</p>
      )}
    </Sheet>
  )
}
