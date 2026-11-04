// Paint Mode view-model. The live loader (paint-mode-data.ts) and the static
// fixtures (paint-mode-fixture.ts) both produce this shape, so the same
// PaintModeView renders either - the fixture is not a separate fake screen.

import type { GuidesV3GuideFile } from '../guides/guides-v3-data'
import type { GuidesV3DeckDetail } from '../guides/guides-v3-detail-data'
import type { GuideCardPlacement } from '../guides/shared/guide-card-layout'

export type PaintModeSwatch = {
  id: string
  source: 'catalog' | 'custom'
  name: string
  brand: string | null
  line: string | null
  hex: string | null
  swatchImageUrl: string | null
  // In the user's collection (custom paints always are).
  owned: boolean
}

export type PaintModeImage = {
  id: string
  src: string
  alt: string
  createdAt: string | null
}

// What Open Guide renders: the same detail the guide's own view mode uses.
// `layout` is set for a guide (its card order, including its own cover and
// index cards) and null for a plain deck.
export type PaintModeGuideCards = {
  decks: GuidesV3DeckDetail[]
  layout: GuideCardPlacement[] | null
}

// A guide or deck assigned to the unit. A guide's `cards` stay null until it
// is opened: building them reads the whole guide library, too slow for the
// load of a screen people open to start a timer.
export type PaintModeGuide = {
  id: string
  title: string
  subtitle: string
  image: string | null
  cardCount: number | null
  cards: PaintModeGuideCards | null
}

export type PaintModeSessionTiming = {
  id: string
  startedAt: string
  pausedAt: string | null
  pausedSeconds: number
}

export type PaintModeStage = {
  // unit_progress_steps.id - null when the unit has no progress steps yet.
  stepId: string | null
  stepKey: string
  label: string
}

// One unit on the bench with a running (or paused) session.
export type PaintModeUnit = {
  unitId: string
  name: string
  projectName: string
  heroImage: string
  session: PaintModeSessionTiming
  stage: PaintModeStage | null
  note: string
  // Paints logged on the current stage (Paints Used).
  stagePaints: PaintModeSwatch[]
  // The unit palette card (Paint Palette).
  palette: PaintModeSwatch[]
  guides: PaintModeGuide[]
  // Unit gallery photos that did not come from a Paint Mode snapshot.
  inspiration: PaintModeImage[]
  // Snapshots from every Paint Mode session, oldest first.
  snapshots: PaintModeImage[]
  metrics: {
    // Finished sessions only; the running session's time is added live.
    loggedSeconds: number
    finishedSessions: number
    addedAt: string | null
    deadline: string | null
  }
}

export type PaintModeUnitOption = {
  id: string
  name: string
  image: string | null
  status: string | null
}

export type PaintModeProjectGroup = {
  id: string
  name: string
  units: PaintModeUnitOption[]
}

export type PaintModeViewModel = {
  units: PaintModeUnit[]
  focusUnitId: string | null
  projects: PaintModeProjectGroup[]
}

export const PAINT_MODE_FALLBACK_HERO = '/onboarding/first-project-bg.jpeg'

export function toPaintModeGuide(deck: GuidesV3DeckDetail): PaintModeGuide {
  return {
    id: deck.id,
    title: deck.title,
    subtitle: deck.description,
    image: deck.image || null,
    cardCount: deck.steps.length + (deck.coverPosition === null ? 0 : 1),
    cards: { decks: [deck], layout: null },
  }
}

export function toPaintModeGuideFile(guide: GuidesV3GuideFile): PaintModeGuide {
  return {
    id: guide.id,
    title: guide.title,
    subtitle: guide.subtitle,
    image: guide.image || null,
    cardCount: null,
    cards: null,
  }
}

// A guide's paint list as Paint Mode swatches (guide paints are catalog paints).
export function guidePaintSwatches(deck: GuidesV3DeckDetail): PaintModeSwatch[] {
  return deck.paintList.map((paint) => ({
    id: paint.id,
    source: 'catalog',
    name: paint.name,
    brand: paint.brand || null,
    line: paint.line || null,
    hex: paint.color || null,
    swatchImageUrl: paint.swatchImageUrl,
    owned: paint.isOwned,
  }))
}

export function getFocusUnit(model: Pick<PaintModeViewModel, 'units' | 'focusUnitId'>) {
  return (
    model.units.find((unit) => unit.unitId === model.focusUnitId) ??
    model.units[0] ??
    null
  )
}

export function formatTimer(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map((part) => String(part).padStart(2, '0')).join(':')
}

export function formatShortDate(value: string | null) {
  if (!value) return null
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function swatchColor(paint: Pick<PaintModeSwatch, 'hex'>) {
  return paint.hex || '#8f7a5c'
}
