'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ReactNode, useEffect, useRef, useState, useTransition } from 'react'
import AppHamburgerMenu from '../components/app-hamburger-menu'
import FeatureGuideTour from '../components/feature-guide-tour'
import { findVisibleFeatureGuideIndex } from '../components/feature-guide-navigation'
import V3PerfIndicator from '../components/v3-perf-indicator'
import styles from './guides-v3-silver.module.css'
import { createDeckFromForge } from './actions'
import type { FeatureGuideEntry } from '../components/feature-guide-types'
import type {
  GuidesV3Deck,
  GuidesV3GuideFile,
  GuidesV3Payload,
} from './guides-v3-data'
import type { GuidesV3DeckDetail } from './guides-v3-detail-data'
import DeckEditorClient, {
  type DeckEditorInitialCard,
  type DeckEditorSavePayload,
} from './decks/[id]/deck-editor-client'

type GuideTab = 'guides' | 'decks' | 'library'
type ForgeMode = 'guide' | 'deck'
type ForgeScreen =
  | 'guide-decks'
  | 'guide-compose'
  | 'source'
  | 'unit'
  | 'project'
  | 'photos'
  | 'paints'
  | 'blank'
  | 'draft'
  | 'build'
  | 'deck-editor'
type SourceKind = 'unit' | 'project' | 'photos' | 'paints' | 'blank' | 'scratch'
type BuildTab = 'details' | 'cards' | 'preview'
type DeckDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'
type DeckStatus = 'Draft' | 'Private' | 'Public'
type CardTemplate = 'title' | 'step' | 'theme' | 'image' | 'paints' | 'video'

type GuideFile = GuidesV3GuideFile
type Deck = GuidesV3Deck & {
  draft?: ForgeDeck
}

type ForgeDeck = {
  id: string
  title: string
  description: string
  difficulty: DeckDifficulty
  status: DeckStatus
  type: string
  cards: ForgeCard[]
  gallery: ForgeDeckImage[]
  heroImageId: string
  required: boolean
}

type ForgeCard = {
  id: string
  title: string
  template: CardTemplate
  body: string
  image: string
}

type ForgeDeckImage = {
  id: string
  url: string
  alt: string
}

type SourceUnit = {
  id: string
  title: string
  meta: string
  image: string
}

type SourceProject = {
  id: string
  title: string
  meta: string
  image: string
  units: SourceUnit[]
}

const initialGuideFiles: GuideFile[] = [
  {
    id: 'classic-tomb-kings',
    title: 'Classic Tomb Kings Skeletons',
    subtitle: 'Bone, gold, and turquoise armor for ancient warriors.',
    image: '/onboarding/pains/tough-choices.jpeg',
    decks: 6,
    cards: 24,
    level: 'Beginner',
    ownedPercent: 78,
    palette: ['#d8bd83', '#d29631', '#17b9c2', '#7a5d37', '#111417'],
  },
  {
    id: 'ultramarines-battleline',
    title: 'Ultramarines Battleline',
    subtitle: 'Blue armor, metal, and gold for the sons of Guilliman.',
    image: '/onboarding/pains/paint-management.jpeg',
    decks: 5,
    cards: 20,
    level: 'Beginner',
    ownedPercent: 63,
    palette: ['#1e4f92', '#9aafbd', '#d29631', '#171815', '#efe3c5'],
  },
  {
    id: 'emerald-grave-guard',
    title: 'Emerald Grave Guard',
    subtitle: 'Ancient bone, toxic emeralds, and spectral highlights.',
    image: '/onboarding/pains/scheme-loss.jpeg',
    decks: 4,
    cards: 18,
    level: 'Intermediate',
    ownedPercent: 68,
    palette: ['#4eb282', '#17b9c2', '#d8bd83', '#5943a7', '#111417'],
  },
]

const initialDecks: Deck[] = [
  {
    id: 'ancient-bone',
    title: 'Ancient Bone',
    category: 'Bone',
    cards: 4,
    paints: 5,
    usedIn: 3,
    image: '/onboarding/pains/pile-of-shame.jpeg',
    saved: true,
    accent: '#d8bd83',
  },
  {
    id: 'forgotten-tomb-gold',
    title: 'Forgotten Tomb Gold',
    category: 'Gold',
    cards: 4,
    paints: 4,
    usedIn: 2,
    image: '/onboarding/first-project-bg.jpeg',
    saved: true,
    accent: '#d29631',
  },
  {
    id: 'verdigris-brass-weapons',
    title: 'Verdigris Brass Weapons',
    category: 'Metal',
    cards: 6,
    paints: 6,
    usedIn: 4,
    image: '/onboarding/pains/tough-choices.jpeg',
    saved: true,
    accent: '#17b9c2',
  },
  {
    id: 'classic-turquoise-armour',
    title: 'Classic Turquoise Armour',
    category: 'Armour',
    cards: 4,
    paints: 5,
    usedIn: 3,
    image: '/onboarding/pains/paint-management.jpeg',
    saved: true,
    accent: '#17b9c2',
  },
  {
    id: 'desert-sand-bases',
    title: 'Desert Sand Bases',
    category: 'Basing',
    cards: 5,
    paints: 7,
    usedIn: 5,
    image: '/onboarding/pains/scheme-loss.jpeg',
    saved: true,
    accent: '#d29631',
  },
]

const sourceUnits: SourceUnit[] = [
  {
    id: 'guido',
    title: 'Guido',
    meta: '6 stages - 14 paints - 9 photos',
    image: '/onboarding/first-project-bg.jpeg',
  },
  {
    id: 'tomb-guard-captain',
    title: 'Tomb Guard Captain',
    meta: '7 stages - 16 paints - 11 photos',
    image: '/onboarding/pains/tough-choices.jpeg',
  },
  {
    id: 'skeleton-warriors',
    title: 'Skeleton Warriors',
    meta: '5 stages - 12 paints - 8 photos',
    image: '/onboarding/pains/paint-management.jpeg',
  },
  {
    id: 'sepulchral-chariot',
    title: 'Sepulchral Chariot',
    meta: '6 stages - 14 paints - 9 photos',
    image: '/onboarding/pains/scheme-loss.jpeg',
  },
]

const sourceProjects: SourceProject[] = [
  {
    id: 'classic-tomb-kings-army',
    title: 'Classic Tomb Kings Army',
    meta: '4 units - 65 paints - 45 photos',
    image: '/onboarding/pains/tough-choices.jpeg',
    units: sourceUnits.slice(1),
  },
  {
    id: 'samurai-pizza-cats',
    title: 'Samurai Pizza Cats',
    meta: '3 units - 28 paints - 22 photos',
    image: '/onboarding/first-project-bg.jpeg',
    units: sourceUnits.slice(0, 3),
  },
]

const sourcePhotos = [
  '/onboarding/first-project-bg.jpeg',
  '/onboarding/pains/tough-choices.jpeg',
  '/onboarding/pains/paint-management.jpeg',
  '/onboarding/pains/scheme-loss.jpeg',
  '/onboarding/pains/pile-of-shame.jpeg',
  '/onboarding/problem-desk.jpeg',
]

const sourcePaints = [
  { name: 'Ushabti Bone', brand: 'Citadel', type: 'Base', color: '#d8bd83' },
  { name: 'Screaming Skull', brand: 'Citadel', type: 'Layer', color: '#efe3c5' },
  { name: 'Zandri Dust', brand: 'Citadel', type: 'Base', color: '#b7b3a0' },
  { name: 'Retributor Armour', brand: 'Citadel', type: 'Base', color: '#d29631' },
  { name: 'Stormhost Silver', brand: 'Citadel', type: 'Layer', color: '#9aafbd' },
  { name: 'Akhelian Green', brand: 'Citadel', type: 'Layer', color: '#17b9c2' },
]

type BlankTemplateStep = {
  glyph: string
  template: CardTemplate
}

type BlankTemplate = {
  id: string
  name: string
  description: string
  sequence: BlankTemplateStep[]
}

const blankTemplates: BlankTemplate[] = [
  {
    id: '4-step-recipe',
    name: '4-Step Recipe',
    description: 'Paints + 4 steps. Fast and practical.',
    sequence: [
      { glyph: '\u{1F3A8}', template: 'paints' },
      { glyph: '1', template: 'step' },
      { glyph: '2', template: 'step' },
      { glyph: '3', template: 'step' },
      { glyph: '4', template: 'step' },
      { glyph: '\u{1F5BC}', template: 'image' },
    ],
  },
  {
    id: 'photo-walkthrough',
    name: 'Photo Walkthrough',
    description: 'Progress photos paired with instructions.',
    sequence: [
      { glyph: '\u{1F5BC}', template: 'image' },
      { glyph: '1', template: 'step' },
      { glyph: '\u{1F5BC}', template: 'image' },
      { glyph: '2', template: 'step' },
      { glyph: '\u{1F5BC}', template: 'image' },
    ],
  },
  {
    id: 'color-scheme',
    name: 'Color Scheme',
    description: 'Palette-first guide for recreating a look.',
    sequence: [
      { glyph: '◈', template: 'theme' },
      { glyph: '\u{1F3A8}', template: 'paints' },
      { glyph: '1', template: 'step' },
      { glyph: '2', template: 'step' },
      { glyph: '3', template: 'step' },
      { glyph: '\u{1F5BC}', template: 'image' },
    ],
  },
  {
    id: 'technique-lesson',
    name: 'Technique Lesson',
    description: 'Teach one skill with video and examples.',
    sequence: [
      { glyph: '▶', template: 'video' },
      { glyph: '1', template: 'step' },
      { glyph: '\u{1F5BC}', template: 'image' },
      { glyph: '2', template: 'step' },
    ],
  },
  {
    id: 'showcase',
    name: 'Showcase',
    description: 'Image-led presentation of finished work.',
    sequence: [
      { glyph: '◈', template: 'theme' },
      { glyph: '\u{1F5BC}', template: 'image' },
      { glyph: '\u{1F5BC}', template: 'image' },
      { glyph: '\u{1F5BC}', template: 'image' },
      { glyph: '\u{1F3A8}', template: 'paints' },
    ],
  },
  {
    id: 'full-tutorial',
    name: 'Full Tutorial',
    description: 'The complete start-to-finish process.',
    sequence: [
      { glyph: '\u{1F3A8}', template: 'paints' },
      { glyph: '1', template: 'step' },
      { glyph: '\u{1F5BC}', template: 'image' },
      { glyph: '2', template: 'step' },
      { glyph: '▶', template: 'video' },
      { glyph: '3', template: 'step' },
      { glyph: '\u{1F5BC}', template: 'image' },
    ],
  },
]

const libraryTags = [
  'Bone',
  'Armor',
  'Gold',
  'Basing',
  'Beginner',
  'Tomb Kings',
  'Ultramarines',
  'Metal',
  'Weathering',
]

const publicGuideFiles: GuideFile[] = [
  {
    id: 'khemri-royal-guard',
    title: 'Khemri Royal Guard',
    subtitle: 'by HerPainter - Tomb Kings',
    image: '/onboarding/pains/tough-choices.jpeg',
    decks: 6,
    cards: 26,
    level: 'Intermediate',
    ownedPercent: 42,
    palette: ['#d8bd83', '#d29631', '#17b9c2', '#7a5d37', '#111417'],
  },
  {
    id: 'ultramarines-intercessors',
    title: 'Ultramarines Intercessors',
    subtitle: 'by BrushDoctor - Ultramarines',
    image: '/onboarding/pains/paint-management.jpeg',
    decks: 5,
    cards: 21,
    level: 'Beginner',
    ownedPercent: 55,
    palette: ['#1e4f92', '#9aafbd', '#d29631', '#171815', '#efe3c5'],
  },
]

const publicDecks: Deck[] = [
  {
    id: 'weathered-bronze',
    title: 'Weathered Bronze',
    category: 'Metal',
    cards: 4,
    paints: 5,
    usedIn: 0,
    image: '/onboarding/first-project-bg.jpeg',
    saved: false,
    accent: '#7a5d37',
  },
  {
    id: 'cracked-earth-bases',
    title: 'Cracked Earth Bases',
    category: 'Basing',
    cards: 5,
    paints: 7,
    usedIn: 0,
    image: '/onboarding/pains/scheme-loss.jpeg',
    saved: false,
    accent: '#d29631',
  },
]

const deckDifficultyOptions: DeckDifficulty[] = [
  'Beginner',
  'Intermediate',
  'Advanced',
]

const deckStatusOptions: DeckStatus[] = ['Draft', 'Private', 'Public']

const cardTemplateOptions: Array<{
  template: CardTemplate
  title: string
  body: string
}> = [
  {
    template: 'title',
    title: 'Title',
    body: 'Opening card with the deck name, promise, and hero reference.',
  },
  {
    template: 'step',
    title: 'Step',
    body: 'Instruction card for one painting move, technique, or stage.',
  },
  {
    template: 'theme',
    title: 'Theme',
    body: 'Palette, mood, army scheme, or color story reference.',
  },
  {
    template: 'image',
    title: 'Image',
    body: 'Reference photo, finished result, or visual checkpoint.',
  },
  {
    template: 'paints',
    title: 'Paints',
    body: 'Deck paints and current ownership status, at a glance.',
  },
  {
    template: 'video',
    title: 'Video',
    body: 'YouTube walkthrough with a short caption.',
  },
]

function makeForgeCard(title: string, index: number): ForgeCard {
  const lowerTitle = title.toLowerCase()
  const template: CardTemplate =
    lowerTitle.includes('palette') || lowerTitle.includes('theme')
      ? 'theme'
      : lowerTitle.includes('image') || lowerTitle.includes('photo')
        ? 'image'
        : lowerTitle.includes('cover') || lowerTitle.includes('title')
          ? 'title'
          : 'step'

  return {
    id: `card-${index}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title,
    template,
    body:
      template === 'title'
        ? 'Introduce the technique and what the finished model should feel like.'
        : template === 'theme'
          ? 'Capture the palette, finish, and visual intent for this deck.'
          : template === 'image'
            ? 'Use this card as a visual checkpoint for comparison.'
            : 'Describe the painting action, timing, and result to check before moving on.',
    image:
      template === 'image'
        ? '/onboarding/pains/paint-management.jpeg'
        : '/onboarding/pains/tough-choices.jpeg',
  }
}

function makeTemplateCard(template: CardTemplate, existingCards: ForgeCard[]): ForgeCard {
  const option = cardTemplateOptions.find((item) => item.template === template)
  const label = option?.title ?? 'Step'
  const occurrence = existingCards.filter((card) => card.template === template).length + 1
  const title = template === 'title' ? `${label} Card` : `${label} ${occurrence}`

  return {
    id: `card-${Date.now()}-${existingCards.length}-${template}`,
    title,
    template,
    body: option?.body ?? 'Add the card notes here.',
    image:
      template === 'image'
        ? '/onboarding/pains/paint-management.jpeg'
        : template === 'theme'
          ? '/onboarding/first-project-bg.jpeg'
          : '/onboarding/pains/tough-choices.jpeg',
  }
}

function makeDeckGallery(seed: string): ForgeDeckImage[] {
  return [
    {
      id: `${seed}-gallery-hero`,
      url: '/onboarding/pains/tough-choices.jpeg',
      alt: 'Main deck reference',
    },
    {
      id: `${seed}-gallery-palette`,
      url: '/onboarding/first-project-bg.jpeg',
      alt: 'Palette reference',
    },
    {
      id: `${seed}-gallery-finish`,
      url: '/onboarding/pains/paint-management.jpeg',
      alt: 'Finished card reference',
    },
  ]
}

function toEditorCard(card: ForgeCard): DeckEditorInitialCard {
  return {
    id: card.id,
    title: card.title,
    template: card.template === 'title' ? 'cover' : card.template,
    body: card.body,
    image: card.image,
    paints: [],
    videoUrl: null,
  }
}

function toEditorCards(deck: ForgeDeck): DeckEditorInitialCard[] {
  const cards = deck.cards.map(toEditorCard)
  if (cards.some((card) => card.template === 'cover')) return cards

  return [
    {
      id: `${deck.id}:cover`,
      title: deck.title,
      template: 'cover',
      body: deck.description,
      image:
        deck.gallery.find((image) => image.id === deck.heroImageId)?.url ??
        deck.gallery[0]?.url ??
        null,
      paints: [],
      videoUrl: null,
    },
    ...cards,
  ]
}

function toEditorDeckDetail(deck: ForgeDeck): GuidesV3DeckDetail {
  const heroImage =
    deck.gallery.find((image) => image.id === deck.heroImageId)?.url ??
    deck.gallery[0]?.url ??
    '/onboarding/pains/tough-choices.jpeg'

  return {
    id: deck.id,
    title: deck.title,
    category: deck.type,
    cards: deck.cards.length,
    paints: 0,
    usedIn: 0,
    image: heroImage,
    saved: true,
    accent: '#22d3ee',
    description: deck.description,
    isPublic: deck.status === 'Public',
    ownerLabel: 'Created by you',
    steps: [],
    paintList: [],
  }
}

const defaultForgeDecks: ForgeDeck[] = [
  {
    id: 'palette-card',
    title: 'Palette Card',
    description: 'A compact color reference for the deck.',
    difficulty: 'Beginner',
    status: 'Draft',
    type: 'Palette',
    cards: ['Palette overview'].map(makeForgeCard),
    gallery: makeDeckGallery('palette-card'),
    heroImageId: 'palette-card-gallery-hero',
    required: true,
  },
  {
    id: 'ancient-bone',
    title: 'Ancient Bone',
    description: 'A reusable sequence for painting aged bone and sepulchral details.',
    difficulty: 'Intermediate',
    status: 'Draft',
    type: 'Steps',
    cards: ['Cover Card', 'Basecoat', 'Shade the bone', 'Drybrush'].map(
      makeForgeCard
    ),
    gallery: makeDeckGallery('ancient-bone'),
    heroImageId: 'ancient-bone-gallery-hero',
    required: true,
  },
  {
    id: 'forgotten-tomb-gold',
    title: 'Forgotten Tomb Gold',
    description: 'Warm metallics with verdigris and final edge shine.',
    difficulty: 'Intermediate',
    status: 'Draft',
    type: 'Steps',
    cards: ['Cover Card', 'Base metal', 'Verdigris wash', 'Final shine'].map(
      makeForgeCard
    ),
    gallery: makeDeckGallery('forgotten-tomb-gold'),
    heroImageId: 'forgotten-tomb-gold-gallery-hero',
    required: true,
  },
  {
    id: 'verdigris-brass-weapons',
    title: 'Verdigris Brass Weapons',
    description: 'A focused corrosion pass for brass weapon details.',
    difficulty: 'Advanced',
    status: 'Private',
    type: 'Steps',
    cards: ['Cover Card', 'Brass base', 'Green oxidation', 'Edge cleanup'].map(
      makeForgeCard
    ),
    gallery: makeDeckGallery('verdigris-brass-weapons'),
    heroImageId: 'verdigris-brass-weapons-gallery-hero',
    required: false,
  },
  {
    id: 'classic-turquoise-armour',
    title: 'Classic Turquoise Armour',
    description: 'Clean turquoise armor panels with crisp shade and highlight notes.',
    difficulty: 'Intermediate',
    status: 'Draft',
    type: 'Steps',
    cards: ['Cover Card', 'Teal base', 'Dark shade', 'Edge highlight'].map(
      makeForgeCard
    ),
    gallery: makeDeckGallery('classic-turquoise-armour'),
    heroImageId: 'classic-turquoise-armour-gallery-hero',
    required: false,
  },
]

type GuidesV3PreviewProps = {
  featureGuides?: FeatureGuideEntry[]
  initialPayload?: GuidesV3Payload
}

export default function GuidesV3Preview({
  featureGuides = [],
  initialPayload,
}: GuidesV3PreviewProps) {
  const seedGuideFiles =
    initialPayload?.guideFiles.length
      ? initialPayload.guideFiles
      : initialGuideFiles
  const seedDecks: Deck[] =
    initialPayload?.decks.length ? initialPayload.decks : initialDecks
  const seedLibraryGuides =
    initialPayload?.libraryGuides.length
      ? initialPayload.libraryGuides
      : publicGuideFiles
  const seedLibraryDecks =
    initialPayload?.libraryDecks.length
      ? initialPayload.libraryDecks
      : publicDecks
  const [activeTab, setActiveTab] = useState<GuideTab>('guides')
  const [guideFiles, setGuideFiles] = useState(seedGuideFiles)
  const [decks, setDecks] = useState<Deck[]>(seedDecks)
  const [query, setQuery] = useState('')
  const [activeGuideIndex, setActiveGuideIndex] = useState<number | null>(null)
  const [isCreateChoiceOpen, setIsCreateChoiceOpen] = useState(false)
  const [forgeMode, setForgeMode] = useState<ForgeMode>('guide')
  const [forgeScreen, setForgeScreen] = useState<ForgeScreen | null>(null)
  const [sourceKind, setSourceKind] = useState<SourceKind>('unit')
  const [selectedUnitId, setSelectedUnitId] = useState(sourceUnits[0].id)
  const [selectedProjectId, setSelectedProjectId] = useState(sourceProjects[0].id)
  const [selectedProjectUnitIds, setSelectedProjectUnitIds] = useState(
    () => new Set(sourceProjects[0].units.map((unit) => unit.id))
  )
  const [selectedPhotoIds, setSelectedPhotoIds] = useState(
    () => new Set(['0', '1', '2'])
  )
  const [selectedPaintIds, setSelectedPaintIds] = useState(
    () => new Set(sourcePaints.slice(0, 4).map((paint) => paint.name))
  )
  const [selectedTemplateId, setSelectedTemplateId] = useState(blankTemplates[0].id)
  const selectedTemplate =
    blankTemplates.find((template) => template.id === selectedTemplateId) ??
    blankTemplates[0]
  const [forgeDecks, setForgeDecks] = useState<ForgeDeck[]>(defaultForgeDecks)
  const [buildTab, setBuildTab] = useState<BuildTab>('details')
  const [editingDeckId, setEditingDeckId] = useState(defaultForgeDecks[1].id)
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [isAddCardOpen, setIsAddCardOpen] = useState(false)
  const [isEditingDeckDetails, setIsEditingDeckDetails] = useState(false)
  const [guideDeckSearch, setGuideDeckSearch] = useState('')
  const [selectedGuideDeckIds, setSelectedGuideDeckIds] = useState(
    () => new Set<string>()
  )
  const [guideName, setGuideName] = useState('')
  const [guideDescription, setGuideDescription] = useState('')
  const [guideImage, setGuideImage] = useState('/onboarding/pains/tough-choices.jpeg')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSavingForge, startSaveTransition] = useTransition()
  const isSavingForgeRef = useRef(false)

  useEffect(() => {
    performance.mark('v3-guides-hydrated')
  }, [])

  const normalizedQuery = query.trim().toLowerCase()
  const filteredLibraryGuides = seedLibraryGuides.filter((guide) =>
    `${guide.title} ${guide.subtitle} ${guide.level}`
      .toLowerCase()
      .includes(normalizedQuery)
  )
  const filteredLibraryDecks = seedLibraryDecks.filter((deck) =>
    `${deck.title} ${deck.category}`.toLowerCase().includes(normalizedQuery)
  )
  const normalizedGuideDeckSearch = guideDeckSearch.trim().toLowerCase()
  const filteredCollectionDecks = decks.filter((deck) =>
    `${deck.title} ${deck.category}`.toLowerCase().includes(normalizedGuideDeckSearch)
  )
  const selectedGuideDecks = Array.from(selectedGuideDeckIds)
    .map((deckId) => decks.find((deck) => deck.id === deckId))
    .filter((deck): deck is Deck => Boolean(deck))
  const selectedUnit =
    sourceUnits.find((unit) => unit.id === selectedUnitId) ?? sourceUnits[0]
  const selectedProject =
    sourceProjects.find((project) => project.id === selectedProjectId) ??
    sourceProjects[0]
  const editingDeck =
    forgeDecks.find((deck) => deck.id === editingDeckId) ?? forgeDecks[0]
  const editingCard =
    editingDeck?.cards.find((card) => card.id === editingCardId) ?? null
  const forgeTitle =
    sourceKind === 'unit'
      ? selectedUnit.title
      : sourceKind === 'project'
        ? selectedProject.title
        : sourceKind === 'photos'
          ? 'Photo Built Guide'
          : sourceKind === 'paints'
            ? 'Paint List Guide'
          : selectedTemplate.name
  const activeGuide =
    activeGuideIndex === null ? null : featureGuides[activeGuideIndex] ?? null
  const shouldUseSharedDeckEditor =
    forgeScreen === 'build' &&
    (forgeMode === 'deck' || sourceKind === 'blank' || sourceKind === 'scratch')

  function openCreateChoice() {
    setActiveGuideIndex(null)
    setIsCreateChoiceOpen(true)
  }

  function startFeatureTour() {
    if (!featureGuides.length) return
    setIsCreateChoiceOpen(false)
    setActiveGuideIndex(findVisibleFeatureGuideIndex(featureGuides, null, 1) ?? 0)
  }

  function closeFeatureTour() {
    setActiveGuideIndex(null)
  }

  function showPreviousGuide() {
    setActiveGuideIndex((current) =>
      findVisibleFeatureGuideIndex(featureGuides, current, -1) ?? current ?? 0
    )
  }

  function showNextGuide() {
    setActiveGuideIndex((current) =>
      findVisibleFeatureGuideIndex(featureGuides, current, 1) ?? current ?? 0
    )
  }

  function startCreate(mode: ForgeMode) {
    setForgeMode(mode)
    setIsCreateChoiceOpen(false)
    if (mode === 'guide') {
      setSourceKind('unit')
      setSelectedGuideDeckIds(new Set())
      setGuideDeckSearch('')
      setGuideName('')
      setGuideDescription('')
      setGuideImage('/onboarding/pains/tough-choices.jpeg')
      setForgeScreen('guide-decks')
      return
    }

    setSourceKind('unit')
    setForgeDecks([defaultForgeDecks[0]])
    setEditingDeckId(defaultForgeDecks[0].id)
    setForgeScreen('source')
  }

  function closeForge() {
    setForgeScreen(null)
    setIsAddCardOpen(false)
    setEditingCardId(null)
    setIsEditingDeckDetails(false)
    setSaveError(null)
    setBuildTab('details')
  }

  function chooseSource(nextSource: Exclude<SourceKind, 'scratch'>) {
    setSourceKind(nextSource)
    setForgeScreen(nextSource)
  }

  function startFromTemplate(template: BlankTemplate) {
    setForgeMode('deck')
    setSourceKind('blank')
    setSelectedTemplateId(template.id)
    const deckId = 'draft-deck-blank'
    const cards: ForgeCard[] = [makeTemplateCard('title', [])]
    template.sequence.forEach((step) => {
      cards.push(makeTemplateCard(step.template, cards))
    })
    const baseDecks: ForgeDeck[] = [
      {
        id: deckId,
        title: template.name,
        description: template.description,
        difficulty: 'Beginner',
        status: 'Draft',
        type: 'Steps',
        cards,
        gallery: makeDeckGallery(deckId),
        heroImageId: `${deckId}-gallery-hero`,
        required: true,
      },
    ]

    setForgeDecks(baseDecks)
    setEditingDeckId(baseDecks[0].id)
    setBuildTab('details')
    setForgeScreen('build')
  }

  function startBlankDeck() {
    setForgeMode('deck')
    setSourceKind('scratch')
    const deckId = 'draft-deck-scratch'
    const baseDecks: ForgeDeck[] = [
      {
        id: deckId,
        title: 'New Deck',
        description: 'A deck built entirely from scratch.',
        difficulty: 'Beginner',
        status: 'Draft',
        type: 'Steps',
        cards: [makeTemplateCard('title', [])],
        gallery: makeDeckGallery(deckId),
        heroImageId: `${deckId}-gallery-hero`,
        required: true,
      },
    ]

    setForgeDecks(baseDecks)
    setEditingDeckId(baseDecks[0].id)
    setBuildTab('details')
    setForgeScreen('build')
  }

  function continueToDraft() {
    setForgeMode('deck')
    const deckTitle =
      sourceKind === 'unit'
        ? `${selectedUnit.title} Deck`
        : sourceKind === 'project'
          ? `${selectedProject.title} Deck`
          : sourceKind === 'photos'
            ? 'Photo Sequence Deck'
            : 'Paint List Deck'
    const cards: ForgeCard[] = [
      'Title Card',
      'Theme Card',
      'Card 01 - Basecoat',
      'Card 02 - Finish',
    ].map(makeForgeCard)
    const baseDecks: ForgeDeck[] = [
      {
        id: `draft-deck-${sourceKind}`,
        title: deckTitle,
        description: `A working deck built from ${sourceKind} source material.`,
        difficulty: 'Intermediate',
        status: 'Draft',
        type: sourceKind === 'photos' ? 'Image + Steps' : 'Steps',
        cards,
        gallery: makeDeckGallery(`draft-deck-${sourceKind}`),
        heroImageId: `draft-deck-${sourceKind}-gallery-hero`,
        required: true,
      },
    ]

    setForgeDecks(baseDecks)
    setEditingDeckId(baseDecks[0].id)
    setForgeScreen('draft')
  }

  function continueToBuild() {
    setBuildTab('details')
    setForgeScreen('build')
  }

  function backFromBuild() {
    if (sourceKind === 'scratch') {
      setForgeScreen('source')
      return
    }
    if (sourceKind === 'blank') {
      setForgeScreen('blank')
      return
    }
    setForgeScreen('draft')
  }

  function resetDeckForge() {
    setForgeDecks([defaultForgeDecks[0]])
    setEditingDeckId(defaultForgeDecks[0].id)
    setSourceKind('unit')
    setSelectedTemplateId(blankTemplates[0].id)
  }

  function saveForgeToHome() {
    if (isSavingForge || isSavingForgeRef.current) return

    if (forgeMode === 'deck') {
      saveDeckEditorPayload({
        title: editingDeck.title,
        description: editingDeck.description,
        difficulty: editingDeck.difficulty,
        status: editingDeck.status,
        heroImage:
          editingDeck.gallery.find((image) => image.id === editingDeck.heroImageId)?.url ??
          editingDeck.gallery[0]?.url ??
          null,
        cards: toEditorCards(editingDeck),
      })
      return
    } else {
      const guideDeckTotal = selectedGuideDecks.length
      const cardTotal = selectedGuideDecks.reduce((sum, deck) => sum + deck.cards, 0)
      setGuideFiles((current) => [
        {
          id: `forge-guide-${Date.now()}`,
          title: guideName.trim() || 'New Guide',
          subtitle:
            guideDescription.trim() ||
            'A custom guide assembled from decks in your collection.',
          image: guideImage,
          decks: guideDeckTotal,
          cards: cardTotal,
          level: 'Draft',
          ownedPercent: 72,
          palette: selectedGuideDecks.length
            ? selectedGuideDecks.slice(0, 5).map((deck) => deck.accent)
            : ['#d8bd83', '#d29631', '#17b9c2', '#7a5d37', '#111417'],
        },
        ...current,
      ])
      setActiveTab('guides')
    }
    closeForge()
  }

  function saveDeckEditorPayload(payload: DeckEditorSavePayload) {
    if (isSavingForge || isSavingForgeRef.current) return

    isSavingForgeRef.current = true
    setSaveError(null)
    startSaveTransition(async () => {
      try {
        const savedDeck = await createDeckFromForge({
          title: payload.title,
          description: payload.description,
          status: payload.status,
          image: payload.heroImage,
          cards: payload.cards.map((card) => ({
            title: card.title,
            template: card.template === 'cover' ? 'title' : card.template,
            body: card.body,
            image: card.image,
            paints: card.paints?.map((paint) => ({
              id: paint.id,
              ratio_text: paint.ratio_text ?? null,
            })),
          })),
        })

        setDecks((current) => [
          savedDeck,
          ...current.filter((deck) => deck.id !== savedDeck.id && !deck.draft),
        ])
        setActiveTab('decks')
        resetDeckForge()
        closeForge()
      } catch (error) {
        setSaveError(
          error instanceof Error ? error.message : 'Could not save deck.'
        )
      } finally {
        isSavingForgeRef.current = false
      }
    })
  }

  function editDraftDeck(deck: Deck) {
    if (!deck.draft) return
    setForgeMode('deck')
    setForgeDecks([deck.draft])
    setEditingDeckId(deck.draft.id)
    setBuildTab('details')
    setForgeScreen('build')
    setActiveTab('decks')
  }

  function addCardToDeck(cardType: CardTemplate) {
    setForgeDecks((current) =>
      current.map((deck) =>
        deck.id === editingDeck.id
          ? {
              ...deck,
              cards: [
                ...deck.cards,
                makeTemplateCard(cardType, deck.cards),
              ],
            }
          : deck
      )
    )
    setIsAddCardOpen(false)
  }

  function updateEditingDeck(patch: Partial<ForgeDeck>) {
    setForgeDecks((current) =>
      current.map((deck) =>
        deck.id === editingDeck.id ? { ...deck, ...patch } : deck
      )
    )
  }

  function updateEditingCard(cardId: string, patch: Partial<ForgeCard>) {
    setForgeDecks((current) =>
      current.map((deck) =>
        deck.id === editingDeck.id
          ? {
              ...deck,
              cards: deck.cards.map((card) =>
                card.id === cardId ? { ...card, ...patch } : card
              ),
            }
          : deck
      )
    )
  }

  function deleteEditingCard(cardId: string) {
    setForgeDecks((current) =>
      current.map((deck) =>
        deck.id === editingDeck.id
          ? {
              ...deck,
              cards: deck.cards.filter((card) => card.id !== cardId),
            }
          : deck
      )
    )
    setEditingCardId(null)
  }

  function reorderEditingCard(cardId: string, targetIndex: number) {
    setForgeDecks((current) =>
      current.map((deck) => {
        if (deck.id !== editingDeck.id) return deck
        const currentIndex = deck.cards.findIndex((card) => card.id === cardId)

        if (
          currentIndex < 0 ||
          targetIndex < 0 ||
          targetIndex > deck.cards.length ||
          currentIndex === targetIndex
        ) {
          return deck
        }

        const cards = [...deck.cards]
        const [movedCard] = cards.splice(currentIndex, 1)
        const adjustedTargetIndex =
          currentIndex < targetIndex ? targetIndex - 1 : targetIndex
        cards.splice(adjustedTargetIndex, 0, movedCard)
        return { ...deck, cards }
      })
    )
  }

  function addDeckToDraft() {
    const nextDeck: ForgeDeck = {
      id: `added-deck-${Date.now()}`,
      title: 'New Optional Deck',
      description: 'A new optional deck section.',
      difficulty: 'Beginner',
      status: 'Draft',
      type: 'Steps',
      cards: ['Title Card'].map(makeForgeCard),
      gallery: makeDeckGallery('added-deck'),
      heroImageId: 'added-deck-gallery-hero',
      required: false,
    }
    setForgeDecks((current) => [...current, nextDeck])
    setEditingDeckId(nextDeck.id)
  }

  function toggleGuideDeck(deckId: string) {
    setSelectedGuideDeckIds((current) => {
      const next = new Set(current)
      if (next.has(deckId)) {
        next.delete(deckId)
      } else {
        next.add(deckId)
      }
      return next
    })
  }

  function moveGuideDeck(deckId: string, direction: -1 | 1) {
    const currentIndex = selectedGuideDecks.findIndex((deck) => deck.id === deckId)
    const nextIndex = currentIndex + direction
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= selectedGuideDecks.length) {
      return
    }

    const reordered = [...selectedGuideDecks]
    const [movedDeck] = reordered.splice(currentIndex, 1)
    reordered.splice(nextIndex, 0, movedDeck)
    setSelectedGuideDeckIds(new Set(reordered.map((deck) => deck.id)))
  }

  function continueToGuideCompose() {
    const firstDeck = selectedGuideDecks[0]
    setGuideName(firstDeck ? `${firstDeck.title} Guide` : 'New Guide')
    setGuideDescription(
      firstDeck
        ? `A custom guide built from ${selectedGuideDecks.length} saved decks.`
        : ''
    )
    setGuideImage(firstDeck?.image ?? '/onboarding/pains/tough-choices.jpeg')
    setForgeScreen('guide-compose')
  }

  if (forgeScreen) {
    return (
      <ForgeShell
        onBack={() => {
          if (forgeScreen === 'guide-decks') closeForge()
          else if (forgeScreen === 'guide-compose') setForgeScreen('guide-decks')
          else if (forgeScreen === 'source') closeForge()
          else if (forgeScreen === 'draft') {
            setForgeScreen(sourceKind === 'scratch' ? 'source' : sourceKind)
          } else if (forgeScreen === 'build') {
            backFromBuild()
          } else if (forgeScreen === 'deck-editor') {
            setForgeScreen('build')
          } else setForgeScreen('source')
        }}
        onClose={closeForge}
        title={getForgeScreenTitle(forgeScreen, forgeMode)}
      >
        <V3PerfIndicator surface="guide-forge" detail={forgeScreen} />
        {forgeScreen === 'guide-decks' ? (
          <GuideDeckPickerScreen
            decks={filteredCollectionDecks}
            query={guideDeckSearch}
            selectedDeckIds={selectedGuideDeckIds}
            selectedDecks={selectedGuideDecks}
            onContinue={continueToGuideCompose}
            onQueryChange={setGuideDeckSearch}
            onToggleDeck={toggleGuideDeck}
          />
        ) : null}
        {forgeScreen === 'guide-compose' ? (
          <GuideComposeScreen
            description={guideDescription}
            image={guideImage}
            name={guideName}
            selectedDecks={selectedGuideDecks}
            onDescriptionChange={setGuideDescription}
            onImageChange={setGuideImage}
            onMoveDeck={moveGuideDeck}
            onNameChange={setGuideName}
            onSave={saveForgeToHome}
          />
        ) : null}
        {forgeScreen === 'source' ? (
          <SourcePicker
            onChooseSource={(source) => {
              if (source === 'scratch') {
                startBlankDeck()
                return
              }
              chooseSource(source)
            }}
          />
        ) : null}
        {forgeScreen === 'unit' ? (
          <UnitSourceScreen
            selectedUnitId={selectedUnitId}
            onSelectUnit={setSelectedUnitId}
            onContinue={continueToDraft}
          />
        ) : null}
        {forgeScreen === 'project' ? (
          <ProjectSourceScreen
            selectedProject={selectedProject}
            selectedProjectId={selectedProjectId}
            selectedProjectUnitIds={selectedProjectUnitIds}
            onProjectChange={(projectId) => {
              const project =
                sourceProjects.find((item) => item.id === projectId) ??
                sourceProjects[0]
              setSelectedProjectId(project.id)
              setSelectedProjectUnitIds(new Set(project.units.map((unit) => unit.id)))
            }}
            onUnitToggle={(unitId) => {
              setSelectedProjectUnitIds((current) => {
                const next = new Set(current)
                if (next.has(unitId)) next.delete(unitId)
                else next.add(unitId)
                return next
              })
            }}
            onContinue={continueToDraft}
          />
        ) : null}
        {forgeScreen === 'photos' ? (
          <PhotoSourceScreen
            selectedPhotoIds={selectedPhotoIds}
            onPhotoToggle={(photoId) => {
              setSelectedPhotoIds((current) => {
                const next = new Set(current)
                if (next.has(photoId)) next.delete(photoId)
                else next.add(photoId)
                return next
              })
            }}
            onContinue={continueToDraft}
          />
        ) : null}
        {forgeScreen === 'paints' ? (
          <PaintSourceScreen
            selectedPaintIds={selectedPaintIds}
            onPaintToggle={(paintId) => {
              setSelectedPaintIds((current) => {
                const next = new Set(current)
                if (next.has(paintId)) next.delete(paintId)
                else next.add(paintId)
                return next
              })
            }}
            onContinue={continueToDraft}
          />
        ) : null}
        {forgeScreen === 'blank' ? (
          <BlankSourceScreen onSelectTemplate={startFromTemplate} />
        ) : null}
        {forgeScreen === 'draft' ? (
          <DraftReviewScreen
            decks={forgeDecks}
            title={editingDeck?.title ?? forgeTitle}
            onAddDeck={addDeckToDraft}
            onContinue={continueToBuild}
          />
        ) : null}
        {shouldUseSharedDeckEditor ? (
          <DeckEditorClient
            key={editingDeck.id}
            backHref="/guides?preview=1"
            deck={toEditorDeckDetail(editingDeck)}
            featureGuides={featureGuides}
            initialCards={toEditorCards(editingDeck)}
            isSaving={isSavingForge}
            onBack={backFromBuild}
            onSaveDraft={saveDeckEditorPayload}
            saveError={saveError}
            saveLabel="Save"
          />
        ) : null}
        {forgeScreen === 'build' && !shouldUseSharedDeckEditor ? (
          <GuideBuildScreen
            buildTab={buildTab}
            deck={editingDeck}
            isEditingDetails={isEditingDeckDetails}
            onAddCard={() => setIsAddCardOpen(true)}
            onBack={backFromBuild}
            onBuildTabChange={setBuildTab}
            onCardEdit={setEditingCardId}
            onDetailsEditToggle={() =>
              setIsEditingDeckDetails((current) => !current)
            }
            onHelp={startFeatureTour}
            isSaving={isSavingForge}
            onReorderCard={reorderEditingCard}
            onSave={saveForgeToHome}
            onUpdateDeck={updateEditingDeck}
            saveError={saveError}
          />
        ) : null}
        {forgeScreen === 'deck-editor' ? (
          <DeckEditorScreen
            deck={editingDeck}
            forgeMode={forgeMode}
            onAddCard={() => setIsAddCardOpen(true)}
            onCardEdit={setEditingCardId}
            isSaving={isSavingForge}
            onReorderCard={reorderEditingCard}
            onSave={saveForgeToHome}
            saveError={saveError}
          />
        ) : null}

        {isAddCardOpen ? (
          <AddCardSheet
            onClose={() => setIsAddCardOpen(false)}
            onAddCard={addCardToDeck}
          />
        ) : null}
        {editingCard ? (
          <EditCardSheet
            card={editingCard}
            onChange={(patch) => updateEditingCard(editingCard.id, patch)}
            onClose={() => setEditingCardId(null)}
            onDelete={() => deleteEditingCard(editingCard.id)}
          />
        ) : null}
      </ForgeShell>
    )
  }

  return (
    <main
      className={styles.guidesSilver}
      data-v3-guides-indicator="root"
      data-v3-guides-source={initialPayload ? 'live' : 'fallback'}
    >
      <V3PerfIndicator surface="guides" detail={activeTab} />
      <div
        className="mx-auto flex w-full max-w-md flex-col gap-3 px-3 pb-28 pt-6"
        data-v3-guides-indicator="content"
      >
        <TopNav
          isHelpOpen={activeGuide !== null}
          onCreate={openCreateChoice}
          onHelpToggle={startFeatureTour}
        />

        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'guides' ? <GuidesTab guideFiles={guideFiles} /> : null}
        {activeTab === 'decks' ? (
          <DecksTab
            decks={decks}
            onAddDeck={openCreateChoice}
            onEditDraftDeck={editDraftDeck}
          />
        ) : null}
        {activeTab === 'library' ? (
          <LibraryTab
            query={query}
            onQueryChange={setQuery}
            guides={filteredLibraryGuides}
            decks={filteredLibraryDecks}
          />
        ) : null}
      </div>

      {isCreateChoiceOpen ? (
        <CreateChoiceSheet
          onClose={() => setIsCreateChoiceOpen(false)}
          onStartCreate={startCreate}
        />
      ) : null}

      {activeGuide !== null && activeGuideIndex !== null ? (
        <FeatureGuideTour
          activeIndex={activeGuideIndex}
          guide={activeGuide}
          guides={featureGuides}
          onClose={closeFeatureTour}
          onNext={showNextGuide}
          onPrevious={showPreviousGuide}
          totalGuides={featureGuides.length}
        />
      ) : null}
    </main>
  )
}

function getForgeScreenTitle(screen: ForgeScreen, mode: ForgeMode) {
  if (screen === 'guide-decks') return 'Create Guide'
  if (screen === 'guide-compose') return 'Guide Details'
  if (screen === 'source') return 'Create Deck'
  if (screen === 'unit') return 'Choose Source Unit'
  if (screen === 'project') return 'Choose Source Project'
  if (screen === 'photos') return 'Build From Photos'
  if (screen === 'paints') return 'Build From Paints'
  if (screen === 'blank') return 'Choose a Template'
  if (screen === 'draft') return 'Deck Draft'
  if (screen === 'build') return 'Deck Details'
  return mode === 'deck' ? 'Edit Deck' : 'Deck Editor'
}

function TopNav({
  isHelpOpen,
  onCreate,
  onHelpToggle,
}: {
  isHelpOpen: boolean
  onCreate: () => void
  onHelpToggle: () => void
}) {
  return (
    <header data-v3-guides-indicator="app-header">
      <AppHamburgerMenu
        data-v3-guides-indicator="menu-control"
        aria-label="Open guides menu"
      />

      <h1
        data-v3-guides-indicator="app-title"
        data-feature-guide-target="guides.page"
      >
        Guides
      </h1>

      <div data-v3-guides-indicator="app-header-actions">
        <button
          type="button"
          aria-expanded={isHelpOpen}
          aria-controls="guides-help"
          aria-label="About guides"
          onClick={onHelpToggle}
          data-feature-guide-target="guides.help"
          data-feature-guide-launcher-button="true"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
            <path d="M9.6 9a2.6 2.6 0 0 1 4.95 1.15c0 1.75-1.55 2.25-2.25 3.3-.22.33-.3.68-.3 1.05" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
            <path d="M12 18h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.6" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Create guide or deck"
          onClick={onCreate}
          data-feature-guide-target="guides.create_button"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
          </svg>
        </button>
      </div>
    </header>
  )
}

function ForgeShell({
  children,
  onBack,
  onClose,
  title,
}: {
  children: ReactNode
  onBack: () => void
  onClose: () => void
  title: string
}) {
  return (
    <main
      className={styles.guidesSilver}
      data-v3-guides-indicator="forge-root"
    >
      <div
        className="mx-auto flex w-full max-w-md flex-col gap-4 px-3 pb-28 pt-7"
        data-v3-guides-indicator="forge-content"
      >
        <header
          className="flex items-center justify-between gap-3"
          data-v3-guides-indicator="forge-header"
        >
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-white/70"
          >
            &lt;
          </button>
          <h1 className="min-w-0 flex-1 truncate text-center text-xl font-black">
            {title}
          </h1>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close forge"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-white/70"
          >
            x
          </button>
        </header>
        {children}
      </div>
    </main>
  )
}

function GuideDeckPickerScreen({
  decks,
  onContinue,
  onQueryChange,
  onToggleDeck,
  query,
  selectedDeckIds,
  selectedDecks,
}: {
  decks: Deck[]
  onContinue: () => void
  onQueryChange: (query: string) => void
  onToggleDeck: (deckId: string) => void
  query: string
  selectedDeckIds: Set<string>
  selectedDecks: Deck[]
}) {
  return (
    <section className="grid gap-4">
      <section className="rounded-[10px] border border-white/10 bg-[#111821] p-4">
        <p className="text-sm font-black text-white">Add decks from your collection</p>
        <p className="mt-2 text-xs font-semibold leading-5 text-white/45">
          Guides are folders for decks. Search your saved deck library, add the
          pieces you want, then order and name the guide.
        </p>
      </section>

      <SearchInput
        placeholder="Search your decks..."
        value={query}
        onChange={onQueryChange}
      />

      <section className="overflow-hidden rounded-[10px] border border-white/10 bg-[#111821]">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/28">
            Deck Collection
          </h2>
          <span className="text-[10px] font-black text-cyan-300">
            {selectedDecks.length} selected
          </span>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {decks.map((deck) => (
            <GuideDeckSelectRow
              key={deck.id}
              deck={deck}
              selected={selectedDeckIds.has(deck.id)}
              onToggle={() => onToggleDeck(deck.id)}
            />
          ))}
        </div>
      </section>

      {selectedDecks.length ? (
        <section className="rounded-[10px] border border-cyan-300/18 bg-cyan-300/8 p-3">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
            Current Guide
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedDecks.map((deck) => (
              <button
                key={deck.id}
                type="button"
                onClick={() => onToggleDeck(deck.id)}
                className="rounded-full border border-cyan-300/25 bg-black/20 px-3 py-1.5 text-[10px] font-black text-white/72"
              >
                {deck.title} x
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={onContinue}
        disabled={!selectedDecks.length}
        className={[
          'tap-press h-12 rounded-[10px] text-sm font-black transition',
          selectedDecks.length
            ? 'bg-cyan-300 text-black shadow-[0_0_24px_rgba(34,211,238,0.22)] hover:bg-cyan-200'
            : 'bg-white/[0.08] text-white/28',
        ].join(' ')}
      >
        Continue to Guide Details
      </button>
    </section>
  )
}

function GuideDeckSelectRow({
  deck,
  onToggle,
  selected,
}: {
  deck: Deck
  onToggle: () => void
  selected: boolean
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="grid w-full grid-cols-[52px_1fr_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.035]"
    >
      <span className="relative h-12 w-12 overflow-hidden rounded-[8px] bg-black">
        <Image src={deck.image} alt="" fill sizes="48px" className="object-cover" />
        <span
          className="absolute inset-x-0 bottom-0 h-1"
          style={{ backgroundColor: deck.accent }}
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-white">
          {deck.title}
        </span>
        <span className="mt-1 block text-[10px] font-semibold text-white/38">
          {deck.category} - {deck.cards} cards - {deck.paints} paints
        </span>
      </span>
      <span
        className={[
          'grid h-8 w-8 place-items-center rounded-full border text-sm font-black',
          selected
            ? 'border-cyan-300 bg-cyan-300 text-black'
            : 'border-white/14 bg-white/[0.04] text-white/42',
        ].join(' ')}
      >
        {selected ? <CheckIcon /> : '+'}
      </span>
    </button>
  )
}

function GuideComposeScreen({
  description,
  image,
  name,
  onDescriptionChange,
  onImageChange,
  onMoveDeck,
  onNameChange,
  onSave,
  selectedDecks,
}: {
  description: string
  image: string
  name: string
  onDescriptionChange: (description: string) => void
  onImageChange: (image: string) => void
  onMoveDeck: (deckId: string, direction: -1 | 1) => void
  onNameChange: (name: string) => void
  onSave: () => void
  selectedDecks: Deck[]
}) {
  const cardTotal = selectedDecks.reduce((sum, deck) => sum + deck.cards, 0)

  return (
    <section className="grid gap-4">
      <section className="overflow-hidden rounded-[12px] border border-white/10 bg-[#111821]">
        <div className="relative h-40 bg-black">
          <Image
            src={image}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 448px"
            className="object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/82" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
              Guide Draft
            </p>
            <h2 className="mt-1 line-clamp-2 text-2xl font-black">
              {name || 'New Guide'}
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 p-3 text-center text-[10px] font-black text-white/38">
          <span>{selectedDecks.length} decks</span>
          <span>{cardTotal} cards</span>
          <span>Draft</span>
        </div>
      </section>

      <section className="grid gap-3 rounded-[10px] border border-white/10 bg-[#111821] p-4">
        <label className="grid gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/28">
            Guide Name
          </span>
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            className="h-11 rounded-[8px] border border-white/10 bg-white/[0.04] px-3 text-sm font-black text-white outline-none focus:border-cyan-300/60"
          />
        </label>
        <label className="grid gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/28">
            Description
          </span>
          <textarea
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            rows={3}
            className="resize-none rounded-[8px] border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold leading-5 text-white outline-none focus:border-cyan-300/60"
          />
        </label>
      </section>

      <section className="rounded-[10px] border border-white/10 bg-[#111821] p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/28">
            Cover Image
          </h3>
          <span className="text-[10px] font-black text-white/32">
            From selected decks
          </span>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {selectedDecks.map((deck) => (
            <button
              key={deck.id}
              type="button"
              onClick={() => onImageChange(deck.image)}
              className={[
                'relative aspect-square overflow-hidden rounded-[8px] border bg-black',
                image === deck.image ? 'border-cyan-300' : 'border-white/10',
              ].join(' ')}
            >
              <Image src={deck.image} alt="" fill sizes="25vw" className="object-cover" />
            </button>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[10px] border border-white/10 bg-[#111821]">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/28">
            Deck Order
          </h3>
          <span className="text-[10px] font-black text-cyan-300">
            Top to bottom
          </span>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {selectedDecks.map((deck, index) => (
            <div
              key={deck.id}
              className="grid grid-cols-[auto_48px_1fr_auto] items-center gap-3 px-4 py-3"
            >
              <span className="text-[10px] font-black text-white/26">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="relative h-12 w-12 overflow-hidden rounded-[8px] bg-black">
                <Image src={deck.image} alt="" fill sizes="48px" className="object-cover" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">
                  {deck.title}
                </span>
                <span className="mt-1 block text-[10px] font-semibold text-white/36">
                  {deck.cards} cards
                </span>
              </span>
              <span className="grid grid-cols-2 overflow-hidden rounded-full border border-white/10">
                <button
                  type="button"
                  onClick={() => onMoveDeck(deck.id, -1)}
                  disabled={index === 0}
                  className="grid h-8 w-8 place-items-center text-xs font-black text-white/54 disabled:text-white/16"
                >
                  up
                </button>
                <button
                  type="button"
                  onClick={() => onMoveDeck(deck.id, 1)}
                  disabled={index === selectedDecks.length - 1}
                  className="grid h-8 w-8 place-items-center border-l border-white/10 text-xs font-black text-white/54 disabled:text-white/16"
                >
                  dn
                </button>
              </span>
            </div>
          ))}
        </div>
      </section>

      <PrimaryButton onClick={onSave}>Save Guide Draft</PrimaryButton>
    </section>
  )
}

function CreateChoiceSheet({
  onClose,
  onStartCreate,
}: {
  onClose: () => void
  onStartCreate: (mode: ForgeMode) => void
}) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-end bg-black/65 px-3 py-4 backdrop-blur-sm">
      <section
        className="w-full max-w-md rounded-[14px] border border-white/10 bg-[#10161d] p-4 shadow-2xl shadow-black/50"
        data-v3-guides-indicator="create-choice-sheet"
      >
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-white/58"
            aria-label="Close create"
          >
            x
          </button>
          <h2 className="text-xl font-black">Create New</h2>
          <span className="h-9 w-9" />
        </div>
        <div className="grid gap-3">
          <ChoiceCard
            title="Create Deck"
            body="Build a reusable deck of cards."
            image="/onboarding/pains/paint-management.jpeg"
            onClick={() => onStartCreate('deck')}
          />
          <ChoiceCard
            title="Create Guide"
            body="Collect decks into a complete guide."
            image="/onboarding/pains/tough-choices.jpeg"
            onClick={() => onStartCreate('guide')}
          />
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-[10px] border border-white/10 bg-white/[0.04] text-sm font-black text-white/58"
          >
            Cancel
          </button>
        </div>
      </section>
    </div>
  )
}

function ChoiceCard({
  body,
  image,
  onClick,
  title,
}: {
  body: string
  image: string
  onClick: () => void
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-v3-guides-indicator="choice-card"
      className="grid grid-cols-[72px_1fr_auto] items-center gap-3 rounded-[10px] border border-white/10 bg-white/[0.04] p-3 text-left transition hover:border-cyan-300/45"
    >
      <span className="relative h-16 overflow-hidden rounded-[8px] bg-black">
        <Image src={image} alt="" fill sizes="72px" className="object-cover" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-black text-white">{title}</span>
        <span className="mt-1 block text-xs font-semibold text-white/45">
          {body}
        </span>
      </span>
      <span className="text-white/40">&gt;</span>
    </button>
  )
}

const sourceChoices: {
  id: SourceKind
  title: string
  body: string
  disabled?: boolean
}[] = [
  {
    id: 'blank',
    title: 'From Template',
    body: 'Start from a proven card structure.',
  },
  {
    id: 'unit',
    title: 'From Unit',
    body: 'Turn a completed unit into a reusable deck.',
    disabled: true,
  },
  {
    id: 'project',
    title: 'From Project',
    body: 'Build a deck from units and shared palette.',
    disabled: true,
  },
  {
    id: 'photos',
    title: 'From Photos',
    body: 'Upload progress photos and let the app arrange them.',
    disabled: true,
  },
  {
    id: 'paints',
    title: 'From Paint List',
    body: 'Start with paints and build steps around them.',
    disabled: true,
  },
  {
    id: 'scratch',
    title: 'From Blank',
    body: 'Start with an empty deck and build everything yourself.',
  },
]

function SourcePicker({
  onChooseSource,
}: {
  onChooseSource: (source: SourceKind) => void
}) {
  return (
    <section className="grid gap-3">
      <p className="text-sm font-semibold leading-6 text-white/48">
        Start a deck from existing data or begin from scratch.
      </p>
      {sourceChoices.map(({ id, title, body, disabled }) => (
        <button
          key={id}
          type="button"
          disabled={disabled}
          aria-disabled={disabled}
          onClick={() => {
            if (disabled) return
            onChooseSource(id)
          }}
          data-v3-guides-indicator="source-choice-card"
          className={[
            'flex items-center gap-3 rounded-[10px] border p-3 text-left transition',
            disabled
              ? 'cursor-not-allowed border-white/5 bg-[#111821]/50 opacity-45'
              : 'border-white/10 bg-[#111821] hover:border-cyan-300/45',
          ].join(' ')}
        >
          <span
            className={[
              'grid h-14 w-14 shrink-0 place-items-center rounded-[8px] text-xl font-black',
              disabled ? 'bg-white/5 text-white/30' : 'bg-cyan-300/10 text-cyan-300',
            ].join(' ')}
          >
            {title.slice(5, 6)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="block text-sm font-black text-white">{title}</span>
              {disabled ? (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-white/45">
                  Soon
                </span>
              ) : null}
            </span>
            <span className="mt-1 block text-xs font-semibold leading-5 text-white/45">
              {body}
            </span>
          </span>
          {disabled ? null : <span className="text-white/36">&gt;</span>}
        </button>
      ))}
    </section>
  )
}

function UnitSourceScreen({
  onContinue,
  onSelectUnit,
  selectedUnitId,
}: {
  onContinue: () => void
  onSelectUnit: (id: string) => void
  selectedUnitId: string
}) {
  return (
    <section className="grid gap-4">
      <SearchInput placeholder="Search units..." />
      <div className="grid gap-2">
        {sourceUnits.map((unit) => (
          <SelectableMediaRow
            key={unit.id}
            image={unit.image}
            meta={unit.meta}
            selected={unit.id === selectedUnitId}
            title={unit.title}
            onClick={() => onSelectUnit(unit.id)}
          />
        ))}
      </div>
      <PrimaryButton onClick={onContinue}>Build Deck from Unit</PrimaryButton>
    </section>
  )
}

function ProjectSourceScreen({
  onContinue,
  onProjectChange,
  onUnitToggle,
  selectedProject,
  selectedProjectId,
  selectedProjectUnitIds,
}: {
  onContinue: () => void
  onProjectChange: (id: string) => void
  onUnitToggle: (id: string) => void
  selectedProject: SourceProject
  selectedProjectId: string
  selectedProjectUnitIds: Set<string>
}) {
  return (
    <section className="grid gap-4">
      <SearchInput placeholder="Search projects..." />
      <div className="grid gap-2">
        {sourceProjects.map((project) => (
          <SelectableMediaRow
            key={project.id}
            image={project.image}
            meta={project.meta}
            selected={project.id === selectedProjectId}
            title={project.title}
            onClick={() => onProjectChange(project.id)}
          />
        ))}
      </div>
      <section className="rounded-[10px] border border-white/10 bg-[#111821] p-3">
        <p className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/28">
          Select units to include
        </p>
        <div className="grid gap-2">
          {selectedProject.units.map((unit) => (
            <button
              key={unit.id}
              type="button"
              onClick={() => onUnitToggle(unit.id)}
              className="flex items-center gap-3 rounded-[8px] bg-white/[0.04] p-2 text-left"
            >
              <span
                className={[
                  'grid h-6 w-6 place-items-center rounded-[6px] border text-xs font-black',
                  selectedProjectUnitIds.has(unit.id)
                    ? 'border-cyan-300 bg-cyan-300 text-black'
                    : 'border-white/16 text-transparent',
                ].join(' ')}
              >
                <CheckIcon />
              </span>
              <span className="relative h-10 w-10 overflow-hidden rounded-[6px] bg-black">
                <Image src={unit.image} alt="" fill sizes="40px" className="object-cover" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black">{unit.title}</span>
                <span className="block text-[10px] font-semibold text-white/38">
                  {unit.meta}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
      <PrimaryButton onClick={onContinue}>Build Deck from Project</PrimaryButton>
    </section>
  )
}

function PhotoSourceScreen({
  onContinue,
  onPhotoToggle,
  selectedPhotoIds,
}: {
  onContinue: () => void
  onPhotoToggle: (id: string) => void
  selectedPhotoIds: Set<string>
}) {
  return (
    <section className="grid gap-4">
      <p className="text-sm font-semibold text-white/48">
        Select and order your progress photos.
      </p>
      <div className="grid grid-cols-3 gap-3">
        {sourcePhotos.map((photo, index) => {
          const id = String(index)
          const selected = selectedPhotoIds.has(id)
          return (
            <button
              key={photo}
              type="button"
              onClick={() => onPhotoToggle(id)}
              className={[
                'relative aspect-[0.78] overflow-hidden rounded-[8px] border bg-black',
                selected ? 'border-cyan-300' : 'border-white/10',
              ].join(' ')}
            >
              <Image src={photo} alt="" fill sizes="33vw" className="object-cover" />
              <span className="absolute bottom-2 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full bg-black/70 text-xs font-black">
                {index + 1}
              </span>
            </button>
          )
        })}
      </div>
      <InfoBox>
        Selected photos can become cover cards, step cards, image cards, or
        palette cards.
      </InfoBox>
      <PrimaryButton onClick={onContinue}>Use Selected Photos</PrimaryButton>
    </section>
  )
}

function PaintSourceScreen({
  onContinue,
  onPaintToggle,
  selectedPaintIds,
}: {
  onContinue: () => void
  onPaintToggle: (id: string) => void
  selectedPaintIds: Set<string>
}) {
  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {['Bone', 'Armour', 'Metal', 'Cloth', 'Base', 'Other'].map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-cyan-300/20 bg-cyan-300/8 px-3 py-1 text-[10px] font-black text-cyan-300"
          >
            {tag}
          </span>
        ))}
      </div>
      <div className="grid gap-2 rounded-[10px] border border-white/10 bg-[#111821] p-3">
        {sourcePaints.map((paint) => (
          <button
            key={paint.name}
            type="button"
            onClick={() => onPaintToggle(paint.name)}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[8px] bg-white/[0.04] p-2 text-left"
          >
            <span
              className="h-8 w-8 rounded-full border border-white/10"
              style={{ backgroundColor: paint.color }}
            />
            <span>
              <span className="block text-sm font-black">{paint.name}</span>
              <span className="block text-[10px] font-semibold text-white/38">
                {paint.brand}
              </span>
            </span>
            <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-black text-white/44">
              {selectedPaintIds.has(paint.name) ? 'Selected' : paint.type}
            </span>
          </button>
        ))}
      </div>
      <PrimaryButton onClick={onContinue}>Build Deck from Paints</PrimaryButton>
    </section>
  )
}

function BlankSourceScreen({
  onSelectTemplate,
}: {
  onSelectTemplate: (template: BlankTemplate) => void
}) {
  return (
    <section className="grid gap-4">
      <p className="text-sm font-semibold text-white/48">
        Choose a template to get started.
      </p>
      <div className="grid gap-3">
        {blankTemplates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelectTemplate(template)}
            data-v3-guides-indicator="template-choice-card"
            className="block w-full text-left transition"
          >
            <span
              className="block"
              data-v3-guides-indicator="template-choice-title"
            >
              {template.name}
            </span>
            <span
              className="mt-1 block"
              data-v3-guides-indicator="template-choice-description"
            >
              {template.description}
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function DraftReviewScreen({
  decks,
  onAddDeck,
  onContinue,
  title,
}: {
  decks: ForgeDeck[]
  onAddDeck: () => void
  onContinue: () => void
  title: string
}) {
  return (
    <section className="grid gap-4">
      <section className="rounded-[10px] border border-white/10 bg-[#111821] p-4">
        <p className="text-sm font-black">{title}</p>
        <p className="mt-1 text-xs font-semibold text-white/42">
          Suggested card structure from your source data.
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[10px] font-black text-white/40">
          <span>{decks.length} Draft</span>
          <span>{decks.reduce((sum, deck) => sum + deck.cards.length, 0)} Cards</span>
          <span>12 Paints</span>
          <span>8 Images</span>
        </div>
      </section>

      <section className="rounded-[10px] border border-white/10 bg-[#111821]">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/28">
            Draft Deck
          </h2>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {decks.map((deck) => (
            <ForgeDeckRow key={deck.id} deck={deck} />
          ))}
        </div>
        <button
          type="button"
          onClick={onAddDeck}
          className="h-11 w-full border-t border-white/[0.06] text-sm font-black text-cyan-300"
        >
          + Add Deck
        </button>
      </section>
      <PrimaryButton onClick={onContinue}>Continue to Deck</PrimaryButton>
    </section>
  )
}

function GuideBuildScreen({
  buildTab,
  deck,
  isEditingDetails,
  onAddCard,
  onBack,
  onBuildTabChange,
  onCardEdit,
  onDetailsEditToggle,
  onHelp,
  isSaving,
  onReorderCard,
  onSave,
  onUpdateDeck,
  saveError,
}: {
  buildTab: BuildTab
  deck: ForgeDeck
  isEditingDetails: boolean
  isSaving: boolean
  onAddCard: () => void
  onBack: () => void
  onBuildTabChange: (tab: BuildTab) => void
  onCardEdit: (cardId: string) => void
  onDetailsEditToggle: () => void
  onHelp: () => void
  onReorderCard: (cardId: string, targetIndex: number) => void
  onSave: () => void
  onUpdateDeck: (patch: Partial<ForgeDeck>) => void
  saveError: string | null
}) {
  const heroImage =
    deck.gallery.find((image) => image.id === deck.heroImageId) ?? deck.gallery[0]

  return (
    <section className="grid gap-4" data-v3-guides-indicator="deck-editor-page">
      <DeckEditorHero
        cardCount={deck.cards.length}
        deck={deck}
        heroImage={heroImage}
        onBack={onBack}
        onHelp={onHelp}
        isSaving={isSaving}
        onSave={onSave}
      />
      <div
        className="grid grid-cols-3 rounded-[8px] bg-white/[0.055] p-0.5"
        role="tablist"
        aria-label="Deck editor sections"
      >
        {(['details', 'cards', 'preview'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={buildTab === tab}
            onClick={() => onBuildTabChange(tab)}
            className={[
              'h-9 rounded-[6px] text-xs font-black capitalize',
              buildTab === tab ? 'bg-[#101822] text-cyan-300' : 'text-white/38',
            ].join(' ')}
          >
            {tab}
          </button>
        ))}
      </div>
      {buildTab === 'details' ? (
        <div className="grid gap-4">
          <DeckDetailsPanel
            deck={deck}
            isEditingDetails={isEditingDetails}
            onDetailsEditToggle={onDetailsEditToggle}
            onUpdateDeck={onUpdateDeck}
          />
          <DeckGalleryPanel
            deck={deck}
            onSetHero={(heroImageId) => onUpdateDeck({ heroImageId })}
          />
        </div>
      ) : null}
      {buildTab === 'cards' ? (
        <section className="rounded-[10px] border border-white/10 bg-[#111821]">
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/28">
              Cards ({deck.cards.length})
            </h3>
            <button
              type="button"
              onClick={onAddCard}
              data-v3-guides-indicator="editor-action"
              className="inline-flex h-8 items-center rounded-[6px] px-3 text-[10px] font-black"
            >
              + Add Card
            </button>
          </div>
          <CardOrderList
            cards={deck.cards}
            onCardEdit={onCardEdit}
            onReorderCard={onReorderCard}
          />
        </section>
      ) : null}
      {buildTab === 'preview' ? (
        <DeckPreview deck={deck} />
      ) : null}
      {saveError ? (
        <p className="rounded-[8px] border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100">
          {saveError}
        </p>
      ) : null}
    </section>
  )
}

function DeckEditorHero({
  cardCount,
  deck,
  heroImage,
  isSaving,
  onBack,
  onHelp,
  onSave,
}: {
  cardCount: number
  deck: ForgeDeck
  heroImage: ForgeDeckImage | undefined
  isSaving: boolean
  onBack: () => void
  onHelp: () => void
  onSave: () => void
}) {
  return (
    <section
      className="overflow-hidden rounded-[12px] border border-white/10 bg-[#111821]"
      data-v3-guides-indicator="deck-editor-hero"
    >
      <div className="relative h-56 bg-black">
        {heroImage ? (
          <Image
            src={heroImage.url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 448px"
            className="object-cover"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/68 to-black/16" />

        <div className="absolute left-3 top-3 z-10 flex gap-2">
          <button
            type="button"
            onClick={onBack}
            data-v3-guides-indicator="hero-icon-action"
            className="grid h-10 w-10 place-items-center rounded-full"
            aria-label="Back"
          >
            &lt;
          </button>
          <button
            type="button"
            onClick={onHelp}
            data-v3-guides-indicator="hero-icon-action"
            className="grid h-10 w-10 place-items-center rounded-full"
            aria-label="Show deck editor help"
          >
            ?
          </button>
        </div>

        <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
          <button
            type="button"
            data-v3-guides-indicator="hero-icon-action"
            className="grid h-10 w-10 place-items-center rounded-full"
            aria-label="Save deck to favorites"
          >
            <HeartIcon />
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            data-v3-guides-indicator="editor-action"
            className="inline-flex h-10 items-center rounded-[6px] px-3 text-xs font-black disabled:cursor-wait disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 p-5">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-white/62">
            Deck
          </p>
          <h2 className="mt-1 text-3xl font-black leading-tight text-white">
            {deck.title}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black text-white/68">
            <span data-v3-guides-indicator="hero-counter">Saved by 0</span>
            <span data-v3-guides-indicator="hero-counter">{cardCount} cards</span>
          </div>
        </div>
      </div>
    </section>
  )
}

function DeckDetailsPanel({
  deck,
  isEditingDetails,
  onDetailsEditToggle,
  onUpdateDeck,
}: {
  deck: ForgeDeck
  isEditingDetails: boolean
  onDetailsEditToggle: () => void
  onUpdateDeck: (patch: Partial<ForgeDeck>) => void
}) {
  return (
    <section className="rounded-[10px] border border-white/10 bg-[#111821] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/28">
          Details
        </h3>
        <button
          type="button"
          onClick={onDetailsEditToggle}
          data-v3-guides-indicator="editor-action"
          className="inline-flex h-8 items-center gap-1.5 rounded-[6px] px-3 text-[10px] font-black"
        >
          <EditIcon />
          {isEditingDetails ? 'Done' : 'Edit'}
        </button>
      </div>
      <div className="mt-4 grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <label
            className="grid gap-1.5"
            data-v3-guides-indicator="detail-field"
          >
            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white/28">
              Title
            </span>
            <input
              value={deck.title}
              disabled={!isEditingDetails}
              onChange={(event) => onUpdateDeck({ title: event.target.value })}
              className="h-11 px-3 text-sm font-semibold disabled:opacity-75"
            />
          </label>
          <PickerField
            disabled={!isEditingDetails}
            label="Difficulty"
            value={deck.difficulty}
            options={deckDifficultyOptions}
            onChange={(value) =>
              onUpdateDeck({ difficulty: value as DeckDifficulty })
            }
          />
          <PickerField
            disabled={!isEditingDetails}
            label="Status"
            value={deck.status}
            options={deckStatusOptions}
            onChange={(value) => onUpdateDeck({ status: value as DeckStatus })}
          />
          <InfoPair label="Cards" value={String(deck.cards.length)} />
        </div>
        <section
          className="rounded-[10px] border border-white/10 bg-white/[0.035] p-3"
          data-v3-guides-indicator="description-panel"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-[9px] font-black uppercase tracking-[0.16em] text-white/28">
              Description
            </h4>
          </div>
          <textarea
            value={deck.description}
            disabled={!isEditingDetails}
            onChange={(event) => onUpdateDeck({ description: event.target.value })}
            rows={4}
            className="mt-2 w-full resize-none px-3 py-2 text-sm font-semibold leading-5 disabled:opacity-75"
          />
        </section>
      </div>
    </section>
  )
}

function DeckGalleryPanel({
  deck,
  onSetHero,
}: {
  deck: ForgeDeck
  onSetHero: (heroImageId: string) => void
}) {
  return (
    <section className="rounded-[10px] border border-white/10 bg-[#111821] p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/28">
          Gallery
        </h3>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {deck.gallery.map((image) => {
          const isHero = image.id === deck.heroImageId

          return (
            <article
              key={image.id}
              className="overflow-hidden rounded-[8px] border border-white/10 bg-black"
            >
              <div className="relative h-24">
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="33vw"
                  className="object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => onSetHero(image.id)}
                data-v3-guides-indicator={isHero ? 'hero-image-active' : 'hero-image-action'}
                className="h-9 w-full text-[10px] font-black"
              >
                {isHero ? 'Hero' : 'Set Hero'}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function PickerField({
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  disabled: boolean
  label: string
  onChange: (value: string) => void
  options: string[]
  value: string
}) {
  return (
    <label className="grid gap-1.5" data-v3-guides-indicator="detail-field">
      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white/28">
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        data-v3-guides-indicator="editor-select"
        className="h-11 rounded-[6px] px-3 text-sm font-semibold disabled:opacity-75"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function CardOrderList({
  cards,
  onCardEdit,
  onReorderCard,
}: {
  cards: ForgeCard[]
  onCardEdit: (cardId: string) => void
  onReorderCard: (cardId: string, targetIndex: number) => void
}) {
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    edge: 'before' | 'after'
    index: number
  } | null>(null)

  return (
    <div className="grid gap-1.5 px-3 pb-3" data-v3-guides-indicator="card-order-list">
      {cards.map((card, index) => {
        const isDragging = draggingCardId === card.id
        const isDropBefore = dropTarget?.index === index && dropTarget.edge === 'before'
        const isDropAfter = dropTarget?.index === index && dropTarget.edge === 'after'

        return (
        <article
          key={card.id}
          data-dragging={isDragging}
          data-drop-before={isDropBefore}
          data-drop-after={isDropAfter}
          data-v3-guides-indicator="card-order-row"
          className="relative grid grid-cols-[36px_44px_1fr_40px] items-center gap-3 rounded-[8px] px-1 py-2"
          onDragOver={(event) => {
            event.preventDefault()
            const rect = event.currentTarget.getBoundingClientRect()
            const edge =
              event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
            setDropTarget({ edge, index })
            event.dataTransfer.dropEffect = 'move'
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
            setDropTarget(null)
          }}
          onDrop={(event) => {
            event.preventDefault()
            const draggedId =
              event.dataTransfer.getData('text/plain') || draggingCardId
            const targetIndex = dropTarget?.index ?? index
            const targetEdge = dropTarget?.edge ?? 'before'
            if (draggedId) onReorderCard(draggedId, targetIndex + (targetEdge === 'after' ? 1 : 0))
            setDraggingCardId(null)
            setDropTarget(null)
          }}
        >
          <span
            className="grid h-10 w-8 cursor-grab place-items-center rounded-[6px] text-lg font-black active:cursor-grabbing"
            aria-label="Move card"
            data-v3-guides-indicator="card-drag-handle"
            draggable
            onDragStart={(event) => {
              setDraggingCardId(card.id)
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', card.id)
            }}
            onDragEnd={() => {
              setDraggingCardId(null)
              setDropTarget(null)
            }}
          >
            ::
          </span>
          <span
            className="grid h-11 w-11 place-items-center rounded-[7px]"
            data-v3-guides-indicator="card-order-number"
            aria-label={`Card ${index + 1}`}
          >
            {index + 1}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black text-[color:var(--og-text-primary)]">{card.title}</span>
            <span className="block text-[10px] font-semibold capitalize text-[color:var(--og-text-secondary)]">
              {card.template}
            </span>
          </span>
          <button
            type="button"
            onClick={() => onCardEdit(card.id)}
            data-v3-guides-indicator="card-edit-button"
            className="grid h-9 w-9 place-items-center rounded-[6px] border text-lg font-black"
            aria-label={`Edit ${card.title}`}
          >
            <EditIcon />
          </button>
        </article>
        )
      })}
    </div>
  )
}

function DeckPreview({ deck }: { deck: ForgeDeck }) {
  return (
    <section
      className="rounded-[10px] border border-white/10 bg-[#111821] p-3"
      data-v3-guides-indicator="deck-preview"
    >
      <div className="grid gap-3">
        {deck.cards.map((card, index) => (
          <article
            key={card.id}
            className="overflow-hidden rounded-[10px] border border-white/10 bg-white/[0.035]"
          >
            <div className="relative h-36 bg-black">
              <Image
                src={card.image}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 448px"
                className="object-cover"
              />
            </div>
            <div className="p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/32">
                {index + 1} - {card.template}
              </p>
              <h4 className="mt-1 text-lg font-black">{card.title}</h4>
              <p className="mt-2 text-sm font-semibold leading-5 text-white/50">
                {card.body}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function DeckEditorScreen({
  deck,
  forgeMode,
  isSaving,
  onAddCard,
  onCardEdit,
  onReorderCard,
  onSave,
  saveError,
}: {
  deck: ForgeDeck
  forgeMode: ForgeMode
  isSaving: boolean
  onAddCard: () => void
  onCardEdit: (cardId: string) => void
  onReorderCard: (cardId: string, targetIndex: number) => void
  onSave: () => void
  saveError: string | null
}) {
  return (
    <section className="grid gap-4">
      <section className="rounded-[10px] border border-white/10 bg-[#111821] p-4">
        <div className="grid grid-cols-[64px_1fr] gap-3">
          <span className="relative h-16 overflow-hidden rounded-[8px] bg-black">
            <Image
              src="/onboarding/pains/pile-of-shame.jpeg"
              alt=""
              fill
              sizes="64px"
              className="object-cover"
            />
          </span>
          <span>
            <h2 className="text-lg font-black">{deck.title}</h2>
            <p className="mt-1 text-xs font-semibold text-white/42">
              Deck type: {deck.type}
            </p>
          </span>
        </div>
      </section>
      <section className="rounded-[10px] border border-white/10 bg-[#111821]">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/28">
            Cards ({deck.cards.length})
          </h3>
          <button
            type="button"
            onClick={onAddCard}
            data-v3-guides-indicator="editor-action"
            className="inline-flex h-8 items-center rounded-[6px] px-3 text-[10px] font-black"
          >
            + Add Card
          </button>
        </div>
        <CardOrderList
          cards={deck.cards}
          onCardEdit={onCardEdit}
          onReorderCard={onReorderCard}
        />
      </section>
      <p className="text-center text-xs font-semibold text-white/32">
        Use the left handle to move cards up or down.
      </p>
      {saveError ? (
        <p className="rounded-[8px] border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-100">
          {saveError}
        </p>
      ) : null}
      <PrimaryButton onClick={onSave} disabled={isSaving}>
        {isSaving ? 'Saving Deck...' : forgeMode === 'deck' ? 'Save Deck' : 'Save Deck'}
      </PrimaryButton>
    </section>
  )
}

function AddCardSheet({
  onAddCard,
  onClose,
}: {
  onAddCard: (cardType: CardTemplate) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-end bg-black/65 px-3 py-4 backdrop-blur-sm">
      <section
        className="w-full max-w-md rounded-[14px] border border-white/10 bg-[#10161d] p-4 shadow-2xl shadow-black/50"
        data-v3-guides-indicator="add-card-sheet"
      >
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06]"
            aria-label="Close add card"
          >
            x
          </button>
          <h2 className="text-xl font-black">Add Card to Deck</h2>
        </div>
        <div className="grid gap-3">
          {cardTemplateOptions.map((card) => (
            <button
              key={card.template}
              type="button"
              onClick={() => onAddCard(card.template)}
              className="grid grid-cols-[64px_1fr] gap-3 rounded-[10px] border border-white/10 bg-white/[0.04] p-3 text-left"
            >
              <span className="relative h-16 overflow-hidden rounded-[8px] bg-black">
                <Image
                  src="/onboarding/pains/paint-management.jpeg"
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </span>
              <span>
                <span className="block text-sm font-black">{card.title}</span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-white/45">
                  {card.body}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function EditCardSheet({
  card,
  onChange,
  onClose,
  onDelete,
}: {
  card: ForgeCard
  onChange: (patch: Partial<ForgeCard>) => void
  onClose: () => void
  onDelete: () => void
}) {
  return (
    <div className="fixed inset-0 z-[75] grid place-items-end bg-black/65 px-3 py-4 backdrop-blur-sm">
      <section
        className="w-full max-w-md rounded-[14px] border border-white/10 bg-[#10161d] p-4 shadow-2xl shadow-black/50"
        data-v3-guides-indicator="add-card-sheet"
      >
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.06]"
            aria-label="Close card editor"
          >
            x
          </button>
          <span>
            <h2 className="text-xl font-black">Edit Card</h2>
            <p className="mt-1 text-xs font-semibold capitalize text-white/42">
              {card.template} template
            </p>
          </span>
        </div>
        <div className="grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white/28">
              Title
            </span>
            <input
              value={card.title}
              onChange={(event) => onChange({ title: event.target.value })}
              className="h-11 px-3 text-sm font-semibold"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white/28">
              Notes
            </span>
            <textarea
              value={card.body}
              onChange={(event) => onChange({ body: event.target.value })}
              rows={5}
              className="resize-none px-3 py-2 text-sm font-semibold leading-5"
            />
          </label>
          <PickerField
            disabled={false}
            label="Template"
            value={card.template}
            options={cardTemplateOptions.map((option) => option.template)}
            onChange={(value) => onChange({ template: value as CardTemplate })}
          />
          <button
            type="button"
            onClick={onDelete}
            data-v3-guides-indicator="danger-action"
            className="h-11 rounded-[6px] text-sm font-black"
          >
            Delete Card
          </button>
          <PrimaryButton onClick={onClose}>Done</PrimaryButton>
        </div>
      </section>
    </div>
  )
}

function Tabs({
  activeTab,
  onTabChange,
}: {
  activeTab: GuideTab
  onTabChange: (tab: GuideTab) => void
}) {
  return (
    <div
      className="grid grid-cols-3 rounded-[8px] border border-white/[0.04] bg-white/[0.055] p-0.5"
      role="tablist"
      aria-label="Guide sections"
    >
      {(['guides', 'decks', 'library'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={activeTab === tab}
          data-feature-guide-target={`guides.tabs.${tab}`}
          onClick={() => onTabChange(tab)}
          className={[
            'h-9 rounded-[6px] text-xs font-black capitalize transition',
            activeTab === tab
              ? 'bg-[#101822] text-cyan-300 shadow-[inset_0_0_24px_rgba(34,211,238,0.06)]'
              : 'text-white/38 hover:text-white/70',
          ].join(' ')}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

function GuidesTab({ guideFiles }: { guideFiles: GuideFile[] }) {
  return (
    <section
      className="grid gap-3"
      aria-label="Guide files"
      data-v3-guides-indicator="guides-list"
      data-feature-guide-target="guides.tabs.guides"
    >
      {guideFiles.length ? (
        guideFiles.map((guide) => <GuideFileCard key={guide.id} guide={guide} />)
      ) : (
        <EmptyPanel
          title="No guide files yet"
          text="Create a guide by choosing decks from your collection."
        />
      )}
    </section>
  )
}

function DecksTab({
  decks,
  onAddDeck,
  onEditDraftDeck,
}: {
  decks: Deck[]
  onAddDeck: () => void
  onEditDraftDeck: (deck: Deck) => void
}) {
  return (
    <section
      className="overflow-hidden rounded-[8px] border border-white/[0.06] bg-[#111821]"
      data-v3-guides-indicator="decks-list"
      data-feature-guide-target="guides.tabs.decks"
    >
      <div className="flex items-center justify-between px-4 py-4">
        <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-white/28">
          Your Deck Library
        </h2>
        <button
          type="button"
          onClick={onAddDeck}
          className="rounded-full px-2 py-1 text-[10px] font-black text-cyan-300 transition hover:bg-cyan-300/10"
        >
          Add Deck +
        </button>
      </div>
      <div className="divide-y divide-white/[0.06]">
        {decks.length ? (
          decks.map((deck) => (
            <DeckRow
              key={deck.id}
              deck={deck}
              onEditDraftDeck={onEditDraftDeck}
            />
          ))
        ) : (
          <EmptyPanel
            title="No decks yet"
            text="Every previous recipe now appears here as a deck."
          />
        )}
      </div>
    </section>
  )
}

function LibraryTab({
  decks,
  guides,
  onQueryChange,
  query,
}: {
  decks: Deck[]
  guides: GuideFile[]
  onQueryChange: (query: string) => void
  query: string
}) {
  return (
    <section className="grid gap-4">
      <SearchInput
        placeholder="Search guides and decks..."
        value={query}
        onChange={onQueryChange}
      />
      <section
        className="rounded-[8px] border border-white/[0.06] bg-[#111821] p-4"
        data-v3-guides-indicator="library-tags"
      >
        <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-white/28">
          Popular Tags
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {libraryTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => onQueryChange(tag)}
              data-v3-guides-indicator="library-tag"
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-black text-white/52 transition hover:border-cyan-300/45 hover:text-cyan-300"
            >
              {tag}
            </button>
          ))}
        </div>
      </section>
      <LibrarySection title="Public Guides" action="See all ->">
        {guides.length ? (
          guides.map((guide) => (
            <CompactGuideCard key={guide.id} guide={guide} />
          ))
        ) : (
          <EmptyPanel title="No public guides found" text="Try another search." />
        )}
      </LibrarySection>
      <LibrarySection title="Public Decks" action="See all ->">
        <div
          data-v3-guides-indicator="library-decks-list"
          data-feature-guide-target="guides.tabs.library"
        >
          {decks.length ? (
            decks.map((deck) => (
              <DeckRow
                key={deck.id}
                deck={deck}
              />
            ))
          ) : (
            <EmptyPanel title="No public decks found" text="Try another search." />
          )}
        </div>
      </LibrarySection>
    </section>
  )
}

function EmptyPanel({ text, title }: { text: string; title: string }) {
  return (
    <div
      className="m-4 rounded-[8px] border border-dashed border-white/10 bg-black/18 p-5 text-center"
      data-v3-guides-indicator="empty-panel"
    >
      <p className="text-sm font-black text-white">{title}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-white/42">{text}</p>
    </div>
  )
}

function GuideFileCard({ guide }: { guide: GuideFile }) {
  return (
    <Link
      href={`/guides/${guide.id}?preview=1`}
      data-v3-guides-indicator="guide-card"
      data-feature-guide-target="guides.tabs.guides"
      className="block overflow-hidden rounded-[8px] border border-white/[0.055] bg-[#111821] shadow-[0_14px_40px_rgba(0,0,0,0.22)] transition hover:border-cyan-300/45"
    >
      <div className="grid grid-cols-[110px_1fr] gap-3 p-3">
        <div className="relative min-h-[116px] overflow-hidden rounded-[8px] bg-black">
          <Image
            src={guide.image}
            alt=""
            fill
            sizes="110px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/42" />
        </div>
        <div className="min-w-0 py-1">
          <h2 className="line-clamp-2 text-lg font-black leading-tight text-white">
            {guide.title}
          </h2>
          <p className="mt-2 line-clamp-2 text-xs font-semibold leading-4 text-white/52">
            {guide.subtitle}
          </p>
          <div className="mt-3 flex gap-1">
            {guide.palette.map((color, index) => (
              <span
                key={`${guide.id}-${color}-${index}`}
                className="h-3 w-3 rounded-full border border-white/10"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2 border-t border-white/[0.06] px-3 py-3 text-[10px] font-black text-white/38">
        <span>{guide.decks} Decks</span>
        <span>{guide.cards} Cards</span>
        <span>{guide.level}</span>
        <span className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-2 py-1 text-cyan-300">
          {guide.ownedPercent}% Owned
        </span>
      </div>
    </Link>
  )
}

function CompactGuideCard({ guide }: { guide: GuideFile }) {
  return (
    <Link
      href={`/guides/${guide.id}?preview=1`}
      data-v3-guides-indicator="compact-guide-card"
      data-feature-guide-target="guides.tabs.library"
      className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.035]"
    >
      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[8px] bg-black">
        <Image src={guide.image} alt="" fill sizes="56px" className="object-cover" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-white">
          {guide.title}
        </span>
        <span className="mt-1 block truncate text-[10px] font-semibold text-white/38">
          {guide.subtitle}
        </span>
      </span>
      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-black text-white/42">
        {guide.decks} Decks
      </span>
    </Link>
  )
}

function DeckRow({
  deck,
  onEditDraftDeck,
}: {
  deck: Deck
  onEditDraftDeck?: (deck: Deck) => void
}) {
  const isDraftDeck = Boolean(deck.draft)
  const primaryClassName = 'flex min-w-0 flex-1 items-center gap-3 text-left transition hover:opacity-85'
  const primaryContent = (
    <>
      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-black">
        <Image src={deck.image} alt="" fill sizes="48px" className="object-cover" />
        <span
          className="absolute inset-x-0 bottom-0 h-1"
          style={{ backgroundColor: deck.accent }}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-white">
          {deck.title}
        </span>
        <span className="mt-1 block truncate text-[10px] font-semibold text-white/36">
          {deck.category} - {deck.cards} Cards - {deck.paints} Paints
        </span>
        <span className="mt-1 block text-[10px] font-semibold text-white/26">
          Used in {deck.usedIn} Guides
        </span>
      </span>
    </>
  )

  return (
    <article
      className="flex items-center gap-3 px-4 py-3"
      data-v3-guides-indicator="deck-row"
      data-feature-guide-target="guides.tabs.decks"
    >
      {isDraftDeck ? (
        <button
          type="button"
          className={primaryClassName}
          onClick={() => onEditDraftDeck?.(deck)}
        >
          {primaryContent}
        </button>
      ) : (
        <Link
          href={`/guides/decks/${deck.id}?preview=1`}
          className={primaryClassName}
        >
          {primaryContent}
        </Link>
      )}
      {isDraftDeck ? (
        <button
          type="button"
          aria-label={`Edit ${deck.title}`}
          data-v3-guides-indicator="deck-edit-link"
          data-feature-guide-target="guides.deck_save"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-lg font-black transition"
          onClick={() => onEditDraftDeck?.(deck)}
        >
          <EditIcon />
        </button>
      ) : (
        <Link
          href={`/guides/decks/${deck.id}?preview=1&edit=1`}
          aria-label={`Edit ${deck.title}`}
          data-v3-guides-indicator="deck-edit-link"
          data-feature-guide-target="guides.deck_save"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-lg font-black transition"
        >
          <EditIcon />
        </Link>
      )}
    </article>
  )
}

function ForgeDeckRow({ deck }: { deck: ForgeDeck }) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      data-v3-guides-indicator="forge-deck-row"
    >
      <span className="text-white/22">::</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-white">
          {deck.title}
        </span>
        <span className="mt-1 block text-[10px] font-semibold text-white/36">
          {deck.type} - {deck.cards.length} cards
        </span>
      </span>
      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[9px] font-black text-white/42">
        {deck.required ? 'Required' : 'Optional'}
      </span>
    </div>
  )
}

function LibrarySection({
  action,
  children,
  title,
}: {
  action: string
  children: ReactNode
  title: string
}) {
  return (
    <section
      className="overflow-hidden rounded-[8px] border border-white/[0.06] bg-[#111821]"
      data-v3-guides-indicator="library-section"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-white/28">
          {title}
        </h2>
        <button
          type="button"
          className="text-[10px] font-black text-cyan-300 transition hover:text-cyan-200"
        >
          {action}
        </button>
      </div>
      <div className="divide-y divide-white/[0.06]">{children}</div>
    </section>
  )
}

function SelectableMediaRow({
  image,
  meta,
  onClick,
  selected,
  title,
}: {
  image: string
  meta: string
  onClick: () => void
  selected: boolean
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-v3-guides-indicator="selectable-media-row"
      className={[
        'grid grid-cols-[64px_1fr_auto] items-center gap-3 rounded-[10px] border bg-[#111821] p-3 text-left transition',
        selected ? 'border-cyan-300/55' : 'border-white/10',
      ].join(' ')}
    >
      <span className="relative h-16 overflow-hidden rounded-[8px] bg-black">
        <Image src={image} alt="" fill sizes="64px" className="object-cover" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-white">
          {title}
        </span>
        <span className="mt-1 block truncate text-xs font-semibold text-white/40">
          {meta}
        </span>
      </span>
      <span className="text-cyan-300">{selected ? <CheckIcon /> : '+'}</span>
    </button>
  )
}

function SearchInput({
  onChange,
  placeholder,
  value,
}: {
  onChange?: (value: string) => void
  placeholder: string
  value?: string
}) {
  return (
    <label
      className="relative block"
      data-v3-guides-indicator="search-input"
      data-feature-guide-target="guides.library_search"
    >
      <span className="sr-only">{placeholder}</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/28"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        className="h-12 w-full rounded-[8px] border border-white/10 bg-[#111821] pl-10 pr-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/70"
      />
    </label>
  )
}

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-[8px] border border-white/10 bg-white/[0.035] p-3"
      data-v3-guides-indicator="info-pair"
    >
      <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/28">
        {label}
      </p>
      <p className="mt-2 font-black text-white">{value}</p>
    </div>
  )
}

function InfoBox({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-[10px] border border-cyan-300/18 bg-cyan-300/8 p-3 text-xs font-semibold leading-5 text-white/52"
      data-v3-guides-indicator="info-box"
    >
      {children}
    </div>
  )
}

function PrimaryButton({
  children,
  disabled = false,
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-v3-guides-indicator="primary-button"
      className="tap-press h-12 rounded-[10px] bg-cyan-300 text-sm font-black text-black shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200 disabled:cursor-wait disabled:opacity-60"
    >
      {children}
    </button>
  )
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.8 4.6c-1.8-1.7-4.7-1.6-6.4.2L12 7.2 9.6 4.8C7.9 3 5 2.9 3.2 4.6c-2 1.9-2.1 5.1-.2 7.1L12 21l9-9.3c1.9-2 1.8-5.2-.2-7.1Z" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}
