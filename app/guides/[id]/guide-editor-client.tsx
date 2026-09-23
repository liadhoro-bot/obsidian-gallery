'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import FeatureGuideLauncher from '../../components/feature-guide-launcher'
import type { FeatureGuideEntry } from '../../components/feature-guide-types'
import type { Recipe, RecipeImage, RecipeStep } from '../shared/types'
import {
  RecipeGuideCoverCard,
  RecipeGuideDescriptiveStepCard,
  RecipeGuideImageStepCard,
  RecipeGuidePaintsCard,
  RecipeGuideSmallImageStepCard,
  RecipeGuideThemeStepCard,
  RecipeGuideVideoCard,
} from '../shared/recipe-guide-cards'
import type { GuidesV3Deck } from '../guides-v3-data'
import type { GuidesV3DeckDetail, GuidesV3DeckStep, GuidesV3GuideDetail } from '../guides-v3-detail-data'
import styles from '../decks/[id]/deck-editor-client.module.css'

type GuideEditorTab = 'details' | 'decks' | 'preview'
type GuideDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'
type GuideStatus = 'Draft' | 'Private' | 'Public'
type DropTarget = { edge: 'before' | 'after'; id: string }

type DeckGuidePaint = {
  id: string
  brand: string | null
  line: string | null
  name: string | null
  hex_approx: string | null
  swatch_image_url: string | null
  ratio_text?: string | null
}

export type GuideEditorSavePayload = {
  title: string
  description: string
  image: string | null
  status: GuideStatus
  difficulty: GuideDifficulty
  deckIds: string[]
}

const difficultyOptions: GuideDifficulty[] = ['Beginner', 'Intermediate', 'Advanced']
const statusOptions: GuideStatus[] = ['Draft', 'Private', 'Public']

function inferDifficulty(cardCount: number): GuideDifficulty {
  if (cardCount >= 12) return 'Advanced'
  if (cardCount >= 6) return 'Intermediate'
  return 'Beginner'
}

function isUsableImageUrl(value?: string | null) {
  const url = typeof value === 'string' ? value.trim() : ''
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    (url.startsWith('/') && !url.startsWith('//'))
  )
}

function toRecipe(deck: GuidesV3DeckDetail): Recipe {
  return {
    id: deck.id,
    name: deck.title,
    description: deck.description,
    inventory_required: null,
    expert_tips: null,
    youtube_url: null,
    is_public: deck.isPublic,
  }
}

function toFeaturedImage(deck: GuidesV3DeckDetail): RecipeImage | null {
  const image = deck.fullImage || deck.image
  if (!isUsableImageUrl(image)) return null

  return {
    id: `${deck.id}-cover`,
    image_url: image,
    is_featured: true,
    alt_text: deck.title,
  }
}

function toRecipeStep(step: GuidesV3DeckStep): RecipeStep {
  return {
    id: step.id,
    step_number: step.number,
    title: step.title,
    instructions: step.instructions,
    image_url: step.rawImage || step.image,
  }
}

function toRecipePaints(step: GuidesV3DeckStep): DeckGuidePaint[] {
  return step.paints.map((paint) => ({
    id: paint.id,
    brand: paint.brand,
    line: paint.line,
    name: paint.name,
    hex_approx: paint.color,
    swatch_image_url: paint.swatchImageUrl,
    ratio_text: paint.ratioText,
  }))
}

function isThemeTemplateStep(step: GuidesV3DeckStep, imageUrl: string | null) {
  const lowerTitle = step.title.toLowerCase()
  const looksLikeTheme = lowerTitle.includes('theme') || lowerTitle.includes('palette')

  return (
    step.template === 'theme' ||
    (step.template === 'image' && looksLikeTheme) ||
    (!step.template && looksLikeTheme) ||
    (!step.template && Boolean(imageUrl) && step.paints.length >= 4)
  )
}

export default function GuideEditorClient({
  guide,
  memberDecks,
  availableDecks,
  deckDetails,
  initialCoverImage,
  featureGuides,
  backHref,
  isSaving = false,
  onSaveDraft,
  saveError,
  saveLabel = 'Save',
}: {
  guide: GuidesV3GuideDetail
  memberDecks: GuidesV3Deck[]
  availableDecks: GuidesV3Deck[]
  deckDetails: GuidesV3DeckDetail[]
  initialCoverImage: string
  featureGuides: FeatureGuideEntry[]
  backHref: string
  isSaving?: boolean
  onSaveDraft?: (payload: GuideEditorSavePayload) => void
  saveError?: string | null
  saveLabel?: string
}) {
  const [activeTab, setActiveTab] = useState<GuideEditorTab>('details')
  const [title, setTitle] = useState(guide.title)
  const [description, setDescription] = useState(guide.subtitle)
  const [coverImage, setCoverImage] = useState(initialCoverImage)
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>(
    () => guide.deckIds ?? memberDecks.map((deck) => deck.id)
  )
  const [status, setStatus] = useState<GuideStatus>(
    deckDetails.some((deck) => deck.isPublic) ? 'Public' : 'Private'
  )
  const [difficulty, setDifficulty] = useState<GuideDifficulty>(
    (guide.difficulty as GuideDifficulty) ||
      inferDifficulty(memberDecks.reduce((sum, deck) => sum + deck.cards, 0))
  )
  const [draggingDeckId, setDraggingDeckId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [isAddDecksOpen, setIsAddDecksOpen] = useState(false)
  const [deckSearch, setDeckSearch] = useState('')

  const deckById = useMemo(() => {
    const map = new Map<string, GuidesV3Deck>()
    for (const deck of memberDecks) map.set(deck.id, deck)
    for (const deck of availableDecks) map.set(deck.id, deck)
    return map
  }, [memberDecks, availableDecks])
  const deckDetailById = useMemo(
    () => new Map(deckDetails.map((deck) => [deck.id, deck])),
    [deckDetails]
  )

  const selectedDecks = selectedDeckIds
    .map((id) => deckById.get(id))
    .filter((deck): deck is GuidesV3Deck => Boolean(deck))
  const selectedDeckIdSet = new Set(selectedDeckIds)
  const pickableDecks = availableDecks.filter((deck) => !selectedDeckIdSet.has(deck.id))
  const normalizedDeckSearch = deckSearch.trim().toLowerCase()
  const filteredPickableDecks = pickableDecks.filter((deck) =>
    `${deck.title} ${deck.category}`.toLowerCase().includes(normalizedDeckSearch)
  )
  const coverImageCandidates = selectedDecks.map((deck) => ({
    id: deck.id,
    image: deckDetailById.get(deck.id)?.fullImage || deckDetailById.get(deck.id)?.image || deck.image,
  }))

  function reorderDeck(deckId: string, targetId: string, edge: DropTarget['edge']) {
    if (deckId === targetId) return
    setSelectedDeckIds((current) => {
      const fromIndex = current.indexOf(deckId)
      const toIndex = current.indexOf(targetId)
      if (fromIndex < 0 || toIndex < 0) return current
      const next = [...current]
      const [moved] = next.splice(fromIndex, 1)
      const targetOffset = edge === 'after' ? 1 : 0
      const adjustedIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
      next.splice(adjustedIndex + targetOffset, 0, moved)
      return next
    })
  }

  function addDeck(deckId: string) {
    setSelectedDeckIds((current) => (current.includes(deckId) ? current : [...current, deckId]))
  }

  function removeDeck(deckId: string) {
    setSelectedDeckIds((current) => current.filter((id) => id !== deckId))
  }

  function handleSave() {
    onSaveDraft?.({
      title,
      description,
      image: coverImage,
      status,
      difficulty,
      deckIds: selectedDeckIds,
    })
  }

  return (
    <section className={styles.deckEditorPage}>
      <div className={styles.editorFrame}>
        <header className={styles.hero}>
          <Image src={coverImage} alt="" fill priority sizes="760px" className={styles.heroImage} />
          <span className={styles.heroShade} />
          <div className={styles.heroTop}>
            <Link href={backHref} className={styles.iconButton} aria-label="Back to guides">
              Back
            </Link>
            <div className={styles.heroActions}>
              <FeatureGuideLauncher
                guides={featureGuides}
                label="Guide editor help"
                buttonClassName={styles.iconButton}
              />
              <button
                className={styles.saveButton}
                type="button"
                disabled={isSaving}
                onClick={handleSave}
              >
                <SaveIcon />
                {isSaving ? 'Saving...' : saveLabel}
              </button>
            </div>
          </div>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Guide Editor</p>
            <h1>{title || 'Untitled Guide'}</h1>
            <div className={styles.counters}>
              <span>{guide.likeCount ?? 0} likes</span>
              <span>{guide.saveCount ?? 0} saves</span>
            </div>
          </div>
        </header>

        <div className={styles.tabs} role="tablist" aria-label="Guide editor tabs">
          {(['details', 'decks', 'preview'] as GuideEditorTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              data-active={activeTab === tab}
              className={activeTab === tab ? styles.activeTab : styles.tab}
              onClick={() => setActiveTab(tab)}
            >
              {tab[0]?.toUpperCase()}{tab.slice(1)}
            </button>
          ))}
        </div>

        {activeTab === 'details' ? (
          <div className={styles.panelGrid}>
            <section className={styles.panel}>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Title</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>Difficulty</span>
                  <select
                    value={difficulty}
                    onChange={(event) => setDifficulty(event.target.value as GuideDifficulty)}
                  >
                    {difficultyOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Status</span>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as GuideStatus)}
                  >
                    {statusOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <div className={styles.field}>
                  <span>Decks</span>
                  <strong className={styles.statValue}>{selectedDecks.length}</strong>
                </div>
              </div>
              <label className={styles.descriptionPanel}>
                <span>Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={7}
                />
              </label>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Cover Image</h2>
                <span>From selected decks</span>
              </div>
              <div className={styles.galleryGrid}>
                {coverImageCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className={styles.galleryTile}
                    style={
                      coverImage === candidate.image
                        ? { borderColor: 'var(--og-brass-500)', boxShadow: '0 0 0 2px color-mix(in srgb, var(--og-brass-500) 42%, transparent)' }
                        : undefined
                    }
                    onClick={() => setCoverImage(candidate.image)}
                  >
                    <Image src={candidate.image} alt="" fill sizes="120px" className="object-cover" />
                  </button>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === 'decks' ? (
          <section className={styles.panel}>
            <div className={styles.cardList}>
              {selectedDecks.map((deck) => (
                <article
                  key={deck.id}
                  className={[
                    styles.cardRow,
                    draggingDeckId === deck.id ? styles.cardRowDragging : '',
                    dropTarget?.id === deck.id && dropTarget.edge === 'before'
                      ? styles.cardRowDropBefore
                      : '',
                    dropTarget?.id === deck.id && dropTarget.edge === 'after'
                      ? styles.cardRowDropAfter
                      : '',
                  ].join(' ')}
                  draggable
                  onDragStart={(event) => {
                    setDraggingDeckId(deck.id)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', deck.id)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    const rect = event.currentTarget.getBoundingClientRect()
                    const edge =
                      event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                    setDropTarget({ id: deck.id, edge })
                    event.dataTransfer.dropEffect = 'move'
                  }}
                  onDragLeave={() => {
                    if (dropTarget?.id === deck.id) setDropTarget(null)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const draggedId = event.dataTransfer.getData('text/plain') || draggingDeckId
                    if (draggedId) {
                      reorderDeck(draggedId, deck.id, dropTarget?.edge ?? 'before')
                    }
                    setDraggingDeckId(null)
                    setDropTarget(null)
                  }}
                  onDragEnd={() => {
                    setDraggingDeckId(null)
                    setDropTarget(null)
                  }}
                >
                  <span
                    className={styles.dragHandle}
                    aria-label={`Drag to reorder ${deck.title}`}
                    title="Drag to reorder"
                  >
                    <DragHandleIcon />
                  </span>
                  <span className={styles.cardNumber} aria-hidden="true">
                    {selectedDeckIds.indexOf(deck.id) + 1}
                  </span>
                  <span className={styles.cardInfo}>
                    <span className={styles.cardTypeLabel}>{deck.category}</span>
                    <span className={styles.cardName}>{deck.title}</span>
                  </span>
                  <span className={styles.cardRowActions}>
                    <Link
                      href={`/guides/decks/${deck.id}?preview=1&edit=1`}
                      className={styles.editButton}
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      aria-label={`Remove ${deck.title} from guide`}
                      onClick={() => removeDeck(deck.id)}
                    >
                      x
                    </button>
                  </span>
                </article>
              ))}
            </div>
            <button
              type="button"
              className={styles.addCardButton}
              onClick={() => setIsAddDecksOpen(true)}
            >
              Add Decks
            </button>
          </section>
        ) : null}

        {activeTab === 'preview' ? (
          <GuidePreview selectedDeckIds={selectedDeckIds} deckDetailById={deckDetailById} />
        ) : null}

        {saveError ? <p className={styles.saveError}>{saveError}</p> : null}
      </div>

      {isAddDecksOpen ? (
        <AddDecksSheet
          decks={filteredPickableDecks}
          query={deckSearch}
          onAddDeck={(deckId) => {
            addDeck(deckId)
          }}
          onClose={() => {
            setIsAddDecksOpen(false)
            setDeckSearch('')
          }}
          onQueryChange={setDeckSearch}
        />
      ) : null}
    </section>
  )
}

function GuidePreview({
  selectedDeckIds,
  deckDetailById,
}: {
  selectedDeckIds: string[]
  deckDetailById: Map<string, GuidesV3DeckDetail>
}) {
  const decks = selectedDeckIds
    .map((id) => deckDetailById.get(id))
    .filter((deck): deck is GuidesV3DeckDetail => Boolean(deck))

  if (!decks.length) {
    return (
      <section className={styles.panel}>
        <p>Add a deck to preview its cards here. Newly added decks appear after you save.</p>
      </section>
    )
  }

  return (
    <section className={styles.previewStack} aria-label="Guide preview">
      {decks.map((deck) => (
        <DeckPreviewGroup key={deck.id} deck={deck} />
      ))}
    </section>
  )
}

function DeckPreviewGroup({ deck }: { deck: GuidesV3DeckDetail }) {
  const recipe = toRecipe(deck)
  const featuredImage = toFeaturedImage(deck)
  const paintCount = deck.paintList.length

  return (
    <>
      <div className={styles.previewShareMount}>
        <RecipeGuideCoverCard
          recipe={recipe}
          featuredImage={featuredImage}
          cardCount={deck.steps.length + 1}
          paintCount={paintCount}
        />
      </div>
      {deck.steps.map((step) => {
        const recipeStep = toRecipeStep(step)
        const paints = toRecipePaints(step)

        return (
          <div key={step.id} className={styles.previewShareMount}>
            {step.template === 'video' ? (
              <RecipeGuideVideoCard
                title={step.title}
                description={step.instructions}
                youtubeUrl={step.videoUrl}
              />
            ) : step.template === 'paints' ? (
              <RecipeGuidePaintsCard
                title={step.title}
                description={step.instructions}
                paints={paints}
              />
            ) : isThemeTemplateStep(step, recipeStep.image_url) ? (
              <RecipeGuideThemeStepCard
                step={recipeStep}
                stepsLength={deck.steps.length}
                paints={paints}
                fallbackImageUrl={deck.fullImage || deck.image}
              />
            ) : step.template === 'small-image' && isUsableImageUrl(recipeStep.image_url) ? (
              <RecipeGuideSmallImageStepCard
                step={recipeStep}
                stepsLength={deck.steps.length}
                paints={paints}
              />
            ) : isUsableImageUrl(recipeStep.image_url) ? (
              <RecipeGuideImageStepCard
                step={recipeStep}
                stepsLength={deck.steps.length}
                paints={paints}
              />
            ) : (
              <RecipeGuideDescriptiveStepCard
                step={recipeStep}
                stepsLength={deck.steps.length}
                paints={paints}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

function AddDecksSheet({
  decks,
  onAddDeck,
  onClose,
  onQueryChange,
  query,
}: {
  decks: GuidesV3Deck[]
  onAddDeck: (deckId: string) => void
  onClose: () => void
  onQueryChange: (query: string) => void
  query: string
}) {
  return (
    <div className={styles.sheetBackdrop} role="dialog" aria-modal="true">
      <section className={styles.sheet}>
        <header>
          <h2>Add Decks</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <label className={styles.field}>
          <span>Search your decks</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search your decks..."
          />
        </label>
        <div className={styles.cardList}>
          {decks.length ? (
            decks.map((deck) => (
              <article key={deck.id} className={styles.cardRow}>
                <span className={styles.cardNumber} aria-hidden="true" />
                <span className={styles.cardInfo}>
                  <span className={styles.cardTypeLabel}>{deck.category}</span>
                  <span className={styles.cardName}>{deck.title}</span>
                </span>
                <button
                  type="button"
                  className={styles.editButton}
                  onClick={() => onAddDeck(deck.id)}
                >
                  Add
                </button>
              </article>
            ))
          ) : (
            <p>No more decks to add.</p>
          )}
        </div>
      </section>
    </div>
  )
}

function DragHandleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <circle cx="9" cy="6" r="1.7" />
      <circle cx="9" cy="12" r="1.7" />
      <circle cx="9" cy="18" r="1.7" />
      <circle cx="15" cy="6" r="1.7" />
      <circle cx="15" cy="12" r="1.7" />
      <circle cx="15" cy="18" r="1.7" />
    </svg>
  )
}

function SaveIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={styles.buttonIcon}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  )
}
