'use client'

import { useEditorChanges } from '@/app/components/navigation-feedback/unsaved-changes'

import GuideBackButton from '@/app/guides/shared/guide-back-button'
import { useEditorTab } from '@/app/guides/shared/use-editor-tab'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import GalleryPager, { useGalleryPages } from '../../../components/gallery/gallery-pager'
import type { ChangeEvent, RefObject } from 'react'
import FeatureGuideLauncher from '../../../components/feature-guide-launcher'
import type { FeatureGuideEntry } from '../../../components/feature-guide-types'
import type { Recipe, RecipeImage, RecipeStep } from '../../shared/types'
import {
  RecipeGuideAltThemeStepCard,
  RecipeGuideCoverCard,
  RecipeGuideDescriptiveStepCard,
  RecipeGuideImageStepCard,
  RecipeGuidePaintsCard,
  RecipeGuideSmallImageStepCard,
  RecipeGuideThemeStepCard,
  RecipeGuideVideoCard,
} from '../../shared/recipe-guide-cards'
import { hasUnuploadedImage } from '../../shared/deck-save-values'
import type { GuidesV3DeckDetail } from '../../guides-v3-detail-data'
import styles from './deck-editor-client.module.css'
import { addableCardTypes, cardTypeDefaultBody, cardTypeLabel } from '../../shared/card-templates'
import { AddContentSheet, CardTypeSheet } from '../../shared/card-type-sheet'
import {
  CardEditorSheet,
  DragHandleIcon,
  cardEditingHandlers,
  editorCardFromStep,
  uploadDeckEditorImage,
  type CardEditorCard,
  type CardEditorPaint,
  type CardEditorTemplate,
} from '../../shared/card-editor-sheet'

type DeckEditorTab = 'details' | 'cards' | 'preview'
type DeckDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'
type DeckStatus = 'Draft' | 'Private' | 'Public'
export type DeckEditorCardTemplate = CardEditorTemplate
type CardTemplate = DeckEditorCardTemplate

export type DeckEditorSavePaint = CardEditorPaint

export type DeckEditorInitialCard = {
  paintAlignment?: 'left' | 'right'
  paintVerticalAlignment?: 'top' | 'center' | 'bottom'
  // Theme card kicker; empty means the default "Color Reference".
  subtitle?: string | null
  id: string
  title: string
  template: DeckEditorCardTemplate
  body: string
  image: string | null
  paints?: DeckEditorSavePaint[]
  videoUrl?: string | null
  imageFocalX?: number
  imageFocalY?: number
}

export type DeckEditorSavePayload = {
  title: string
  description: string
  difficulty: DeckDifficulty
  status: DeckStatus
  heroImage: string | null
  heroFocalX: number
  heroFocalY: number
  cards: DeckEditorInitialCard[]
  inventoryNotes: string
  expertTips: string
}

type EditorCard = CardEditorCard

type EditorImage = {
  id: string
  url: string
  alt: string
}

type DropTarget = {
  edge: 'before' | 'after'
  id: string
}

const difficultyOptions: DeckDifficulty[] = ['Beginner', 'Intermediate', 'Advanced']
const statusOptions: DeckStatus[] = ['Draft', 'Private', 'Public']
const addCardTemplateOptions: CardTemplate[] = addableCardTypes

function inferDifficulty(cardCount: number): DeckDifficulty {
  if (cardCount >= 8) return 'Advanced'
  if (cardCount >= 4) return 'Intermediate'
  return 'Beginner'
}

function initialDeckCards(deck: GuidesV3DeckDetail): EditorCard[] {
  const stepCards = deck.steps.map(editorCardFromStep)

  // Where the synthesized cover card belongs, if at all - undefined
  // defaults to 0 (cover first) for decks that predate this column, null
  // omits it. See app/guides/decks/[id]/page.tsx for the matching logic
  // used when rendering the live viewer.
  const rawCoverPosition = deck.coverPosition === undefined ? 0 : deck.coverPosition
  if (rawCoverPosition === null) return stepCards

  const coverPosition = Math.max(0, Math.min(rawCoverPosition, stepCards.length))
  const coverCard: EditorCard = {
    id: `${deck.id}:title`,
    title: deck.title,
    template: 'cover',
    body: deck.description,
    // Seed from the untransformed source image, not the list/grid
    // thumbnail rendition - otherwise saving without touching the cover
    // silently downgrades the deck's stored image to that small
    // thumbnail (see GuidesV3DeckDetail.fullImage).
    image: deck.fullImage ?? deck.image,
    paints: [],
    videoUrl: null,
    imageFocalX: deck.coverFocalX ?? 50,
    imageFocalY: deck.coverFocalY ?? 50,
  }

  return [
    ...stepCards.slice(0, coverPosition),
    coverCard,
    ...stepCards.slice(coverPosition),
  ]
}

function initialGallery(deck: GuidesV3DeckDetail): EditorImage[] {
  const images = [
    { id: `${deck.id}:cover`, url: deck.fullImage ?? deck.image, alt: deck.title },
    ...deck.steps
      .filter((step) => Boolean(step.rawImage ?? step.image))
      .map((step) => ({
        id: `${step.id}:image`,
        url: (step.rawImage ?? step.image) as string,
        alt: step.title,
      })),
  ]
  const seen = new Set<string>()

  return images.filter((image) => {
    if (seen.has(image.url)) return false
    seen.add(image.url)
    return true
  })
}

function isUsableImageUrl(value?: string | null) {
  const url = typeof value === 'string' ? value.trim() : ''
  return (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    (url.startsWith('/') && !url.startsWith('//')) ||
    url.startsWith('blob:') ||
    url.startsWith('data:image/')
  )
}

const templateLabel = (template: CardTemplate) => cardTypeLabel(template)

function makeNewCard(
  template: CardTemplate,
  index: number,
  deckPaints: GuidesV3DeckDetail['paintList']
): EditorCard {
  return {
    id: `new:${template}:${Date.now()}:${index}`,
    title: `${templateLabel(template)} Card`,
    template,
    body: cardTypeDefaultBody(template),
    image: null,
    paints:
      template === 'paints'
        ? deckPaints.map((paint) => ({
            id: paint.id,
            brand: paint.brand,
            line: paint.line,
            name: paint.name,
            hex_approx: paint.color,
            swatch_image_url: paint.swatchImageUrl,
            is_owned: paint.isOwned,
            is_wishlist: paint.isWishlist,
          }))
        : [],
    videoUrl: null,
    imageFocalX: 50,
    imageFocalY: 50,
  }
}

const editorTabs = ['details', 'cards', 'preview'] as const
// Decks and guides share one editor model; the tab ids stay put so existing
// ?editorTab= links keep working.
const editorTabLabels: Record<DeckEditorTab, string> = { details: 'Details', cards: 'Contents', preview: 'Preview' }
// Editing a guide's own cards (its inline deck): the guide's details live in
// the guide editor, so only the cards and their preview are shown here.
const inlineEditorTabs = ['cards', 'preview'] as const

export default function DeckEditorClient({
  backHref,
  deck,
  featureGuides,
  initialCards,
  initialInventoryNotes = '',
  initialExpertTips = '',
  inlineGuide,
  isSaving = false,
  onBack,
  openAddCard = false,
  openCardId,
  onExit,
  onDeleteDeck,
  onSaveDraft,
  saveError,
  saveLabel = 'Save',
}: {
  backHref: string
  deck: GuidesV3DeckDetail
  featureGuides: FeatureGuideEntry[]
  initialCards?: DeckEditorInitialCard[]
  initialInventoryNotes?: string
  initialExpertTips?: string
  // Set when these are a guide's own cards (recipes.inline_guide_id).
  inlineGuide?: { id: string; title: string }
  isSaving?: boolean
  onBack?: () => void
  // Open the new-card picker on arrival (+ Add > New Card in the guide editor).
  openAddCard?: boolean
  // Open this saved card's editor on arrival (Edit on a guide's direct card).
  openCardId?: string
  // Leave without saving (nothing changed in a single-card visit).
  onExit?: () => void
  onDeleteDeck?: () => Promise<void>
  onSaveDraft?: (payload: DeckEditorSavePayload) => void | Promise<boolean>
  onTogglePaintOwnership?: (formData: FormData) => void | Promise<void>
  saveError?: string | null
  saveLabel?: string
}) {
  const [activeTab, setActiveTab] = useEditorTab<DeckEditorTab>(inlineGuide ? 'cards' : 'details', inlineGuide ? inlineEditorTabs : editorTabs)
  const [title, setTitle] = useState(deck.title)
  const [description, setDescription] = useState(deck.description)
  const [inventoryNotes] = useState(initialInventoryNotes)
  const [expertTips] = useState(initialExpertTips)
  const [difficulty, setDifficulty] = useState<DeckDifficulty>(
    (deck.difficulty as DeckDifficulty) || inferDifficulty(deck.cards)
  )
  const [status, setStatus] = useState<DeckStatus>(deck.isPublic ? 'Public' : 'Private')
  const [cards, setCards] = useState<EditorCard[]>(() =>
    initialCards
      ? initialCards.map((card) => ({
          ...card,
          paints: card.paints ?? [],
          videoUrl: card.videoUrl ?? null,
          imageFocalX: card.imageFocalX ?? 50,
          imageFocalY: card.imageFocalY ?? 50,
        }))
      : initialDeckCards(deck)
  )
  const [gallery, setGallery] = useState<EditorImage[]>(() => initialGallery(deck))
  const [heroImageId, setHeroImageId] = useState(gallery[0]?.id ?? '')
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [galleryDropTarget, setGalleryDropTarget] = useState<DropTarget | null>(null)
  const [isEditingGallery, setIsEditingGallery] = useState(false)
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([])
  const [expandedImage, setExpandedImage] = useState<EditorImage | null>(null)
  const [editingCardId, setEditingCardId] = useState<string | null>(() =>
    openCardId && cards.some((card) => card.id === openCardId) ? openCardId : null
  )
  const [imageUploadError, setImageUploadError] = useState<string | null>(null)
  const [pendingImageUploads, setPendingImageUploads] = useState(0)
  const [isAddCardOpen, setIsAddCardOpen] = useState(openAddCard)
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const heroImage = useMemo(
    () => gallery.find((image) => image.id === heroImageId)?.url ?? deck.fullImage ?? deck.image,
    [deck.fullImage, deck.image, gallery, heroImageId]
  )
  const editingCard = cards.find((card) => card.id === editingCardId) ?? null
  const coverCard = cards.find((card) => card.template === 'cover')
  const isUploadingImages = pendingImageUploads > 0
  const saveChanges = useEditorChanges(JSON.stringify({ title, description, inventoryNotes, expertTips, difficulty, status, cards, gallery, heroImageId }), isSaving || isUploadingImages)

  function reorderCard(cardId: string, targetId: string, edge: DropTarget['edge']) {
    if (cardId === targetId) return
    setCards((current) => {
      const fromIndex = current.findIndex((card) => card.id === cardId)
      const toIndex = current.findIndex((card) => card.id === targetId)
      if (fromIndex < 0 || toIndex < 0) return current
      const next = [...current]
      const [moved] = next.splice(fromIndex, 1)
      if (!moved) return current
      const targetOffset = edge === 'after' ? 1 : 0
      const adjustedIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
      next.splice(adjustedIndex + targetOffset, 0, moved)
      return next
    })
  }

  function syncCoverImage(url: string | null) {
    setCards((current) =>
      current.map((card) => (card.template === 'cover' ? { ...card, image: url } : card))
    )
  }

  function selectHeroImage(image: EditorImage) {
    setHeroImageId(image.id)
    syncCoverImage(image.url)
  }

  function updateActiveCard(update: Partial<EditorCard>) {
    if (editingCard?.template === 'cover') {
      if (typeof update.title === 'string') setTitle(update.title)
      if (typeof update.body === 'string') setDescription(update.body)
    }
    updateEditingCard(update)
  }

  const {
    addEditingCardPaint,
    deleteEditingCardPaint,
    selectEditingCardPaint,
    updateEditingCard,
    updateEditingCardImage,
    updateEditingCardPaint,
  } = cardEditingHandlers({ editingCard, editingCardId, setCards, setImageUploadError, setPendingImageUploads })

  function deleteEditingCard() {
    if (!editingCardId) return
    // A deck must always show at least one card. The cover card is no
    // longer special-cased here - it can be deleted like any other card,
    // same as it can now be added, removed, or reordered relative to the
    // steps (see initialDeckCards/handleSave's cover-position handling).
    if (cards.length <= 1) return
    setCards((current) => current.filter((card) => card.id !== editingCardId))
    setEditingCardId(null)
  }

  function addCard(template: CardTemplate) {
    const nextCard = makeNewCard(template, cards.length + 1, deck.paintList)
    // A re-added cover card should reflect the deck's current title and
    // description right away, not generic placeholder text - those fields
    // (not this card's own text) are what actually gets saved.
    if (template === 'cover') {
      nextCard.title = title
      nextCard.body = description
      nextCard.image = heroImage
    }
    setCards((current) => [...current, nextCard])
    setEditingCardId(nextCard.id)
    setIsAddCardOpen(false)
  }

  // Arriving from a guide's Contents to add or edit one card: closing the card
  // sheet ends the visit - saving if anything changed - instead of leaving the
  // creator in this editor's card list.
  const isSingleCardVisit = Boolean(inlineGuide && onExit && (openCardId || openAddCard))
  const [cardsOnArrival] = useState(() => JSON.stringify(cards))
  const finishSingleCardVisit = useRef<() => void>(() => {})
  finishSingleCardVisit.current = () => {
    if (JSON.stringify(cards) !== cardsOnArrival) handleSave()
    else onExit?.()
  }
  const previousSheet = useRef<{ editing: string | null; adding: boolean } | null>(null)
  useEffect(() => {
    const previous = previousSheet.current
    previousSheet.current = { editing: editingCardId, adding: isAddCardOpen }
    if (!isSingleCardVisit || !previous || editingCardId || isAddCardOpen) return
    if (previous.editing || previous.adding) finishSingleCardVisit.current()
  }, [editingCardId, isAddCardOpen, isSingleCardVisit])

  function handleSave() {
    if (isUploadingImages) {
      setImageUploadError('Wait for the image upload to finish before saving.')
      return
    }

    if (hasUnuploadedImage(cards.map((card) => card.image))) {
      setImageUploadError('One or more photos have not finished uploading. Retry or remove them before saving.')
      return
    }

    void saveChanges(() => onSaveDraft?.({
      title,
      description,
      difficulty,
      status,
      heroImage: coverCard?.image ?? heroImage,
      heroFocalX: coverCard?.imageFocalX ?? 50,
      heroFocalY: coverCard?.imageFocalY ?? 50,
      inventoryNotes,
      expertTips,
      cards: cards.map((card) => ({
        id: card.id,
        title: card.title,
        template: card.template,
        body: card.body,
        image: card.image,
        paints: card.paints,
        videoUrl: card.videoUrl,
        imageFocalX: card.imageFocalX,
        imageFocalY: card.imageFocalY,
        paintAlignment: card.paintAlignment ?? 'left',
        paintVerticalAlignment: card.paintVerticalAlignment ?? 'top',
        subtitle: card.subtitle?.trim() || null,
      })),
    }))
  }

  async function addGalleryFiles(
    event: ChangeEvent<HTMLInputElement>,
    source: 'camera' | 'gallery'
  ) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return

    const pendingUploads = files.map((file, index) => ({
      id: `${source}:${Date.now()}:${index}:${file.name}`,
      url: URL.createObjectURL(file),
      alt: file.name,
      file,
    }))
    const previousHeroId = heroImageId
    const previousHeroUrl = gallery.find((image) => image.id === previousHeroId)?.url ?? null
    const wasGalleryEmpty = !heroImageId
    const firstNewImage = pendingUploads[0]

    setGallery((current) => [
      ...current,
      ...pendingUploads.map(({ id, url, alt }) => ({ id, url, alt })),
    ])
    if (wasGalleryEmpty && firstNewImage) {
      setHeroImageId(firstNewImage.id)
      syncCoverImage(firstNewImage.url)
    }

    setImageUploadError(null)
    setPendingImageUploads((count) => count + pendingUploads.length)

    await Promise.all(
      pendingUploads.map(async ({ id, url, file }) => {
        try {
          const uploadedUrl = await uploadDeckEditorImage(file)
          setGallery((current) =>
            current.map((image) => (image.id === id ? { ...image, url: uploadedUrl } : image))
          )
          setHeroImageId((currentHeroId) => {
            if (currentHeroId === id) syncCoverImage(uploadedUrl)
            return currentHeroId
          })
        } catch (error) {
          setGallery((current) => current.filter((image) => image.id !== id))
          setHeroImageId((currentHeroId) => {
            if (currentHeroId !== id) return currentHeroId
            syncCoverImage(previousHeroUrl)
            return previousHeroId
          })
          setImageUploadError(
            error instanceof Error ? error.message : 'Could not upload image.'
          )
        } finally {
          URL.revokeObjectURL(url)
          setPendingImageUploads((count) => Math.max(0, count - 1))
        }
      })
    )
  }

  function toggleImageSelection(imageId: string) {
    setSelectedImageIds((current) =>
      current.includes(imageId)
        ? current.filter((id) => id !== imageId)
        : [...current, imageId]
    )
  }

  function deleteSelectedImages() {
    const next = gallery.filter((image) => !selectedImageIds.includes(image.id))
    if (!next.some((image) => image.id === heroImageId)) {
      const fallbackHero = next[0] ?? null
      setHeroImageId(fallbackHero?.id ?? '')
      syncCoverImage(fallbackHero?.url ?? null)
    }
    setGallery(next)
    setSelectedImageIds([])
    setIsEditingGallery(false)
  }

  function reorderGalleryImage(imageId: string, targetId: string, edge: DropTarget['edge']) {
    if (imageId === targetId) return
    setGallery((current) => {
      const fromIndex = current.findIndex((image) => image.id === imageId)
      const toIndex = current.findIndex((image) => image.id === targetId)
      if (fromIndex < 0 || toIndex < 0) return current
      const next = [...current]
      const [moved] = next.splice(fromIndex, 1)
      if (!moved) return current
      const targetOffset = edge === 'after' ? 1 : 0
      const adjustedIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
      next.splice(adjustedIndex + targetOffset, 0, moved)
      return next
    })
  }

  return (
    <section className={styles.deckEditorPage}>
      <div className={styles.editorFrame}>
        <header className={styles.hero}>
          <Image src={heroImage} alt="" fill priority sizes="760px" className={styles.heroImage} />
          <span className={styles.heroShade} />
          <div className={styles.heroTop}>
            {onBack ? (
              <button
                type="button"
                className={styles.iconButton}
                aria-label="Back to guides"
                onClick={onBack}
              >
                Back
              </button>
            ) : (
              <GuideBackButton fallbackHref={backHref} className={styles.iconButton} />
            )}
            <div className={styles.heroActions}>
              <FeatureGuideLauncher
                guides={featureGuides}
                label="Deck editor help"
                buttonClassName={styles.iconButton}
              />
              <button
                className={styles.saveButton}
                type="button"
                disabled={isSaving || isUploadingImages}
                onClick={handleSave}
              >
                <SaveIcon />
                {isSaving ? 'Saving...' : isUploadingImages ? 'Uploading...' : saveLabel}
              </button>
            </div>
          </div>
          <div className={styles.heroContent}>
            <p className={styles.eyebrow}>Guide Editor</p>
            <h1>{inlineGuide ? inlineGuide.title : title || 'Untitled Guide'}</h1>
            {inlineGuide ? (
              <div className={styles.counters}>
                <span>Cards in this guide</span>
              </div>
            ) : (
              <div className={styles.counters}>
                <span>{deck.likeCount ?? 0} likes</span>
                <span>{deck.saveCount ?? 0} saves</span>
              </div>
            )}
          </div>
        </header>

        <div className={styles.tabs} role="tablist" aria-label="Deck editor tabs">
          {(inlineGuide ? inlineEditorTabs : editorTabs).map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              data-active={activeTab === tab}
              data-deck-editor-tab={tab}
              className={activeTab === tab ? styles.activeTab : styles.tab}
              onClick={() => setActiveTab(tab)}
            >
              {editorTabLabels[tab]}
            </button>
          ))}
        </div>

        {activeTab === 'details' ? (
          <div className={styles.panelGrid}>
            <section className={styles.panel}>
              <div className={styles.formGrid}>
                <label className={`${styles.field} ${styles.fullWidthField}`}>
                  <span>Title</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} />
                </label>
                <label className={styles.field}>
                  <span>Difficulty</span>
                  <select
                    value={difficulty}
                    onChange={(event) => setDifficulty(event.target.value as DeckDifficulty)}
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
                    onChange={(event) => setStatus(event.target.value as DeckStatus)}
                  >
                    {statusOptions.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                </label>
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


            <DeckGallery
              cameraInputRef={cameraInputRef}
              draggingImageId={draggingImageId}
              dropTarget={galleryDropTarget}
              galleryInputRef={galleryInputRef}
              heroImageId={heroImageId}
              images={gallery}
              isEditing={isEditingGallery}
              selectedImageIds={selectedImageIds}
              onAddFiles={addGalleryFiles}
              onClearSelection={() => setSelectedImageIds([])}
              onDeleteSelected={deleteSelectedImages}
              onExpandImage={setExpandedImage}
              onReorderImage={reorderGalleryImage}
              onSetDraggingImageId={setDraggingImageId}
              onSetDropTarget={setGalleryDropTarget}
              onSetHeroImage={selectHeroImage}
              onToggleEdit={() => {
                setIsEditingGallery((current) => !current)
                setSelectedImageIds([])
              }}
              onToggleSelection={toggleImageSelection}
            />

            {onDeleteDeck ? <DeckDeleteFailsafe onDelete={onDeleteDeck} /> : null}
          </div>
        ) : null}

        {activeTab === 'cards' ? (
          <section className={styles.panel}>
            <div className={styles.cardList}>
              {cards.map((card) => (
                <div
                  key={card.id}
                  className={[
                    styles.guideCardRow,
                    styles.topLevelCardRow,
                    draggingCardId === card.id ? styles.cardRowDragging : '',
                    dropTarget?.id === card.id && dropTarget.edge === 'before'
                      ? styles.cardRowDropBefore
                      : '',
                    dropTarget?.id === card.id && dropTarget.edge === 'after'
                      ? styles.cardRowDropAfter
                      : '',
                  ].join(' ')}
                  draggable
                  onDragStart={(event) => {
                    setDraggingCardId(card.id)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', card.id)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    const rect = event.currentTarget.getBoundingClientRect()
                    const edge =
                      event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                    setDropTarget({ id: card.id, edge })
                    event.dataTransfer.dropEffect = 'move'
                  }}
                  onDragLeave={() => {
                    if (dropTarget?.id === card.id) setDropTarget(null)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const draggedId = event.dataTransfer.getData('text/plain') || draggingCardId
                    if (draggedId) {
                      reorderCard(draggedId, card.id, dropTarget?.edge ?? 'before')
                    }
                    setDraggingCardId(null)
                    setDropTarget(null)
                  }}
                  onDragEnd={() => {
                    setDraggingCardId(null)
                    setDropTarget(null)
                  }}
                >
                  <span
                    className={styles.dragHandle}
                    aria-label={`Drag to reorder ${card.title}`}
                    title="Drag to reorder"
                  >
                    <DragHandleIcon />
                  </span>
                  <button type="button" className={styles.guideCardPreview} aria-hidden="true" tabIndex={-1} onClick={() => setEditingCardId(card.id)}>
                    <span className={styles.guideCardPreviewStage}>
                      <DeckPreviewCardNode card={card} cards={cards} deck={deck} description={description} heroImage={coverCard?.image ?? heroImage} status={status} title={title} />
                    </span>
                  </button>
                  <span className={styles.guideCardInfo}>
                    <span className={styles.cardTypeLabel}>{templateLabel(card.template)}</span>
                    <strong data-deck-card-title>{card.title}</strong>
                  </span>
                  <span className={styles.topLevelCardActions}>
                    <button
                      className={styles.visibilityButton}
                      type="button"
                      aria-label={`Edit ${card.title}`}
                      onClick={() => setEditingCardId(card.id)}
                    >
                      <RowEditIcon />Edit
                    </button>
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              className={styles.addCardButton}
              aria-haspopup="dialog"
              // A guide's own cards only take cards; a former deck gets the
              // same + Add choices as any guide.
              onClick={() => inlineGuide ? setIsAddCardOpen(true) : setIsAddMenuOpen(true)}
            >
              + Add
            </button>
          </section>
        ) : null}

        {activeTab === 'preview' ? (
          <DeckPreview
            cards={cards}
            deck={deck}
            description={description}
            heroImage={coverCard?.image ?? heroImage}
            status={status}
            title={title}
          />
        ) : null}

        {saveError || imageUploadError ? (
          <p className={styles.saveError}>{saveError ?? imageUploadError}</p>
        ) : null}
      </div>

      {editingCard ? (
        <CardEditorSheet
          canDelete={cards.length > 1}
          card={editingCard}
          deckPaints={deck.paintList}
          onAddPaint={addEditingCardPaint}
          onChange={updateActiveCard}
          onChangeImage={updateEditingCardImage}
          onChangePaint={updateEditingCardPaint}
          onClose={() => setEditingCardId(null)}
          onDelete={deleteEditingCard}
          onDeletePaint={deleteEditingCardPaint}
          onSelectPaint={selectEditingCardPaint}
        />
      ) : null}

      {isAddCardOpen ? (
        <CardTypeSheet
          // Only one cover card at a time; a guide's own cards never have one.
          templates={inlineGuide || cards.some((card) => card.template === 'cover')
            ? addCardTemplateOptions.filter((template) => template !== 'cover')
            : addCardTemplateOptions}
          guideIndex={inlineGuide ? undefined : {
            disabled: true,
            note: 'Lists the guides inside - available once this deck is upgraded to a full guide.',
            onAdd: () => {},
          }}
          onAddCard={addCard}
          onClose={() => setIsAddCardOpen(false)}
        />
      ) : null}

      {isAddMenuOpen ? (
        <AddContentSheet
          options={[
            { key: 'card', kind: 'Card', title: 'New Card', note: 'Add a card to this guide.' },
            { key: 'existing', kind: 'Guide', title: 'Existing Guide', note: 'Available once this deck is upgraded to a full guide.', disabled: true },
            { key: 'new', kind: 'Guide', title: 'New Guide', note: 'Available once this deck is upgraded to a full guide.', disabled: true },
          ]}
          onChoose={(key) => {
            setIsAddMenuOpen(false)
            if (key === 'card') setIsAddCardOpen(true)
          }}
          onClose={() => setIsAddMenuOpen(false)}
        />
      ) : null}

      {expandedImage ? (
        <div
          className={styles.imageLightbox}
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setExpandedImage(null)
          }}
        >
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={() => setExpandedImage(null)}
          >
            Close
          </button>
          <div className={styles.lightboxImage}>
            <Image
              src={expandedImage.url}
              alt={expandedImage.alt}
              width={1200}
              height={1200}
              sizes="100vw"
              unoptimized
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}

function DeckGallery({
  cameraInputRef,
  draggingImageId,
  dropTarget,
  galleryInputRef,
  heroImageId,
  images,
  isEditing,
  onAddFiles,
  onClearSelection,
  onDeleteSelected,
  onExpandImage,
  onReorderImage,
  onSetDraggingImageId,
  onSetDropTarget,
  onSetHeroImage,
  onToggleEdit,
  onToggleSelection,
  selectedImageIds,
}: {
  cameraInputRef: RefObject<HTMLInputElement | null>
  draggingImageId: string | null
  dropTarget: DropTarget | null
  galleryInputRef: RefObject<HTMLInputElement | null>
  heroImageId: string
  images: EditorImage[]
  isEditing: boolean
  onAddFiles: (event: ChangeEvent<HTMLInputElement>, source: 'camera' | 'gallery') => void
  onClearSelection: () => void
  onDeleteSelected: () => void
  onExpandImage: (image: EditorImage) => void
  onReorderImage: (imageId: string, targetId: string, edge: DropTarget['edge']) => void
  onSetDraggingImageId: (imageId: string | null) => void
  onSetDropTarget: (target: DropTarget | null) => void
  onSetHeroImage: (image: EditorImage) => void
  onToggleEdit: () => void
  onToggleSelection: (imageId: string) => void
  selectedImageIds: string[]
}) {
  const [isAddImageOpen, setIsAddImageOpen] = useState(false)
  const pages = useGalleryPages(images)
  const previousImageCount = useRef(images.length)

  // Page to newly added images so the upload is visible.
  useEffect(() => {
    if (images.length > previousImageCount.current) {
      pages.showItemAt(previousImageCount.current)
    }
    previousImageCount.current = images.length
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.length])

  return (
    <section className={styles.galleryPanel}>
      <div className={styles.galleryHeader}>
        <div>
          <h2>Gallery</h2>
          <p>{images.length} images - reference and hero artwork</p>
        </div>
        <div className={styles.galleryActions}>
          <div className={styles.addImageMenu}>
            <button
              type="button"
              className={styles.addImageButton}
              aria-haspopup="menu"
              aria-expanded={isAddImageOpen}
              onClick={() => setIsAddImageOpen((current) => !current)}
            >
              Add Image
            </button>
            {isAddImageOpen ? (
              <>
                <button
                  type="button"
                  className={styles.addImageBackdrop}
                  aria-label="Close add image menu"
                  onClick={() => setIsAddImageOpen(false)}
                />
                <div className={styles.addImageChoices} role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAddImageOpen(false)
                      galleryInputRef.current?.click()
                    }}
                  >
                    From Gallery
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAddImageOpen(false)
                      cameraInputRef.current?.click()
                    }}
                  >
                    From Camera
                  </button>
                </div>
              </>
            ) : null}
          </div>
          <button type="button" className={styles.galleryEditToggle} onClick={onToggleEdit}>
            {isEditing ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className={styles.hiddenInput}
        onChange={(event) => onAddFiles(event, 'gallery')}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className={styles.hiddenInput}
        onChange={(event) => onAddFiles(event, 'camera')}
      />

      {isEditing ? (
        <div className={styles.gallerySelectionBar}>
          <span>
            {selectedImageIds.length
              ? `${selectedImageIds.length} selected`
              : 'Select images to delete or drag to reorder'}
          </span>
          <div>
            {selectedImageIds.length ? (
              <button type="button" onClick={onClearSelection}>
                Clear
              </button>
            ) : null}
            {selectedImageIds.length ? (
              <button type="button" onClick={onDeleteSelected}>
                Delete
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={styles.galleryGrid} {...pages.swipeHandlers}>
        {pages.pageItems.map((image) => {
          const isHero = image.id === heroImageId
          const isSelected = selectedImageIds.includes(image.id)

          return (
            <article
              key={image.id}
              className={[
                styles.galleryTile,
                draggingImageId === image.id ? styles.galleryTileDragging : '',
                dropTarget?.id === image.id && dropTarget.edge === 'before'
                  ? styles.galleryDropBefore
                  : '',
                dropTarget?.id === image.id && dropTarget.edge === 'after'
                  ? styles.galleryDropAfter
                  : '',
              ].join(' ')}
              draggable={isEditing}
              onDragStart={(event) => {
                if (!isEditing) return
                onSetDraggingImageId(image.id)
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData('text/plain', image.id)
              }}
              onDragOver={(event) => {
                if (!isEditing) return
                event.preventDefault()
                const rect = event.currentTarget.getBoundingClientRect()
                const edge =
                  event.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
                onSetDropTarget({ id: image.id, edge })
                event.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(event) => {
                if (!isEditing) return
                event.preventDefault()
                const draggedId = event.dataTransfer.getData('text/plain') || draggingImageId
                if (draggedId) {
                  onReorderImage(draggedId, image.id, dropTarget?.edge ?? 'before')
                }
                onSetDraggingImageId(null)
                onSetDropTarget(null)
              }}
              onDragEnd={() => {
                onSetDraggingImageId(null)
                onSetDropTarget(null)
              }}
            >
              {isEditing ? (
                <label className={styles.galleryCheckbox}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelection(image.id)}
                    aria-label={`Select ${image.alt}`}
                  />
                </label>
              ) : null}
              <button
                type="button"
                className={styles.galleryImageButton}
                onClick={() => onExpandImage(image)}
              >
                <Image src={image.url} alt={image.alt} fill sizes="132px" unoptimized />
              </button>
              <button
                type="button"
                className={isHero ? styles.heroBadge : styles.makeHeroButton}
                onClick={() => onSetHeroImage(image)}
              >
                {isHero ? 'Hero' : 'Hero'}
              </button>
            </article>
          )
        })}

        {pages.isLastPage && pages.pageItems.length < pages.pageSize ? (
          <button
            type="button"
            className={styles.galleryUploadTile}
            onClick={() => galleryInputRef.current?.click()}
          >
            Add Image
          </button>
        ) : null}
      </div>

      <GalleryPager page={pages.page} pageCount={pages.pageCount} onPageChange={pages.goToPage} />
    </section>
  )
}

type DeckDeleteStage = 'idle' | 'armed' | 'confirming'

function DeckDeleteFailsafe({ onDelete }: { onDelete: () => Promise<void> }) {
  const [stage, setStage] = useState<DeckDeleteStage>('idle')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function reset() {
    if (isDeleting) return
    setStage('idle')
    setDeleteError(null)
  }

  async function confirmDelete() {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await onDelete()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Could not delete deck.')
      setIsDeleting(false)
    }
  }

  return (
    <section className={styles.deletePanel} data-deck-editor="delete-deck">
      <div className={styles.deletePanelCopy}>
        <p className={styles.deleteEyebrow}>Danger Zone</p>
        <p>Removes this deck with its cards, paints, and gallery images.</p>
      </div>
      <button
        type="button"
        className={styles.deleteDeckButton}
        data-delete-armed={stage !== 'idle' ? 'true' : 'false'}
        onClick={() => setStage((current) => (current === 'idle' ? 'armed' : 'confirming'))}
      >
        {stage === 'idle' ? 'Delete Deck' : 'Press Again to Delete'}
      </button>

      {stage === 'confirming' ? (
        <div
          className={styles.deleteBackdrop}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="deck-delete-title"
          aria-describedby="deck-delete-description"
          onClick={(event) => {
            if (event.target === event.currentTarget) reset()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') reset()
          }}
        >
          <section className={styles.deleteDialog}>
            <p className={styles.deleteEyebrow}>Confirm Deletion</p>
            <h2 id="deck-delete-title">Delete this deck?</h2>
            <p id="deck-delete-description">
              Deleting is permanent. The deck and all of its cards, paints, and gallery
              images will be removed and cannot be recovered.
            </p>
            {deleteError ? <p className={styles.saveError}>{deleteError}</p> : null}
            <div className={styles.deleteDialogActions}>
              <button
                type="button"
                className={styles.deleteCancelButton}
                disabled={isDeleting}
                onClick={reset}
                autoFocus
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.deleteConfirmButton}
                disabled={isDeleting}
                onClick={confirmDelete}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

type DeckPreviewProps = {
  cards: EditorCard[]
  deck: GuidesV3DeckDetail
  description: string
  heroImage: string
  status: DeckStatus
  title: string
}

function DeckPreview(props: DeckPreviewProps) {
  return (
    <section className={styles.previewStack} aria-label="Deck preview">
      {props.cards.map((card) => (
        <div key={card.id} className={styles.previewShareMount}>
          <DeckPreviewCardNode card={card} {...props} />
        </div>
      ))}
    </section>
  )
}

function DeckPreviewCardNode({
  card,
  cards,
  deck,
  description,
  heroImage,
  status,
  title,
}: DeckPreviewProps & { card: EditorCard }) {
  return renderDeckPreviewCard({ card, cards, deck, description, heroImage, status, title })
}

function renderDeckPreviewCard({
  card,
  cards,
  deck,
  description,
  heroImage,
  status,
  title,
}: {
  card: EditorCard
  cards: EditorCard[]
  deck: GuidesV3DeckDetail
  description: string
  heroImage: string
  status: DeckStatus
  title: string
}) {
  const recipe: Recipe = {
    id: deck.id,
    name: title || 'Untitled Deck',
    description,
    inventory_required: null,
    expert_tips: null,
    youtube_url: null,
    is_public: status === 'Public',
  }
  const previewCoverCard = cards.find((card) => card.template === 'cover')
  const featuredImage: RecipeImage | null = isUsableImageUrl(heroImage)
    ? {
        id: `${deck.id}:hero`,
        image_url: heroImage,
        is_featured: true,
        alt_text: title,
        focal_x: previewCoverCard?.imageFocalX ?? 50,
        focal_y: previewCoverCard?.imageFocalY ?? 50,
      }
    : null
  // Render every card in its actual editor order, cover included wherever
  // it sits (or omitted entirely if the owner removed it) - this must
  // match what the live viewer will actually show, not force the cover
  // to always lead.
  const stepCards = cards.filter((card) => card.template !== 'cover')

  {
        if (card.template === 'cover') {
          return (
            <>
              <RecipeGuideCoverCard
                recipe={recipe}
                featuredImage={featuredImage}
                cardCount={cards.length}
                paintCount={deck.paintList.length}
              />
            </>
          )
        }

        const step: RecipeStep = {
          id: card.id,
          step_number: stepCards.indexOf(card) + 1,
          title: card.title,
          instructions: card.body,
          image_url: card.image,
          image_focal_x: card.imageFocalX,
          image_focal_y: card.imageFocalY,
          paint_alignment: card.paintAlignment ?? 'left',
          paint_vertical_alignment: card.paintVerticalAlignment ?? 'top',
          subtitle: card.subtitle ?? null,
        }

        return (
          <>
            {card.template === 'paints' ? (
              <RecipeGuidePaintsCard
                title={card.title}
                description={card.body}
                paints={card.paints}
              />
            ) : card.template === 'video' ? (
              <RecipeGuideVideoCard
                title={card.title}
                description={card.body}
                youtubeUrl={card.videoUrl}
              />
            ) : card.template === 'theme' ? (
              <RecipeGuideThemeStepCard
                step={step}
                stepsLength={stepCards.length}
                paints={card.paints}
                fallbackImageUrl={heroImage}
                fallbackFocalX={previewCoverCard?.imageFocalX ?? 50}
                fallbackFocalY={previewCoverCard?.imageFocalY ?? 50}
              />
            ) : card.template === 'theme-alt' ? (
              <RecipeGuideAltThemeStepCard
                step={step}
                stepsLength={stepCards.length}
                paints={card.paints}
                fallbackImageUrl={heroImage}
                fallbackFocalX={previewCoverCard?.imageFocalX ?? 50}
                fallbackFocalY={previewCoverCard?.imageFocalY ?? 50}
              />
            ) : card.template === 'small-image' && isUsableImageUrl(card.image) ? (
              <RecipeGuideSmallImageStepCard
                step={step}
                stepsLength={stepCards.length}
                paints={card.paints}
              />
            ) : isUsableImageUrl(card.image) ? (
              <RecipeGuideImageStepCard
                step={step}
                stepsLength={stepCards.length}
                paints={card.paints}
              />
            ) : (
              <RecipeGuideDescriptiveStepCard
                step={step}
                stepsLength={stepCards.length}
                paints={card.paints}
              />
            )}
          </>
        )
  }
}

function RowEditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
      <path d="m14 7 3 3" />
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
