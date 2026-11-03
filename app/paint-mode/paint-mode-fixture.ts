import type { GuidesV3DeckDetail, GuidesV3DeckStepPaint } from '../guides/guides-v3-detail-data'
import {
  guidePaintSwatches,
  toPaintModeGuide,
  type PaintModeProjectGroup,
  type PaintModeUnit,
  type PaintModeViewModel,
} from './paint-mode-model'

// Dev-only fixtures for /paint-mode?golden=paint-mode-empty|paint-mode-active.
// Actions run against local state only (see paint-mode-screen.tsx).

function fixturePaint(id: string, name: string, line: string, color: string, ratioText: string | null = null): GuidesV3DeckStepPaint {
  return { id, name, brand: 'Citadel', line, color, swatchImageUrl: null, isOwned: true, isWishlist: false, ratioText }
}

const paints = {
  bone: fixturePaint('fx-bone', 'Wraithbone', 'Base', '#d9cba8'),
  blue: fixturePaint('fx-blue', 'Kantor Blue', 'Base', '#1f5a95'),
  violet: fixturePaint('fx-violet', 'Xereus Purple', 'Layer', '#5a2a8c', '2:1'),
  gold: { ...fixturePaint('fx-gold', 'Retributor Armour', 'Base', '#b88a3e'), isOwned: false },
}

// Used only when no real guide could be loaded (signed out): same shape as
// getGuidesV3DeckDetail, so it still renders through the real guide cards.
const fallbackDeck: GuidesV3DeckDetail = {
  id: 'fx-guide-glaze',
  title: 'Spectral Robes',
  description: 'Layered violet glazes over a blue base.',
  category: 'Cloth',
  cards: 3,
  paints: 4,
  usedIn: 1,
  image: '/onboarding/pains/scheme-loss.jpeg',
  fullImage: '/onboarding/pains/scheme-loss.jpeg',
  difficulty: null,
  saved: false,
  isOwner: true,
  accent: '#5a2a8c',
  createdAt: '2025-01-06T00:00:00.000Z',
  isPublic: false,
  ownerLabel: 'You',
  coverPosition: 0,
  paintList: Object.values(paints).map((paint) => ({ ...paint, ratioText: undefined })),
  steps: [
    { id: 'fx-step-base', number: 1, title: 'Base the robes', template: null, instructions: 'Two thin coats of Kantor Blue over Wraithbone, leaving the recesses dark.', image: null, rawImage: null, videoUrl: null, paints: [paints.bone, paints.blue], imageFocalX: 50, imageFocalY: 50 },
    { id: 'fx-step-glaze', number: 2, title: 'Violet glaze', template: null, instructions: 'Glaze the upper folds with Xereus Purple thinned 2:1 with medium.', image: null, rawImage: null, videoUrl: null, paints: [paints.violet], imageFocalX: 50, imageFocalY: 50 },
    { id: 'fx-step-trim', number: 3, title: 'Gilded trim', template: null, instructions: 'Pick out the hem and clasps in Retributor Armour.', image: null, rawImage: null, videoUrl: null, paints: [paints.gold], imageFocalX: 50, imageFocalY: 50 },
  ],
}

const projects: PaintModeProjectGroup[] = [
  {
    id: 'fx-project-spire',
    name: 'Spire of Whispers',
    units: [
      { id: 'fx-unit-summoner', name: 'The Gaunt Summoner', image: '/onboarding/welcome-hero.jpeg', status: 'active' },
      { id: 'fx-unit-acolytes', name: 'Ember Acolytes', image: '/onboarding/pains/tough-choices.jpeg', status: 'bench' },
    ],
  },
  {
    id: 'fx-project-desert',
    name: 'Desert Table',
    units: [
      { id: 'fx-unit-patrol', name: 'Ashen Patrol', image: '/onboarding/pains/paint-management.jpeg', status: 'active' },
      { id: 'fx-unit-warden', name: 'Copper Warden', image: '/onboarding/pains/scheme-loss.jpeg', status: 'pile' },
    ],
  },
]

function minutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000).toISOString()
}

// Every unit the fixture picker can start, keyed by id.
// `deck` is a real guide from the signed-in account when the page could load
// one (see page.tsx), so Open Guide and the swatches show real cards and hues.
export function createPaintModeFixtureUnit(
  unitId: string,
  startedAt = new Date().toISOString(),
  deck: GuidesV3DeckDetail | null = null
): PaintModeUnit {
  const option = projects.flatMap((project) =>
    project.units.map((unit) => ({ ...unit, projectName: project.name }))
  ).find((unit) => unit.id === unitId) ?? { ...projects[0].units[0], projectName: projects[0].name }

  const isSummoner = option.id === 'fx-unit-summoner'
  const guideDeck = deck ?? fallbackDeck
  const guideSwatches = guidePaintSwatches(guideDeck)

  return {
    unitId: option.id,
    name: option.name,
    projectName: option.projectName,
    heroImage: option.image ?? '/onboarding/first-project-bg.jpeg',
    session: { id: `fx-session-${option.id}`, startedAt, pausedAt: null, pausedSeconds: 0 },
    stage: { stepId: `fx-step-${option.id}`, stepKey: 'fine_details', label: 'Fine Details' },
    note: isSummoner ? 'Thin the purple glaze 2:1 before the robe folds. Keep the eye lenses sharp.' : '',
    stagePaints: isSummoner ? guideSwatches.slice(0, 3) : [],
    palette: isSummoner ? guideSwatches : [],
    guides: isSummoner ? [toPaintModeGuide(guideDeck)] : [],
    inspiration: isSummoner
      ? [
          { id: 'fx-insp-1', src: '/onboarding/pains/pile-of-shame.jpeg', alt: 'Reference: robes', createdAt: minutesAgo(60 * 24 * 30) },
          { id: 'fx-insp-2', src: '/onboarding/problem-desk.jpeg', alt: 'Reference: staff', createdAt: minutesAgo(60 * 24 * 20) },
        ]
      : [],
    // No snapshots yet: Take Snapshot and Progress Gallery start empty and
    // fill from the camera/gallery picker.
    snapshots: [],
    metrics: {
      loggedSeconds: isSummoner ? 11 * 3600 + 18 * 60 : 0,
      finishedSessions: isSummoner ? 11 : 0,
      addedAt: '2025-01-06',
      deadline: isSummoner ? '2025-02-14' : null,
    },
  }
}

export function createPaintModeFixture(
  name: 'paint-mode-empty' | 'paint-mode-active',
  deck: GuidesV3DeckDetail | null = null
): PaintModeViewModel {
  if (name === 'paint-mode-empty') {
    return { units: [], focusUnitId: null, projects }
  }

  // 1h 24m 36s into the session, as in the approved mockup.
  const summoner = createPaintModeFixtureUnit(
    'fx-unit-summoner',
    new Date(Date.now() - (1 * 3600 + 24 * 60 + 36) * 1000).toISOString(),
    deck
  )
  return { units: [summoner], focusUnitId: summoner.unitId, projects }
}

