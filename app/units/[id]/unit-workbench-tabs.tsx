'use client'

// The unit page's two tabs: Overview (what this unit is and has) and
// Workflow (what to do next, guide-driven). Paint Mode stays the place for
// active work; both tabs open it from the same full-width CTA position.

import Image from 'next/image'
import Link from '@/app/components/navigation-feedback/navigation-link'
import type { FormEvent, ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { useRouter } from '@/app/components/navigation-feedback/navigation-provider'
import {
  deleteUnitScheduledSession,
  logManualUnitSession,
  scheduleUnitSession,
  setGuideStepDone,
  startUnitSession,
  updateUnitScheduledSession,
  updateUnitSession,
  updateUnitStatus,
} from './actions'
import { paintModeHref } from '../../paint-mode/paint-mode-href'
import { saveUnitNote } from '../../paint-mode/actions'
import {
  capTimerSessionSeconds,
  getPaintedSeconds,
} from '../../../utils/sessions/expire-unit-sessions'
import PaletteCard, { type PaletteCardPaint } from '../../projects/[id]/palette-card'
import AssignedContentCard from '../../guides/shared/assigned-content-card'
import {
  EMPTY_UNIT_WORKFLOW,
  summarizeWorkflow,
  withStepDone,
  type UnitWorkflow,
  type UnitWorkflowStep,
} from './unit-workflow-model'
import type {
  PreviewGalleryImage,
  PreviewUnit,
  ScheduledPaintSession,
  UnitPaintSession,
  UnitStatus,
} from './unit-v3-preview'
import styles from './unit-workbench-og.module.css'

export type WorkbenchTab = 'overview' | 'workflow'

type LocalUnitUpdater = (updater: (current: PreviewUnit | null) => PreviewUnit | null) => void

const statusOptions: { value: UnitStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'bench', label: 'Bench' },
  { value: 'pile', label: 'Pile of Shame' },
  { value: 'complete', label: 'Complete' },
  { value: 'other', label: 'Other' },
]

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatShortDate(dateKey: string | null | undefined) {
  if (!dateKey) return null
  const date = new Date(`${dateKey}T12:00:00`)
  if (Number.isNaN(date.getTime())) return dateKey
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date)
}

function formatMinutes(minutes: number) {
  const total = Math.max(0, Math.round(minutes))
  const hours = Math.floor(total / 60)
  const rest = total % 60
  if (!hours) return `${rest}m`
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

function formatSeconds(seconds: number | null | undefined) {
  return formatMinutes((seconds ?? 0) / 60)
}

function formatClock(seconds: number) {
  return `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function isPreviewSearch(searchParams: URLSearchParams | null) {
  return searchParams?.get('preview') === '1'
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

function Icon({ name, className }: { name: 'play' | 'calendar' | 'timer' | 'layers' | 'pencil' | 'image' | 'clock' | 'chevron' | 'arrow' | 'check' | 'down' | 'plus' | 'close'; className?: string }) {
  const common = {
    'aria-hidden': true,
    viewBox: '0 0 24 24',
    className: className ?? styles.icon,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'play':
      return <svg {...common} fill="currentColor" stroke="none"><path d="M7 4.5v15l12.5-7.5Z" /></svg>
    case 'calendar':
      return <svg {...common}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
    case 'timer':
      return <svg {...common}><circle cx="12" cy="13.5" r="7" /><path d="M12 13.5V10M10 3h4M18.5 7l1.2-1.2" /></svg>
    case 'layers':
      return <svg {...common}><path d="m12 3 9 5-9 5-9-5Z" /><path d="m3 12.5 9 5 9-5" /><path d="m3 16.5 9 5 9-5" /></svg>
    case 'pencil':
      return <svg {...common}><path d="M14.5 5.5 18.5 9.5" /><path d="M16.2 3.8a2 2 0 0 1 2.9 0l1.1 1.1a2 2 0 0 1 0 2.9L8 20H4v-4Z" /></svg>
    case 'image':
      return <svg {...common}><rect x="3" y="4.5" width="18" height="15" rx="2" /><circle cx="9" cy="10" r="1.8" /><path d="m21 16-5-5-8.5 8.5" /></svg>
    case 'clock':
      return <svg {...common}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
    case 'chevron':
      return <svg {...common}><path d="m9 6 6 6-6 6" /></svg>
    case 'arrow':
      return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    case 'check':
      return <svg {...common} strokeWidth={2.6}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
    case 'down':
      return <svg {...common}><path d="m6 9 6 6 6-6" /></svg>
    case 'plus':
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>
    case 'close':
      return <svg {...common}><path d="M6 6l12 12M18 6 6 18" /></svg>
  }
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function Card({ icon, title, aside, children, className, indicator, guideTarget }: {
  icon: Parameters<typeof Icon>[0]['name']
  title: string
  aside?: ReactNode
  children: ReactNode
  className?: string
  indicator?: string
  guideTarget?: string
}) {
  return (
    <section className={`${styles.card} ${className ?? ''}`} data-v3-unit-indicator={indicator} data-feature-guide-target={guideTarget}>
      <header className={styles.cardHeader}>
        <span className={styles.cardIcon}><Icon name={icon} /></span>
        <h2 className={styles.cardTitle}>{title}</h2>
        {aside ? <div className={styles.cardAside}>{aside}</div> : null}
      </header>
      {children}
    </section>
  )
}

function Sheet({ title, eyebrow, onClose, children, wide = false }: {
  title: string
  eyebrow?: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className={styles.scrim}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`${styles.sheet} ${wide ? styles.sheetWide : ''}`}
        data-wb-sheet="true"
      >
        <div className={styles.sheetHead}>
          <div className="min-w-0">
            {eyebrow ? <p className={styles.sheetEyebrow}>{eyebrow}</p> : null}
            <h2 className={styles.sheetTitle}>{title}</h2>
          </div>
          <button type="button" aria-label={`Close ${title}`} onClick={onClose} className={styles.sheetClose}>
            <Icon name="close" />
          </button>
        </div>
        <div className={styles.sheetBody}>{children}</div>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Resume Painting / Resume Work                                       */
/* ------------------------------------------------------------------ */

function PaintCta({ unit, tab, autoStart }: { unit: PreviewUnit; tab: WorkbenchTab; autoStart: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isPreview = isPreviewSearch(searchParams)
  const activeSession = unit.activeSession ?? null
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const busy = useRef(false)
  const autoStartHandled = useRef(false)

  useEffect(() => {
    if (!activeSession || activeSession.paused_at) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [activeSession])

  const paintModeLink = paintModeHref(unit.id, {
    preview: isPreview,
    returnPath: `/units/${unit.id}?${tab === 'workflow' ? 'tab=workflow&' : ''}${isPreview ? 'preview=1' : ''}`.replace(/[?&]$/, ''),
  })

  async function start() {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError(null)
    try {
      // Idempotent: returns the open session when there already is one.
      await startUnitSession(unit.id, new Date().toISOString())
      router.push(paintModeLink)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start a painting session.')
      busy.current = false
      setPending(false)
    }
  }

  useEffect(() => {
    if (!autoStart || autoStartHandled.current) return
    // Deferred so a Strict Mode double-mount starts only one session.
    const timer = window.setTimeout(() => {
      autoStartHandled.current = true
      const url = new URL(window.location.href)
      url.searchParams.delete('autostart')
      url.searchParams.delete('session')
      window.history.replaceState(null, '', url)
      void start()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [autoStart]) // eslint-disable-line react-hooks/exhaustive-deps

  const label = 'Resume Work'
  const elapsed = activeSession ? capTimerSessionSeconds(getPaintedSeconds(activeSession, now)) : 0

  return (
    <div className={styles.ctaWrap}>
      {activeSession && activeSession.id !== 'optimistic' ? (
        <Link href={paintModeLink} className={styles.cta} data-v3-unit-indicator="resume-cta">
          <Icon name="play" className={styles.ctaIcon} />
          <span className={styles.ctaText}>
            <span>Resume Work</span>
            <span className={styles.ctaSub} role="timer" aria-label="Painting session elapsed time">
              {activeSession.paused_at ? 'Paused' : 'Painting'} · {formatClock(elapsed)}
            </span>
          </span>
        </Link>
      ) : (
        <button type="button" onClick={() => void start()} disabled={pending} className={styles.cta} data-v3-unit-indicator="resume-cta">
          <Icon name="play" className={styles.ctaIcon} />
          <span className={styles.ctaText}>{pending ? 'Opening Paint Mode…' : label}</span>
        </button>
      )}
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* OVERVIEW                                                            */
/* ------------------------------------------------------------------ */

export function OverviewTab({ unit, autoStart, onEditDetails, onEditGallery, onLocalUnitChange }: {
  unit: PreviewUnit
  autoStart: boolean
  onEditDetails: () => void
  onEditGallery: () => void
  onLocalUnitChange: LocalUnitUpdater
}) {
  return (
    <div className={styles.stack} data-v3-unit-indicator="overview">
      <PaintCta unit={unit} tab="overview" autoStart={autoStart} />
      <SessionOverviewCard unit={unit} />
      <UnitDetailsCard unit={unit} onEditDetails={onEditDetails} onLocalUnitChange={onLocalUnitChange} />
      <GalleryCard unit={unit} onEditGallery={onEditGallery} />
    </div>
  )
}

function SessionOverviewCard({ unit }: { unit: PreviewUnit }) {
  const last = formatShortDate(unit.lastPainted ?? unit.paintSessions?.[0]?.dateKey)
  return (
    <Card icon="calendar" title="Session Overview" indicator="session-overview">
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <Icon name="timer" className={styles.statIcon} />
          <div className={styles.statText}>
            <p className={styles.statLabel}>Total time logged</p>
            <p className={styles.statValue}>{unit.logged || '0m'}</p>
          </div>
        </div>
        <div className={styles.stat}>
          <Icon name="calendar" className={styles.statIcon} />
          <div className={styles.statText}>
            <p className={styles.statLabel}>Last session</p>
            <p className={styles.statValue}>{last ?? 'Not yet'}</p>
          </div>
        </div>
      </div>
    </Card>
  )
}

type PaintingNote = {
  id: string
  kind: 'unit' | 'session'
  label: string
  body: string
  session?: UnitPaintSession
}

// The unit's own note (written in Paint Mode or here) first, then every
// logged session's note, newest first.
function getPaintingNotes(unit: PreviewUnit): PaintingNote[] {
  const notes: PaintingNote[] = []
  if (unit.notes?.trim()) {
    notes.push({ id: 'unit-note', kind: 'unit', label: 'Unit note', body: unit.notes.trim() })
  }
  for (const session of unit.paintSessions ?? []) {
    if (session.notes?.trim()) {
      notes.push({
        id: session.id,
        kind: 'session',
        label: `${formatShortDate(session.dateKey)} · ${session.durationSeconds ? formatSeconds(session.durationSeconds) : session.duration}`,
        body: session.notes.trim(),
        session,
      })
    }
  }
  return notes
}

function UnitDetailsCard({ unit, onEditDetails, onLocalUnitChange }: {
  unit: PreviewUnit
  onEditDetails: () => void
  onLocalUnitChange: LocalUnitUpdater
}) {
  const router = useRouter()
  const [statusPending, startStatus] = useTransition()
  const [statusError, setStatusError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<'paints' | 'notes' | null>(null)
  const primaryProjectId = unit.selectedProjectIds?.[0] ?? null
  const paints = unit.palettePaints ?? []
  const notes = useMemo(() => getPaintingNotes(unit), [unit])
  const visiblePaints = paints.length > 6 ? paints.slice(0, 5) : paints
  const overflow = paints.length - visiblePaints.length
  const rawStatus = unit.rawStatus ?? 'active'

  function changeStatus(next: UnitStatus) {
    const previous = rawStatus
    const label = statusOptions.find((option) => option.value === next)?.label ?? unit.status
    setStatusError(null)
    onLocalUnitChange((current) => (current ? { ...current, rawStatus: next, status: label } : current))
    startStatus(async () => {
      try {
        await updateUnitStatus(unit.id, next)
        router.refresh()
      } catch (cause) {
        onLocalUnitChange((current) => (current ? { ...current, rawStatus: previous } : current))
        setStatusError(cause instanceof Error ? cause.message : 'Could not change the status.')
      }
    })
  }

  return (
    <Card
      icon="layers"
      title="Unit Details"
      indicator="unit-details-card"
      guideTarget="units.detail.details"
      aside={<button type="button" onClick={onEditDetails} className={styles.smallButton}>Edit</button>}
    >
      <div className={styles.detailRows}>
        <div className={`${styles.detailRow} ${styles.detailRow2}`}>
          <div className={styles.detailCell}>
            <p className={styles.label}>Parent project</p>
            {primaryProjectId ? (
              <Link href={`/projects/${primaryProjectId}?preview=1`} prefetch={false} className={styles.chip}>
                {unit.project}
              </Link>
            ) : (
              <span className={styles.chip}>{unit.project}</span>
            )}
          </div>
          <div className={styles.detailCell}>
            <label className={styles.label} htmlFor={`unit-status-${unit.id}`}>Status</label>
            <span className={styles.selectWrap} data-status={rawStatus}>
              <span className={styles.statusDot} aria-hidden="true" />
              <select
                id={`unit-status-${unit.id}`}
                value={rawStatus}
                disabled={statusPending}
                onChange={(event) => changeStatus(event.target.value as UnitStatus)}
                className={styles.select}
                data-v3-unit-indicator="unit-status-select"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <Icon name="down" className={styles.selectChevron} />
            </span>
          </div>
        </div>

        <div className={`${styles.detailRow} ${styles.detailRow3}`}>
          <div className={styles.detailCell}>
            <p className={styles.label}>Complexity</p>
            <span className={styles.dots} aria-label={`Complexity ${unit.complexity} of 5`}>
              {Array.from({ length: 5 }).map((_, index) => (
                <span key={index} className={index < unit.complexity ? styles.dotOn : styles.dot} />
              ))}
            </span>
          </div>
          <div className={styles.detailCell}>
            <p className={styles.label}>Model count</p>
            <p className={styles.detailValue}>{unit.modelCount}</p>
          </div>
          <div className={styles.detailCell}>
            <p className={styles.label}>Deadline</p>
            <p className={styles.detailValue}>{unit.deadline}</p>
          </div>
        </div>

        <div className={styles.inlineRow}>
          <p className={styles.label}>Assigned paints</p>
          <button
            type="button"
            onClick={() => setSheet('paints')}
            className={styles.swatchButton}
            aria-label={paints.length ? `Show all ${paints.length} assigned paints` : 'Add paints'}
            data-v3-unit-indicator="assigned-paints"
          >
            {paints.length ? (
              <>
                {visiblePaints.map((paint) => (
                  <span
                    key={paint.themePaintId}
                    className={styles.swatch}
                    style={{ backgroundColor: paint.hex ?? '#8a7a5c' }}
                    title={paint.name}
                  >
                    {paint.swatchImageUrl ? (
                      <Image src={paint.swatchImageUrl} alt="" width={40} height={40} className={styles.swatchImage} />
                    ) : null}
                  </span>
                ))}
                {overflow > 0 ? <span className={styles.swatchMore}>+{overflow}</span> : null}
              </>
            ) : (
              <span className={styles.addPaints}><Icon name="plus" className={styles.iconSmall} /> Add Paints</span>
            )}
          </button>
        </div>

        <div className={styles.notesStrip} data-v3-unit-indicator="painting-notes">
          <span className={styles.notesLabel}>
            <Icon name="pencil" className={styles.iconSmall} />
            <span className={styles.label}>Painting notes</span>
          </span>
          <button
            type="button"
            onClick={() => setSheet('notes')}
            className={notes.length ? styles.notesSnippet : styles.notesEmpty}
          >
            {notes[0]?.body ?? 'No painting notes yet. Tap to add one.'}
          </button>
          <button type="button" onClick={() => setSheet('notes')} className={styles.notesCount}>
            {notes.length ? <>Notes ({notes.length})</> : <>Add note</>} <Icon name={notes.length ? 'arrow' : 'plus'} className={styles.iconSmall} />
          </button>
        </div>
      </div>
      {statusError ? <p role="alert" className={styles.error}>{statusError}</p> : null}

      {sheet === 'paints' ? (
        <Sheet title="Assigned Paints" eyebrow={`${paints.length} paints`} onClose={() => { setSheet(null); router.refresh() }}>
          <UnitPaletteSheetBody unit={unit} />
        </Sheet>
      ) : null}
      {sheet === 'notes' ? (
        <Sheet title="Painting Notes" eyebrow={`${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`} onClose={() => setSheet(null)}>
          <NotesSheetBody unit={unit} notes={notes} onLocalUnitChange={onLocalUnitChange} />
        </Sheet>
      ) : null}
    </Card>
  )
}

function NotesSheetBody({ unit, notes, onLocalUnitChange }: {
  unit: PreviewUnit
  notes: PaintingNote[]
  onLocalUnitChange: LocalUnitUpdater
}) {
  const router = useRouter()
  const [unitNote, setUnitNote] = useState(unit.notes ?? '')
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [sessionDraft, setSessionDraft] = useState('')
  const [saving, startSaving] = useTransition()
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const unitNoteChanged = unitNote.trim() !== (unit.notes ?? '').trim()

  function saveUnitNoteText() {
    setError(null)
    setSavedMessage(null)
    startSaving(async () => {
      try {
        const saved = await saveUnitNote(unit.id, unitNote)
        onLocalUnitChange((current) => (current ? { ...current, notes: saved.notes || null } : current))
        setSavedMessage('Unit note saved')
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not save the note.')
      }
    })
  }

  function saveSessionNote(session: UnitPaintSession) {
    const seconds = session.durationSeconds ?? 0
    if (!seconds) {
      setError('This session has no length yet; edit it from Recent Sessions first.')
      return
    }
    const startedAt = new Date(session.startedAt)
    const data = new FormData()
    data.set('unitId', unit.id)
    data.set('sessionId', session.id)
    data.set('startedAt', startedAt.toISOString())
    data.set('endedAt', new Date(startedAt.getTime() + seconds * 1000).toISOString())
    data.set('notes', sessionDraft)
    setError(null)
    setSavedMessage(null)
    startSaving(async () => {
      try {
        await updateUnitSession(data)
        const trimmed = sessionDraft.trim()
        onLocalUnitChange((current) =>
          current
            ? {
                ...current,
                paintSessions: (current.paintSessions ?? []).map((item) =>
                  item.id === session.id ? { ...item, notes: trimmed } : item
                ),
              }
            : current
        )
        setEditingSessionId(null)
        setSavedMessage('Session note saved')
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not save the note.')
      }
    })
  }

  const sessionNotes = notes.filter((note) => note.kind === 'session')

  return (
    <>
      <div className={styles.noteEditor}>
        <label className={styles.field}>
          Unit note
          <textarea
            rows={4}
            value={unitNote}
            onChange={(event) => setUnitNote(event.target.value)}
            placeholder="What's done, what's next, mixes to remember…"
            disabled={saving}
          />
        </label>
        <div className={styles.noteActions}>
          <span className={styles.muted}>Shown in Paint Mode too.</span>
          <button type="button" onClick={saveUnitNoteText} disabled={saving || !unitNoteChanged} className={styles.smallButton}>
            {saving && !editingSessionId ? 'Saving…' : 'Save note'}
          </button>
        </div>
      </div>

      {sessionNotes.length ? (
        <div className={styles.checklistGroup}>
          <p className={styles.label}>From painting sessions</p>
          <ul className={styles.noteList}>
            {sessionNotes.map((note) => (
              <li key={note.id} className={styles.noteItem}>
                <div className={styles.noteActions}>
                  <p className={styles.label}>{note.label}</p>
                  {editingSessionId === note.id ? null : (
                    <button
                      type="button"
                      onClick={() => { setEditingSessionId(note.id); setSessionDraft(note.body); setError(null) }}
                      className={styles.smallButtonQuiet}
                    >
                      Edit
                    </button>
                  )}
                </div>
                {editingSessionId === note.id && note.session ? (
                  <>
                    <label className={styles.field}>
                      <span className="sr-only">Session note</span>
                      <textarea rows={3} value={sessionDraft} onChange={(event) => setSessionDraft(event.target.value)} disabled={saving} />
                    </label>
                    <div className={styles.noteActions}>
                      <button type="button" onClick={() => setEditingSessionId(null)} disabled={saving} className={styles.smallButtonQuiet}>Cancel</button>
                      <button type="button" onClick={() => saveSessionNote(note.session!)} disabled={saving} className={styles.smallButton}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className={styles.noteBody}>{note.body}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {savedMessage ? <p role="status" className={styles.muted}>{savedMessage}</p> : null}
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    </>
  )
}

function UnitPaletteSheetBody({ unit }: { unit: PreviewUnit }) {
  const paints = useMemo<PaletteCardPaint[]>(
    () =>
      (unit.palettePaints ?? []).map((paint) => ({
        themePaintId: paint.themePaintId,
        id: paint.id,
        source: paint.source,
        name: paint.name,
        brand: paint.brand,
        line: paint.line,
        hex: paint.hex,
        swatch_image_url: paint.swatchImageUrl,
      })),
    [unit.palettePaints]
  )
  return <PaletteCard unitId={unit.id} paints={paints} className="p-0" />
}

function GalleryCard({ unit, onEditGallery }: { unit: PreviewUnit; onEditGallery: () => void }) {
  const [viewing, setViewing] = useState<'inspiration' | 'snapshots' | null>(null)
  const [zoomed, setZoomed] = useState<PreviewGalleryImage | null>(null)
  const images = unit.galleryImages ?? []
  const inspiration = images.filter((image) => !image.isSnapshot)
  const snapshots = images
    .filter((image) => image.isSnapshot)
    .slice()
    .sort((a, b) => Date.parse(b.createdAt ?? '') - Date.parse(a.createdAt ?? ''))

  const collections = [
    { key: 'inspiration' as const, title: 'Inspiration / Art', items: inspiration, empty: 'Add reference art or scheme inspiration.' },
    { key: 'snapshots' as const, title: 'Progress / Snapshots', items: snapshots, empty: 'Snapshots you take in Paint Mode land here.' },
  ]
  const open = collections.find((collection) => collection.key === viewing)

  return (
    <Card
      icon="image"
      title="Gallery"
      indicator="unit-gallery-card"
      guideTarget="units.detail.gallery"
      aside={<button type="button" onClick={onEditGallery} className={styles.smallButton}>Manage</button>}
    >
      {collections.map((collection) => (
        <div key={collection.key} className={styles.galleryGroup} data-v3-unit-gallery={collection.key}>
          <div className={styles.galleryHead}>
            <p className={styles.label}>
              {collection.title}
              <span className={styles.galleryCount}>
                {collection.items.length} {collection.items.length === 1 ? 'image' : 'images'}
              </span>
            </p>
            {collection.items.length ? (
              <button type="button" onClick={() => setViewing(collection.key)} className={styles.linkButton}>
                View All <Icon name="arrow" className={styles.iconSmall} />
              </button>
            ) : null}
          </div>
          {collection.items.length ? (
            <div className={styles.thumbStrip}>
              {collection.items.slice(0, 3).map((image) => (
                <button key={image.id} type="button" onClick={() => setZoomed(image)} className={styles.thumb} aria-label={`Open ${image.alt}`}>
                  <Image src={image.image} alt="" fill sizes="(max-width: 640px) 33vw, 140px" className="object-cover" />
                </button>
              ))}
            </div>
          ) : collection.key === 'inspiration' ? (
            <button type="button" onClick={onEditGallery} className={styles.thumbEmpty}>
              <Icon name="plus" className={styles.iconSmall} /> {collection.empty}
            </button>
          ) : (
            <p className={styles.thumbEmpty}>{collection.empty}</p>
          )}
        </div>
      ))}

      {open ? (
        <Sheet title={open.title} eyebrow={`${open.items.length} images`} onClose={() => setViewing(null)} wide>
          <div className={styles.galleryGrid}>
            {open.items.map((image) => (
              <button key={image.id} type="button" onClick={() => setZoomed(image)} className={styles.gridThumb} aria-label={`Open ${image.alt}`}>
                <Image src={image.image} alt="" fill sizes="(max-width: 640px) 50vw, 200px" className="object-cover" />
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}
      {zoomed ? (
        <div className={styles.lightbox} data-wb-sheet="true" role="dialog" aria-modal="true" aria-label={zoomed.alt} onClick={() => setZoomed(null)}>
          <Image src={zoomed.image} alt={zoomed.alt} fill sizes="100vw" className="object-contain" />
        </div>
      ) : null}
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* WORKFLOW                                                            */
/* ------------------------------------------------------------------ */

export function WorkflowTab({ unit, autoStart, onLocalUnitChange }: {
  unit: PreviewUnit
  autoStart: boolean
  onLocalUnitChange: LocalUnitUpdater
}) {
  const router = useRouter()
  const [dialog, setDialog] = useState<{ kind: 'schedule'; session: ScheduledPaintSession | null } | { kind: 'log' } | null>(null)
  const workflow = unit.workflow ?? EMPTY_UNIT_WORKFLOW
  const { current } = summarizeWorkflow(workflow.steps)

  return (
    <div className={styles.stack} data-v3-unit-indicator="workflow">
      <PaintCta unit={unit} tab="workflow" autoStart={autoStart} />
      <div className={styles.secondaryRow}>
        <button type="button" onClick={() => setDialog({ kind: 'schedule', session: null })} className={styles.secondaryButton}>
          <Icon name="calendar" /> Schedule Session
        </button>
        <button type="button" onClick={() => setDialog({ kind: 'log' })} className={styles.secondaryButton}>
          <Icon name="pencil" /> Log Manually
        </button>
      </div>

      <NextStepsCard unit={unit} workflow={workflow} onLocalUnitChange={onLocalUnitChange} />
      <UpcomingSessionsCard unit={unit} onSchedule={(session) => setDialog({ kind: 'schedule', session })} onLocalUnitChange={onLocalUnitChange} />
      <RecentSessionsCard unit={unit} onLocalUnitChange={onLocalUnitChange} />

      {dialog?.kind === 'schedule' ? (
        <ScheduleSessionDialog
          unit={unit}
          existing={dialog.session}
          suggestedFocus={current ? `Continue: ${current.title}` : ''}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            onLocalUnitChange((currentUnit) => {
              if (!currentUnit) return currentUnit
              const others = (currentUnit.scheduledSessions ?? []).filter((session) => session.id !== saved.id && session.id !== dialog.session?.id)
              return {
                ...currentUnit,
                scheduledSessions: [...others, saved].sort((a, b) => `${a.dateKey}T${a.time}`.localeCompare(`${b.dateKey}T${b.time}`)),
              }
            })
            setDialog(null)
            router.refresh()
          }}
        />
      ) : null}
      {dialog?.kind === 'log' ? (
        <ManualSessionDialog
          unit={unit}
          initialDateKey={getLocalDateKey(new Date())}
          onClose={() => setDialog(null)}
          onLogged={(logged) => {
            onLocalUnitChange((currentUnit) =>
              currentUnit
                ? {
                    ...currentUnit,
                    paintSessions: [logged, ...(currentUnit.paintSessions ?? [])].sort(
                      (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)
                    ),
                    lastPainted: logged.dateKey > (currentUnit.lastPainted ?? '') ? logged.dateKey : currentUnit.lastPainted,
                  }
                : currentUnit
            )
            setDialog(null)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function StepRow({ step, tone, prefix, disabled, onToggle }: {
  step: UnitWorkflowStep
  tone: 'done' | 'current' | 'next'
  prefix?: string
  disabled: boolean
  onToggle: (step: UnitWorkflowStep) => void
}) {
  return (
    <li className={styles.stepRow} data-step-tone={tone}>
      <button
        type="button"
        role="checkbox"
        aria-checked={step.done}
        aria-label={`${step.done ? 'Mark not done' : 'Mark done'}: ${step.title}`}
        disabled={disabled}
        onClick={() => onToggle(step)}
        className={styles.checkbox}
        data-checked={step.done ? 'true' : 'false'}
      >
        {step.done ? <Icon name="check" className={styles.checkIcon} /> : null}
      </button>
      <span className={styles.stepText}>
        {prefix ? <span className={styles.stepPrefix}>{prefix}</span> : null}
        <span className={styles.stepTitle}>{step.title}</span>
      </span>
    </li>
  )
}

function useStepToggle(unit: PreviewUnit, onLocalUnitChange: LocalUnitUpdater) {
  const router = useRouter()
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const toggle = useCallback(
    async (step: UnitWorkflowStep) => {
      const nextDone = !step.done
      setError(null)
      setPendingIds((current) => new Set(current).add(step.id))
      onLocalUnitChange((current) =>
        current?.workflow ? { ...current, workflow: withStepDone(current.workflow, step.id, nextDone) } : current
      )
      try {
        await setGuideStepDone(unit.id, step.id, nextDone)
        router.refresh()
      } catch (cause) {
        onLocalUnitChange((current) =>
          current?.workflow ? { ...current, workflow: withStepDone(current.workflow, step.id, step.done) } : current
        )
        setError(cause instanceof Error ? cause.message : 'Could not update this step.')
      } finally {
        setPendingIds((current) => {
          const next = new Set(current)
          next.delete(step.id)
          return next
        })
      }
    },
    [onLocalUnitChange, router, unit.id]
  )

  return { toggle, pendingIds, error }
}

function NextStepsCard({ unit, workflow, onLocalUnitChange }: {
  unit: PreviewUnit
  workflow: UnitWorkflow
  onLocalUnitChange: LocalUnitUpdater
}) {
  const router = useRouter()
  const [sheet, setSheet] = useState<'checklist' | 'guides' | null>(null)
  const { toggle, pendingIds, error } = useStepToggle(unit, onLocalUnitChange)
  const { lastCompleted, current, upcoming } = summarizeWorkflow(workflow.steps, 1)
  const percent = workflow.total ? Math.round((workflow.completed / workflow.total) * 100) : 0
  const canTrack = workflow.trackingAvailable

  return (
    <Card
      icon="layers"
      title="Next Steps Plan"
      indicator="next-steps"
      guideTarget="units.detail.workflow"
      aside={workflow.total ? <span className={styles.countText}>{workflow.completed} of {workflow.total} complete</span> : null}
    >
      {workflow.total ? (
        <div
          className={styles.track}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={workflow.total}
          aria-valuenow={workflow.completed}
          aria-label="Guide steps complete"
        >
          <span className={styles.trackFill} style={{ width: `${percent}%` }} />
        </div>
      ) : null}

      <div className={styles.guidesBlock}>
        <div className={styles.galleryHead}>
          <p className={styles.label}>Assigned guides</p>
          <button type="button" onClick={() => setSheet('guides')} className={styles.linkButton}>
            {workflow.guides.length ? 'Manage' : 'Assign'} <Icon name="arrow" className={styles.iconSmall} />
          </button>
        </div>
        {workflow.guides.length ? (
          <div className={styles.guideGrid}>
            {workflow.guides.map((guide) => (
              <Link key={guide.key} href={guide.href} prefetch={false} className={styles.guideChip}>
                <span className={styles.guideThumb}>
                  <Image src={guide.image} alt="" fill sizes="64px" className="object-cover" />
                </span>
                <span className={styles.guideName}>{guide.title}</span>
                <Icon name="chevron" className={styles.iconSmall} />
              </Link>
            ))}
          </div>
        ) : (
          <button type="button" onClick={() => setSheet('guides')} className={styles.emptyAction}>
            Assign a guide and its steps become this unit&apos;s checklist.
          </button>
        )}
      </div>

      {workflow.total ? (
        <>
          <ul className={styles.stepList}>
            {lastCompleted ? (
              <StepRow step={lastCompleted} tone="done" prefix="Last completed" disabled={!canTrack || pendingIds.has(lastCompleted.id)} onToggle={toggle} />
            ) : null}
            {current ? (
              <StepRow step={current} tone="current" prefix="Current" disabled={!canTrack || pendingIds.has(current.id)} onToggle={toggle} />
            ) : (
              <li className={styles.allDone}>
                <Icon name="check" className={styles.iconSmall} /> All {workflow.total} steps complete
              </li>
            )}
            {upcoming.map((step) => (
              <StepRow key={step.id} step={step} tone="next" disabled={!canTrack || pendingIds.has(step.id)} onToggle={toggle} />
            ))}
          </ul>
          <button type="button" onClick={() => setSheet('checklist')} className={styles.fullChecklist}>
            View full checklist ({workflow.total}) <Icon name="arrow" className={styles.iconSmall} />
          </button>
        </>
      ) : workflow.guides.length ? (
        <p className={styles.muted}>These guides have no step cards to track yet.</p>
      ) : null}
      {!canTrack ? <p className={styles.muted}>Step tracking turns on once the latest database update is applied.</p> : null}
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}

      {sheet === 'checklist' ? (
        <Sheet title="Full Checklist" eyebrow={`${workflow.completed} of ${workflow.total} complete`} onClose={() => setSheet(null)}>
          {workflow.guides.filter((guide) => guide.stepCount > 0).map((guide) => (
            <div key={guide.key} className={styles.checklistGroup}>
              <p className={styles.label}>{guide.title}</p>
              <ul className={styles.stepList}>
                {workflow.steps.filter((step) => step.guideKey === guide.key).map((step) => (
                  <StepRow
                    key={step.id}
                    step={step}
                    tone={step.done ? 'done' : step.id === current?.id ? 'current' : 'next'}
                    prefix={step.id === current?.id ? 'Current' : undefined}
                    disabled={!canTrack || pendingIds.has(step.id)}
                    onToggle={toggle}
                  />
                ))}
              </ul>
            </div>
          ))}
          {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        </Sheet>
      ) : null}
      {sheet === 'guides' ? (
        <Sheet title="Assigned Guides" eyebrow="Workflow" onClose={() => { setSheet(null); router.refresh() }} wide>
          <p className={styles.muted}>Guides run in the order they were assigned. Their step cards become this unit&apos;s checklist; the guides themselves are not changed.</p>
          <div className={styles.legacyHost}>
            <AssignedContentCard targetType="unit" targetId={unit.id} />
          </div>
        </Sheet>
      ) : null}
    </Card>
  )
}

function Collapsible({ icon, title, preview, children, indicator, defaultOpen = false }: {
  icon: Parameters<typeof Icon>[0]['name']
  title: string
  preview: ReactNode
  children: ReactNode
  indicator: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={styles.card} data-v3-unit-indicator={indicator}>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className={styles.collapseHead}>
        <span className={styles.cardIcon}><Icon name={icon} /></span>
        <span className={styles.cardTitle}>{title}</span>
        <Icon name="down" className={`${styles.collapseChevron} ${open ? styles.collapseChevronOpen : ''}`} />
      </button>
      {open ? children : preview}
    </section>
  )
}

function scheduledLabel(session: ScheduledPaintSession) {
  const parts = [formatShortDate(session.dateKey) ?? session.dateKey, session.time]
  const minutes = Number(session.duration)
  if (minutes > 0) parts.push(formatMinutes(minutes))
  if (session.focus) parts.push(session.focus)
  return parts
}

function UpcomingSessionsCard({ unit, onSchedule, onLocalUnitChange }: {
  unit: PreviewUnit
  onSchedule: (session: ScheduledPaintSession | null) => void
  onLocalUnitChange: LocalUnitUpdater
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const todayKey = getLocalDateKey(new Date())
  const sessions = (unit.scheduledSessions ?? []).filter((session) => session.dateKey >= todayKey)

  function cancel(session: ScheduledPaintSession) {
    if (!session.id) return
    setError(null)
    startTransition(async () => {
      try {
        const formData = new FormData()
        formData.set('unitId', unit.id)
        formData.set('scheduledSessionId', session.id!)
        await deleteUnitScheduledSession(formData)
        onLocalUnitChange((current) =>
          current ? { ...current, scheduledSessions: (current.scheduledSessions ?? []).filter((item) => item.id !== session.id) } : current
        )
        router.refresh()
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not cancel this session.')
      }
    })
  }

  const row = (session: ScheduledPaintSession) => (
    <div className={styles.sessionRow}>
      <Icon name="calendar" className={styles.sessionIcon} />
      <span className={styles.sessionText}>
        {scheduledLabel(session).map((part, index) => (
          <span key={index} className={index === 0 ? styles.sessionStrong : undefined}>{part}</span>
        ))}
      </span>
    </div>
  )

  return (
    <Collapsible
      icon="calendar"
      title="Upcoming Sessions"
      indicator="upcoming-sessions"
      preview={
        sessions.length ? (
          row(sessions[0])
        ) : (
          <div className={styles.sessionEmpty}>
            <span>No sessions scheduled</span>
            <button type="button" onClick={() => onSchedule(null)} className={styles.linkButton}>Schedule</button>
          </div>
        )
      }
    >
      <ul className={styles.sessionList}>
        {sessions.map((session) => (
          <li key={session.id ?? session.dateKey} className={styles.sessionItem}>
            {row(session)}
            <div className={styles.sessionActions}>
              <button type="button" onClick={() => onSchedule(session)} className={styles.smallButton}>Edit</button>
              <button type="button" onClick={() => cancel(session)} disabled={pending} className={styles.smallButtonQuiet}>Cancel</button>
            </div>
          </li>
        ))}
        {!sessions.length ? <li className={styles.sessionEmpty}>No sessions scheduled</li> : null}
      </ul>
      <button type="button" onClick={() => onSchedule(null)} className={styles.fullChecklist}>
        <Icon name="plus" className={styles.iconSmall} /> Schedule a session
      </button>
      {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    </Collapsible>
  )
}

function RecentSessionsCard({ unit, onLocalUnitChange }: { unit: PreviewUnit; onLocalUnitChange: LocalUnitUpdater }) {
  const router = useRouter()
  const sessions = unit.paintSessions ?? []
  const snapshotsBySession = useMemo(() => {
    const map = new Map<string, PreviewGalleryImage[]>()
    for (const image of unit.galleryImages ?? []) {
      if (!image.sessionId) continue
      map.set(image.sessionId, [...(map.get(image.sessionId) ?? []), image])
    }
    return map
  }, [unit.galleryImages])

  const row = (session: UnitPaintSession) => (
    <div className={styles.sessionRow}>
      <Icon name="clock" className={styles.sessionIcon} />
      <span className={styles.sessionText}>
        <span className={styles.sessionStrong}>{formatShortDate(session.dateKey)}</span>
        <span>{session.durationSeconds ? formatSeconds(session.durationSeconds) : session.duration}</span>
      </span>
    </div>
  )

  return (
    <Collapsible
      icon="clock"
      title="Recent Sessions"
      indicator="recent-sessions"
      preview={
        sessions.length ? (
          <div className={styles.sessionPreview}>
            {sessions.slice(0, 2).map((session) => <div key={session.id}>{row(session)}</div>)}
          </div>
        ) : (
          <div className={styles.sessionEmpty}><span>No sessions logged yet</span></div>
        )
      }
    >
      <ul className={styles.sessionList}>
        {sessions.slice(0, 30).map((session) => (
          <li key={session.id}>
            <PaintSessionLog
              session={session}
              unitId={unit.id}
              snapshots={snapshotsBySession.get(session.id) ?? []}
              onSaved={(saved) => {
                onLocalUnitChange((current) =>
                  current
                    ? {
                        ...current,
                        paintSessions: (current.paintSessions ?? [])
                          .map((item) => (item.id === saved.id ? saved : item))
                          .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)),
                      }
                    : current
                )
                router.refresh()
              }}
            />
          </li>
        ))}
        {!sessions.length ? <li className={styles.sessionEmpty}>No sessions logged yet</li> : null}
      </ul>
      {sessions.length > 30 ? <p className={styles.muted}>Showing the latest 30 of {sessions.length} sessions.</p> : null}
    </Collapsible>
  )
}

/* ------------------------------------------------------------------ */
/* Session dialogs                                                     */
/* ------------------------------------------------------------------ */

function PaintSessionLog({ session, unitId, snapshots, onSaved }: {
  session: UnitPaintSession
  unitId: string
  snapshots: PreviewGalleryImage[]
  onSaved: (session: UnitPaintSession) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, startSaving] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const started = new Date(session.startedAt)
  const localStarted = new Date(started.getTime() - started.getTimezoneOffset() * 60000).toISOString()
  const durationSeconds = session.durationSeconds ?? 0

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const values = new FormData(event.currentTarget)
    const start = new Date(`${values.get('date')}T${values.get('time')}`)
    const seconds = Math.round(Number(values.get('minutes')) * 60)
    const end = new Date(start.getTime() + seconds * 1000)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || !Number.isFinite(seconds) || seconds <= 0) {
      setError('Enter a valid date, time, and length greater than zero.')
      return
    }
    const data = new FormData()
    data.set('unitId', unitId)
    data.set('sessionId', session.id)
    data.set('startedAt', start.toISOString())
    data.set('endedAt', end.toISOString())
    setError(null)
    startSaving(async () => {
      try {
        const saved = await updateUnitSession(data)
        onSaved({
          ...session,
          startedAt: saved.started_at,
          dateKey: getLocalDateKey(new Date(saved.started_at)),
          durationSeconds: saved.duration_seconds,
          duration: formatSeconds(saved.duration_seconds),
        })
        setEditing(false)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not update session. Please try again.')
      }
    })
  }

  return (
    <div className={styles.sessionDetail} data-v3-unit-indicator="unit-session-log">
      <div className={styles.sessionDetailHead}>
        <div className="min-w-0">
          <p className={styles.sessionStrong}>
            {formatShortDate(session.dateKey)} · {started.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {durationSeconds ? formatSeconds(durationSeconds) : session.duration}
          </p>
          {session.notes ? <p className={styles.noteBody}>{session.notes}</p> : null}
        </div>
        <button type="button" aria-label="Edit session" aria-expanded={editing} onClick={() => { setEditing(!editing); setError(null) }} disabled={saving} className={styles.smallButtonQuiet}>
          {editing ? 'Close' : 'Edit'}
        </button>
      </div>
      {snapshots.length ? (
        <div className={styles.sessionSnapshots}>
          {snapshots.slice(0, 4).map((image) => (
            <span key={image.id} className={styles.sessionSnapshot}>
              <Image src={image.image} alt="" fill sizes="64px" className="object-cover" />
            </span>
          ))}
        </div>
      ) : null}
      {editing ? (
        <form onSubmit={save} aria-label="Edit painting session" className={styles.inlineForm}>
          <label className={styles.field}>Date<input name="date" type="date" required defaultValue={localStarted.slice(0, 10)} disabled={saving} /></label>
          <label className={styles.field}>Start<input name="time" type="time" step="60" required defaultValue={localStarted.slice(11, 16)} disabled={saving} /></label>
          <label className={styles.field}>Minutes<input name="minutes" type="number" min="1" step="any" required defaultValue={Math.round(durationSeconds / 60)} disabled={saving} /></label>
          {error ? <p role="alert" className={styles.error}>{error}</p> : null}
          <button type="submit" disabled={saving} className={styles.smallButton}>{saving ? 'Saving…' : 'Save session'}</button>
        </form>
      ) : null}
    </div>
  )
}

function ManualSessionDialog({ unit, initialDateKey, onClose, onLogged }: {
  unit: PreviewUnit
  initialDateKey: string
  onClose: () => void
  onLogged: (session: UnitPaintSession) => void
}) {
  const unitId = unit.id
  const [saving, startSaving] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [dateKey, setDateKey] = useState(initialDateKey)
  const [defaultTime] = useState(() => {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
    if (getLocalDateKey(hourAgo) !== initialDateKey) return '19:00'
    return `${String(hourAgo.getHours()).padStart(2, '0')}:${String(hourAgo.getMinutes()).padStart(2, '0')}`
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const values = new FormData(event.currentTarget)
    const start = new Date(`${dateKey}T${values.get('time')}`)
    const seconds = Math.round(Number(values.get('minutes')) * 60)
    const end = new Date(start.getTime() + seconds * 1000)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(seconds) || seconds <= 0) {
      setError('Enter a valid date, time, and length greater than zero.')
      return
    }
    if (start.getTime() > Date.now()) {
      setError('A logged session cannot start in the future. Use Schedule for upcoming sessions.')
      return
    }
    const notes = String(values.get('notes') || '').trim()
    const data = new FormData()
    data.set('unitId', unitId)
    data.set('startedAt', start.toISOString())
    data.set('endedAt', end.toISOString())
    data.set('notes', notes)
    setError(null)
    startSaving(async () => {
      try {
        const saved = await logManualUnitSession(data)
        const durationSeconds = saved.duration_seconds ?? seconds
        onLogged({
          id: saved.id,
          startedAt: saved.started_at,
          dateKey: getLocalDateKey(new Date(saved.started_at)),
          durationSeconds,
          duration: formatSeconds(durationSeconds),
          title: notes ? notes.split('\n')[0] : 'Manual painting log',
          notes,
        })
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not log session. Please try again.')
      }
    })
  }

  return (
    <Sheet title="Log a painting session" eyebrow="Log manually" onClose={onClose}>
      <form onSubmit={submit} aria-label="Log painting session" className={styles.form}>
        <SessionCalendar unit={unit} selected={dateKey} onSelect={setDateKey} mode="past" />
        <label className={styles.field}>Date<input name="date" type="date" required value={dateKey} onChange={(event) => setDateKey(event.target.value)} max={getLocalDateKey(new Date())} disabled={saving} /></label>
        <div className={styles.fieldRow}>
          <label className={styles.field}>Start time<input name="time" type="time" required defaultValue={defaultTime} disabled={saving} /></label>
          <label className={styles.field}>Minutes<input name="minutes" type="number" inputMode="numeric" min="1" step="any" required defaultValue={60} disabled={saving} /></label>
        </div>
        <label className={styles.field}>Notes<textarea name="notes" rows={3} disabled={saving} placeholder="What did you work on?" /></label>
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        <button type="submit" disabled={saving} className={styles.primaryButton}>{saving ? 'Saving…' : 'Log Session'}</button>
      </form>
    </Sheet>
  )
}

function ScheduleSessionDialog({ unit, existing, suggestedFocus, onClose, onSaved }: {
  unit: PreviewUnit
  existing: ScheduledPaintSession | null
  suggestedFocus: string
  onClose: () => void
  onSaved: (session: ScheduledPaintSession) => void
}) {
  const todayKey = getLocalDateKey(new Date())
  const [saving, startSaving] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [notify, setNotify] = useState(existing?.notify ?? false)
  const [reminderHoursBefore, setReminderHoursBefore] = useState(existing?.reminderHoursBefore ?? 1)
  const [reminderChannel, setReminderChannel] = useState<'push' | 'email'>(existing?.reminderChannel ?? 'email')
  const [dateKey, setDateKey] = useState(existing?.dateKey ?? todayKey)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    const values = new FormData(event.currentTarget)
    const time = String(values.get('time') || '19:30')
    const minutes = String(values.get('minutes') || '')
    const focus = String(values.get('focus') || '').trim() || 'Focused painting session'
    const start = new Date(`${dateKey}T${time}:00`)
    if (!dateKey || Number.isNaN(start.getTime())) {
      setError('Pick a date and time for this session.')
      return
    }
    const formData = new FormData()
    formData.set('unitId', unit.id)
    formData.set('scheduledStartAt', start.toISOString())
    formData.set('focus', focus)
    formData.set('plannedMinutes', minutes)
    formData.set('notify', notify ? 'true' : 'false')
    if (notify) {
      formData.set('reminderHoursBefore', String(reminderHoursBefore))
      formData.set('reminderChannel', reminderChannel)
    }
    setError(null)
    startSaving(async () => {
      try {
        const saved = existing?.id
          ? await (async () => {
              formData.set('scheduledSessionId', existing.id!)
              return updateUnitScheduledSession(formData)
            })()
          : await scheduleUnitSession(formData)
        onSaved({
          id: saved.id,
          dateKey,
          time,
          duration: minutes,
          focus,
          notes: '',
          notify,
          reminderHoursBefore,
          reminderChannel,
        })
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not schedule this session.')
      }
    })
  }

  return (
    <Sheet title={existing ? 'Edit scheduled session' : 'Schedule a session'} eyebrow="Schedule" onClose={onClose}>
      <form onSubmit={submit} className={styles.form}>
        <SessionCalendar unit={unit} selected={dateKey} onSelect={setDateKey} mode="future" />
        <label className={styles.field}>Date<input name="date" type="date" required min={todayKey} value={dateKey} onChange={(event) => setDateKey(event.target.value)} disabled={saving} /></label>
        <div className={styles.fieldRow}>
          <label className={styles.field}>Time<input name="time" type="time" required defaultValue={existing?.time ?? '19:30'} disabled={saving} /></label>
          <label className={styles.field}>Minutes<input name="minutes" type="number" inputMode="numeric" min="5" step="5" defaultValue={existing?.duration || '60'} disabled={saving} /></label>
        </div>
        <label className={styles.field}>Focus<input name="focus" defaultValue={existing?.focus ?? suggestedFocus} placeholder="What will you work on?" disabled={saving} /></label>
        <label className={styles.checkField}>
          <input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} disabled={saving} />
          Notify me before this session
        </label>
        {notify ? (
          <fieldset className={styles.fieldset}>
            <label className={styles.field}>
              Remind me
              <select value={reminderHoursBefore} onChange={(event) => setReminderHoursBefore(Number(event.target.value))}>
                {[1, 2, 3, 6, 12, 24].map((hours) => (
                  <option key={hours} value={hours}>{hours} {hours === 1 ? 'hour' : 'hours'} before</option>
                ))}
              </select>
            </label>
            <div className={styles.fieldRow}>
              {(['push', 'email'] as const).map((channel) => (
                <label key={channel} className={styles.checkField}>
                  <input type="radio" name="reminder-channel" value={channel} checked={reminderChannel === channel} onChange={() => setReminderChannel(channel)} />
                  {channel === 'push' ? 'Phone notification' : 'Email'}
                </label>
              ))}
            </div>
            <p className={styles.muted}>Reminder delivery is not available yet. These choices save your preference.</p>
          </fieldset>
        ) : null}
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        <button type="submit" disabled={saving} className={styles.primaryButton}>{saving ? 'Saving…' : 'Save Scheduled Session'}</button>
      </form>
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */
/* Session calendar (Schedule / Log dialogs)                           */
/* ------------------------------------------------------------------ */

const weekDayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function monthStart(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00`)
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function formatScheduleDay(dateKey: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${dateKey}T12:00:00`))
}

// Month view of the unit's painting days: logged sessions and scheduled
// sessions are marked; picking a day fills the dialog's date field. Logging
// can only pick today or earlier, scheduling today or later.
function SessionCalendar({ unit, selected, onSelect, mode }: {
  unit: PreviewUnit
  selected: string
  onSelect: (dateKey: string) => void
  mode: 'past' | 'future'
}) {
  const todayKey = getLocalDateKey(new Date())
  const [cursor, setCursor] = useState(() => monthStart(selected || todayKey))
  const loggedDays = useMemo(() => new Set((unit.paintSessions ?? []).map((session) => session.dateKey)), [unit.paintSessions])
  const scheduledDays = useMemo(() => new Set((unit.scheduledSessions ?? []).map((session) => session.dateKey)), [unit.scheduledSessions])
  const offset = cursor.getDay()
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(cursor)

  // Typing a date in the field moves the calendar to that month.
  const [shownSelection, setShownSelection] = useState(selected)
  if (selected !== shownSelection) {
    setShownSelection(selected)
    if (selected) setCursor(monthStart(selected))
  }

  return (
    <div className={styles.calendar} data-v3-unit-indicator="session-calendar">
      <div className={styles.calendarHead}>
        <button type="button" aria-label="Previous month" onClick={() => setCursor((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))} className={styles.calendarNav}>
          <Icon name="chevron" className={`${styles.iconSmall} ${styles.flip}`} />
        </button>
        <p className={styles.calendarMonth} data-v3-unit-calendar-month={monthLabel}>{monthLabel}</p>
        <button type="button" aria-label="Next month" onClick={() => setCursor((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))} className={styles.calendarNav}>
          <Icon name="chevron" className={styles.iconSmall} />
        </button>
      </div>
      <div className={styles.calendarGrid} role="grid" aria-label={monthLabel}>
        {weekDayLabels.map((label, index) => (
          <span key={`${label}-${index}`} className={styles.calendarWeekday} aria-hidden="true">{label}</span>
        ))}
        {Array.from({ length: offset }).map((_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: daysInMonth }).map((_, index) => {
          const day = index + 1
          const dateKey = getLocalDateKey(new Date(cursor.getFullYear(), cursor.getMonth(), day))
          const logged = loggedDays.has(dateKey)
          const scheduled = scheduledDays.has(dateKey)
          const disabled = mode === 'past' ? dateKey > todayKey : dateKey < todayKey
          const parts = [formatScheduleDay(dateKey)]
          if (logged) parts.push('painting session logged')
          if (scheduled) parts.push('session scheduled')
          return (
            <button
              key={dateKey}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(dateKey)}
              aria-pressed={selected === dateKey}
              aria-label={parts.join(', ')}
              className={styles.calendarDay}
              data-logged={logged ? 'true' : undefined}
              data-scheduled={scheduled ? 'true' : undefined}
              data-today={dateKey === todayKey ? 'true' : undefined}
            >
              {day}
              {logged || scheduled ? <span className={styles.calendarDot} aria-hidden="true" /> : null}
            </button>
          )
        })}
      </div>
      <p className={styles.calendarLegend}>
        <span><span className={styles.legendLogged} /> Logged</span>
        <span><span className={styles.legendScheduled} /> Scheduled</span>
      </p>
    </div>
  )
}
