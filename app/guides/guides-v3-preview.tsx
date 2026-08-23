'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ReactNode, useEffect, useState } from 'react'
import AppHamburgerMenu from '../components/app-hamburger-menu'
import FeatureGuideTour from '../components/feature-guide-tour'
import V3PerfIndicator from '../components/v3-perf-indicator'
import styles from './guides-v3-silver.module.css'
import type { FeatureGuideEntry } from '../components/feature-guide-types'
import type {
  GuidesV3Deck,
  GuidesV3GuideFile,
  GuidesV3Payload,
} from './guides-v3-data'

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
type SourceKind = 'unit' | 'project' | 'photos' | 'paints' | 'blank'
type BuildTab = 'details' | 'decks' | 'preview'

type GuideFile = GuidesV3GuideFile
type Deck = GuidesV3Deck

type ForgeDeck = {
  id: string
  title: string
  type: string
  cards: string[]
  required: boolean
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

const blankTemplates = [
  'Quick 4-Step Guide',
  'Classic Layering Guide',
  'Speedpaint Guide',
  'Airbrush Guide',
  'Basing Guide',
  'Custom Blank Guide',
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

const defaultForgeDecks: ForgeDeck[] = [
  {
    id: 'palette-card',
    title: 'Palette Card',
    type: 'Palette',
    cards: ['Palette overview'],
    required: true,
  },
  {
    id: 'ancient-bone',
    title: 'Ancient Bone',
    type: 'Steps',
    cards: ['Cover Card', 'Basecoat', 'Shade the bone', 'Drybrush'],
    required: true,
  },
  {
    id: 'forgotten-tomb-gold',
    title: 'Forgotten Tomb Gold',
    type: 'Steps',
    cards: ['Cover Card', 'Base metal', 'Verdigris wash', 'Final shine'],
    required: true,
  },
  {
    id: 'verdigris-brass-weapons',
    title: 'Verdigris Brass Weapons',
    type: 'Steps',
    cards: ['Cover Card', 'Brass base', 'Green oxidation', 'Edge cleanup'],
    required: false,
  },
  {
    id: 'classic-turquoise-armour',
    title: 'Classic Turquoise Armour',
    type: 'Steps',
    cards: ['Cover Card', 'Teal base', 'Dark shade', 'Edge highlight'],
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
  const seedDecks =
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
  const [decks, setDecks] = useState(seedDecks)
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
  const [selectedTemplate, setSelectedTemplate] = useState(blankTemplates[0])
  const [forgeDecks, setForgeDecks] = useState<ForgeDeck[]>(defaultForgeDecks)
  const [buildTab, setBuildTab] = useState<BuildTab>('details')
  const [editingDeckId, setEditingDeckId] = useState(defaultForgeDecks[1].id)
  const [isAddCardOpen, setIsAddCardOpen] = useState(false)
  const [guideDeckSearch, setGuideDeckSearch] = useState('')
  const [selectedGuideDeckIds, setSelectedGuideDeckIds] = useState(
    () => new Set<string>()
  )
  const [guideName, setGuideName] = useState('')
  const [guideDescription, setGuideDescription] = useState('')
  const [guideImage, setGuideImage] = useState('/onboarding/pains/tough-choices.jpeg')

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
  const forgeTitle =
    sourceKind === 'unit'
      ? selectedUnit.title
      : sourceKind === 'project'
        ? selectedProject.title
        : sourceKind === 'photos'
          ? 'Photo Built Guide'
          : sourceKind === 'paints'
            ? 'Paint List Guide'
          : selectedTemplate
  const activeGuide =
    activeGuideIndex === null ? null : featureGuides[activeGuideIndex] ?? null

  function openCreateChoice() {
    setActiveGuideIndex(null)
    setIsCreateChoiceOpen(true)
  }

  function startFeatureTour() {
    if (!featureGuides.length) return
    setIsCreateChoiceOpen(false)
    setActiveGuideIndex(0)
  }

  function closeFeatureTour() {
    setActiveGuideIndex(null)
  }

  function showPreviousGuide() {
    setActiveGuideIndex((current) =>
      current === null ? 0 : Math.max(0, current - 1)
    )
  }

  function showNextGuide() {
    setActiveGuideIndex((current) =>
      current === null ? 0 : Math.min(featureGuides.length - 1, current + 1)
    )
  }

  function startCreate(mode: ForgeMode) {
    setForgeMode(mode)
    setIsCreateChoiceOpen(false)
    if (mode === 'guide') {
      setSelectedGuideDeckIds(new Set())
      setGuideDeckSearch('')
      setGuideName('')
      setGuideDescription('')
      setGuideImage('/onboarding/pains/tough-choices.jpeg')
      setForgeScreen('guide-decks')
      return
    }

    setForgeDecks([defaultForgeDecks[0]])
    setEditingDeckId(defaultForgeDecks[0].id)
    setForgeScreen('source')
  }

  function closeForge() {
    setForgeScreen(null)
    setIsAddCardOpen(false)
    setBuildTab('details')
  }

  function chooseSource(nextSource: SourceKind) {
    setSourceKind(nextSource)
    setForgeScreen(nextSource)
  }

  function continueToDraft() {
    const deckTitle =
      sourceKind === 'unit'
        ? `${selectedUnit.title} Deck`
        : sourceKind === 'project'
          ? `${selectedProject.title} Deck`
          : sourceKind === 'photos'
            ? 'Photo Sequence Deck'
            : sourceKind === 'paints'
              ? 'Paint List Deck'
              : selectedTemplate
    const baseDecks = [
      {
        id: `draft-deck-${sourceKind}`,
        title: deckTitle,
        type: sourceKind === 'photos' ? 'Image + Steps' : 'Steps',
        cards:
          sourceKind === 'blank'
            ? ['Cover Card', 'Card 01 - First step']
            : ['Cover Card', 'Palette Card', 'Card 01 - Basecoat', 'Card 02 - Finish'],
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

  function saveForgeToHome() {
    if (forgeMode === 'deck') {
      const deckDraft = editingDeck ?? forgeDecks[0]
      const nextDeck = {
        id: `saved-${Date.now()}`,
        title: deckDraft.title,
        category: deckDraft.type,
        cards: deckDraft.cards.length,
        paints: 5,
        usedIn: 0,
        image: '/onboarding/pains/paint-management.jpeg',
        saved: true,
        accent: '#22d3ee',
      }
      setDecks((current) => [nextDeck, ...current])
      setActiveTab('decks')
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

  function addCardToDeck(cardType: string) {
    setForgeDecks((current) =>
      current.map((deck) =>
        deck.id === editingDeck.id
          ? {
              ...deck,
              cards: [...deck.cards, cardType],
            }
          : deck
      )
    )
    setIsAddCardOpen(false)
  }

  function addDeckToDraft() {
    const nextDeck = {
      id: `added-deck-${Date.now()}`,
      title: 'New Optional Deck',
      type: 'Steps',
      cards: ['Cover Card'],
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
          else if (forgeScreen === 'draft') setForgeScreen(sourceKind)
          else if (forgeScreen === 'build') setForgeScreen('draft')
          else if (forgeScreen === 'deck-editor') {
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
          <SourcePicker onChooseSource={chooseSource} />
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
          <BlankSourceScreen
            selectedTemplate={selectedTemplate}
            onTemplateChange={setSelectedTemplate}
            onContinue={continueToDraft}
          />
        ) : null}
        {forgeScreen === 'draft' ? (
          <DraftReviewScreen
            decks={forgeDecks}
            title={editingDeck?.title ?? forgeTitle}
            onAddDeck={addDeckToDraft}
            onContinue={continueToBuild}
          />
        ) : null}
        {forgeScreen === 'build' ? (
          <GuideBuildScreen
            buildTab={buildTab}
            decks={forgeDecks}
            title={editingDeck?.title ?? forgeTitle}
            onAddDeck={addDeckToDraft}
            onBuildTabChange={setBuildTab}
            onEditDeck={(deckId) => {
              setEditingDeckId(deckId)
              setForgeScreen('deck-editor')
            }}
            onSave={saveForgeToHome}
          />
        ) : null}
        {forgeScreen === 'deck-editor' ? (
          <DeckEditorScreen
            deck={editingDeck}
            forgeMode={forgeMode}
            onAddCard={() => setIsAddCardOpen(true)}
            onSave={saveForgeToHome}
          />
        ) : null}

        {isAddCardOpen ? (
          <AddCardSheet
            onClose={() => setIsAddCardOpen(false)}
            onAddCard={addCardToDeck}
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
  if (screen === 'blank') return 'Start From Blank'
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
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
            <path d="M9.6 9a2.6 2.6 0 0 1 4.95 1.15c0 1.75-1.55 2.25-2.25 3.3-.22.33-.3.68-.3 1.05" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
            <path d="M12 18h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.6" />
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
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
      {[
        ['unit', 'From Unit', 'Turn a completed unit into a reusable deck.'],
        ['project', 'From Project', 'Build a deck from units and shared palette.'],
        ['photos', 'From Photos', 'Upload progress photos and let the app arrange them.'],
        ['paints', 'From Paint List', 'Start with paints and build steps around them.'],
        ['blank', 'From Blank', 'Create cards manually.'],
      ].map(([id, title, body]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChooseSource(id as SourceKind)}
          data-v3-guides-indicator="source-choice-card"
          className="flex items-center gap-3 rounded-[10px] border border-white/10 bg-[#111821] p-3 text-left transition hover:border-cyan-300/45"
        >
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[8px] bg-cyan-300/10 text-xl font-black text-cyan-300">
            {title.slice(5, 6)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black text-white">{title}</span>
            <span className="mt-1 block text-xs font-semibold leading-5 text-white/45">
              {body}
            </span>
          </span>
          <span className="text-white/36">&gt;</span>
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
  onContinue,
  onTemplateChange,
  selectedTemplate,
}: {
  onContinue: () => void
  onTemplateChange: (template: string) => void
  selectedTemplate: string
}) {
  return (
    <section className="grid gap-4">
      <p className="text-sm font-semibold text-white/48">
        Choose a template to get started.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {blankTemplates.map((template) => (
          <button
            key={template}
            type="button"
            onClick={() => onTemplateChange(template)}
            className={[
              'min-h-[118px] rounded-[10px] border bg-[#111821] p-3 text-left transition',
              template === selectedTemplate
                ? 'border-cyan-300/60'
                : 'border-white/10',
            ].join(' ')}
          >
            <span className="block text-sm font-black">{template}</span>
            <span className="mt-2 block text-xs font-semibold leading-5 text-white/42">
              Starts with a ready card outline.
            </span>
          </button>
        ))}
      </div>
      <PrimaryButton onClick={onContinue}>Use Template</PrimaryButton>
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
  decks,
  onAddDeck,
  onBuildTabChange,
  onEditDeck,
  onSave,
  title,
}: {
  buildTab: BuildTab
  decks: ForgeDeck[]
  onAddDeck: () => void
  onBuildTabChange: (tab: BuildTab) => void
  onEditDeck: (deckId: string) => void
  onSave: () => void
  title: string
}) {
  return (
    <section className="grid gap-4">
      <div className="relative h-40 overflow-hidden rounded-[12px] border border-white/10 bg-black">
        <Image
          src="/onboarding/pains/tough-choices.jpeg"
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 448px"
          className="object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/82" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h2 className="text-2xl font-black">{title}</h2>
        </div>
      </div>
      <div className="grid grid-cols-3 rounded-[8px] bg-white/[0.055] p-0.5">
        {(['details', 'decks', 'preview'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onBuildTabChange(tab)}
            className={[
              'h-9 rounded-[6px] text-xs font-black capitalize',
              buildTab === tab ? 'bg-[#101822] text-cyan-300' : 'text-white/38',
            ].join(' ')}
          >
            {tab === 'decks' ? 'cards' : tab}
          </button>
        ))}
      </div>
      {buildTab === 'details' ? (
        <section className="rounded-[10px] border border-white/10 bg-[#111821] p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/28">
              Deck Details
            </h3>
            <button className="text-[10px] font-black text-cyan-300">Edit</button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm font-semibold text-white/58">
            <InfoPair label="Difficulty" value="Intermediate" />
            <InfoPair label="Decks" value={String(decks.length)} />
            <InfoPair label="Cards" value={String(decks.reduce((sum, deck) => sum + deck.cards.length, 0))} />
            <InfoPair label="Status" value="Draft" />
          </div>
        </section>
      ) : null}
      {buildTab === 'decks' ? (
        <section className="rounded-[10px] border border-white/10 bg-[#111821]">
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/28">
              Card Plan
            </h3>
            <button
              type="button"
              onClick={onAddDeck}
              className="text-[10px] font-black text-cyan-300"
            >
              + Add Deck
            </button>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {decks.map((deck) => (
              <button
                key={deck.id}
                type="button"
                onClick={() => onEditDeck(deck.id)}
                className="w-full text-left"
              >
                <ForgeDeckRow deck={deck} />
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {buildTab === 'preview' ? (
        <InfoBox>
          Preview will show the guide as a readable sequence once card layout is
          finalized.
        </InfoBox>
      ) : null}
      <PrimaryButton onClick={onSave}>Save Deck Draft</PrimaryButton>
    </section>
  )
}

function DeckEditorScreen({
  deck,
  forgeMode,
  onAddCard,
  onSave,
}: {
  deck: ForgeDeck
  forgeMode: ForgeMode
  onAddCard: () => void
  onSave: () => void
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
            className="text-[10px] font-black text-cyan-300"
          >
            + Add Card
          </button>
        </div>
        <div className="divide-y divide-white/[0.06]">
          {deck.cards.map((card, index) => (
            <div
              key={`${card}-${index}`}
              className="grid grid-cols-[auto_56px_1fr_auto] items-center gap-3 px-4 py-3"
            >
              <span className="text-white/22">::</span>
              <span className="relative h-12 overflow-hidden rounded-[7px] bg-black">
                <Image
                  src="/onboarding/pains/tough-choices.jpeg"
                  alt=""
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">{card}</span>
                <span className="block text-[10px] font-semibold text-white/36">
                  {index === 0 ? 'Cover' : 'Step'}
                </span>
              </span>
              <span className="text-white/28">&gt;</span>
            </div>
          ))}
        </div>
      </section>
      <p className="text-center text-xs font-semibold text-white/32">
        Drag to reorder cards later.
      </p>
      <PrimaryButton onClick={onSave}>
        {forgeMode === 'deck' ? 'Save Deck Draft' : 'Save Deck'}
      </PrimaryButton>
    </section>
  )
}

function AddCardSheet({
  onAddCard,
  onClose,
}: {
  onAddCard: (cardType: string) => void
  onClose: () => void
}) {
  const cards = [
    ['Cover Card', 'Set the tone with a large hero image and details.'],
    ['Card (Step Card)', 'Step-by-step painting instruction with paints.'],
    ['Image Card', 'Reference images, showcases, or finished mini details.'],
    ['Palette Card', 'Save a colour palette and list of paints.'],
  ]
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
          {cards.map(([title, body]) => (
            <button
              key={title}
              type="button"
              onClick={() => onAddCard(title)}
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
                <span className="block text-sm font-black">{title}</span>
                <span className="mt-1 block text-xs font-semibold leading-5 text-white/45">
                  {body}
                </span>
              </span>
            </button>
          ))}
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
}: {
  decks: Deck[]
  onAddDeck: () => void
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
}: {
  deck: Deck
}) {
  return (
    <article
      className="flex items-center gap-3 px-4 py-3"
      data-v3-guides-indicator="deck-row"
      data-feature-guide-target="guides.tabs.decks"
    >
      <Link
        href={`/guides/decks/${deck.id}?preview=1`}
        className="flex min-w-0 flex-1 items-center gap-3 transition hover:opacity-85"
      >
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
      </Link>
      <Link
        href={`/recipes/${deck.id}`}
        aria-label={`Edit ${deck.title}`}
        data-v3-guides-indicator="deck-edit-link"
        data-feature-guide-target="guides.deck_save"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border text-lg font-black transition"
      >
        <EditIcon />
      </Link>
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
  onClick,
}: {
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-v3-guides-indicator="primary-button"
      className="tap-press h-12 rounded-[10px] bg-cyan-300 text-sm font-black text-black shadow-[0_0_24px_rgba(34,211,238,0.22)] transition hover:bg-cyan-200"
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
