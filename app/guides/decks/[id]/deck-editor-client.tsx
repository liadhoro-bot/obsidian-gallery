'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useRef, useState } from 'react'
import type { ChangeEvent, RefObject } from 'react'
import FeatureGuideLauncher from '../../../components/feature-guide-launcher'
import type { FeatureGuideEntry } from '../../../components/feature-guide-types'
import type { Recipe, RecipeImage, RecipeStep } from '../../../recipes/[id]/components/types'
import {
  RecipeGuideCoverCard,
  RecipeGuideDescriptiveStepCard,
  RecipeGuideImageStepCard,
  RecipeGuidePaintsCard,
  RecipeGuideVideoCard,
} from '../../../recipes/[id]/components/recipe-guide-cards'
import PaintPickerDialog, {
  type PaintPickerPaint,
} from '../../../../components/paints/paint-picker-dialog'
import type { GuidesV3DeckDetail } from '../../guides-v3-detail-data'
import styles from './deck-editor-client.module.css'

type DeckEditorTab = 'details' | 'cards' | 'preview'
type DeckDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'
type DeckStatus = 'Draft' | 'Private' | 'Public'
export type DeckEditorCardTemplate = 'cover' | 'step' | 'theme' | 'image' | 'paints' | 'video'
type CardTemplate = DeckEditorCardTemplate

export type DeckEditorSavePaint = {
  id: string
  brand: string | null
  line: string | null
  name: string | null
  hex_approx: string | null
  swatch_image_url: string | null
  ratio_text?: string | null
  is_owned?: boolean
  is_wishlist?: boolean
  source?: 'catalog' | 'custom'
}

export type DeckEditorInitialCard = {
  id: string
  title: string
  template: DeckEditorCardTemplate
  body: string
  image: string | null
  paints?: DeckEditorSavePaint[]
  videoUrl?: string | null
}

export type DeckEditorSavePayload = {
  title: string
  description: string
  difficulty: DeckDifficulty
  status: DeckStatus
  heroImage: string | null
  cards: DeckEditorInitialCard[]
}

type EditorCard = {
  id: string
  title: string
  template: CardTemplate
  body: string
  image: string | null
  paints: PreviewPaint[]
  videoUrl: string | null
}

type EditorImage = {
  id: string
  url: string
  alt: string
}

type PreviewPaint = DeckEditorSavePaint

type DropTarget = {
  edge: 'before' | 'after'
  id: string
}

const difficultyOptions: DeckDifficulty[] = ['Beginner', 'Intermediate', 'Advanced']
const statusOptions: DeckStatus[] = ['Draft', 'Private', 'Public']
const cardTemplateOptions: CardTemplate[] = ['step', 'theme', 'image', 'paints', 'video']
const addCardTemplateOptions: CardTemplate[] = ['cover', 'step', 'theme', 'image', 'paints', 'video']

function inferDifficulty(cardCount: number): DeckDifficulty {
  if (cardCount >= 8) return 'Advanced'
  if (cardCount >= 4) return 'Intermediate'
  return 'Beginner'
}

function initialDeckCards(deck: GuidesV3DeckDetail): EditorCard[] {
  return [
    {
      id: `${deck.id}:title`,
      title: deck.title,
      template: 'cover',
      body: deck.description,
      image: deck.image,
      paints: [],
      videoUrl: null,
    },
    ...deck.steps.map((step) => ({
      id: step.id,
      title: step.title,
      template: step.image ? 'image' as const : 'step' as const,
      body: step.instructions,
      image: step.image,
      paints: step.paints.map((paint) => ({
        id: paint.id,
        brand: paint.brand,
        line: paint.line,
        name: paint.name,
        hex_approx: paint.color,
        swatch_image_url: paint.swatchImageUrl,
        ratio_text: paint.ratioText,
        is_owned: paint.isOwned,
        is_wishlist: paint.isWishlist,
      })),
      videoUrl: null,
    })),
  ]
}

function initialGallery(deck: GuidesV3DeckDetail): EditorImage[] {
  const images = [
    { id: `${deck.id}:cover`, url: deck.image, alt: deck.title },
    ...deck.steps
      .filter((step) => Boolean(step.image))
      .map((step) => ({
        id: `${step.id}:image`,
        url: step.image as string,
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

function getYoutubeVideoId(url: string | null) {
  if (!url) return null

  try {
    const parsed = new URL(url)

    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.replace('/', '') || null
    }

    if (parsed.hostname.includes('youtube.com')) {
      const watchId = parsed.searchParams.get('v')
      if (watchId) return watchId

      if (parsed.pathname.startsWith('/shorts/')) {
        return parsed.pathname.split('/')[2] || null
      }

      if (parsed.pathname.startsWith('/embed/')) {
        return parsed.pathname.split('/')[2] || null
      }
    }

    return null
  } catch {
    return null
  }
}

function getYoutubeEmbedUrl(url: string | null) {
  const id = getYoutubeVideoId(url)
  return id ? `https://www.youtube.com/embed/${id}` : null
}

function templateLabel(template: CardTemplate) {
  if (template === 'cover') return 'Cover'
  if (template === 'theme') return 'Theme'
  if (template === 'image') return 'Image'
  if (template === 'paints') return 'Paints'
  if (template === 'video') return 'Video'
  return 'Step'
}

function templateDescription(template: CardTemplate) {
  if (template === 'cover') return 'Deck title, hero image, and description'
  if (template === 'theme') return 'Palette intent, mood, and reference notes'
  if (template === 'image') return 'Image-first checkpoint or reference card'
  if (template === 'paints') return 'Deck paints and current ownership status'
  if (template === 'video') return 'YouTube walkthrough with a short caption'
  return 'Instruction, paints, ratios, and optional image'
}

function templateEditorSubtitle(template: CardTemplate) {
  if (template === 'cover') return 'Cover image, title, and deck description'
  if (template === 'paints') return 'Choose deck paints and show ownership status'
  if (template === 'video') return 'YouTube link and a short caption'
  return 'Step content, paints, ratios, and image'
}

function splitPaintId(paintId: string) {
  if (paintId.startsWith('catalog:')) {
    return { source: 'catalog' as const, id: paintId.slice('catalog:'.length) }
  }

  if (paintId.startsWith('custom:')) {
    return { source: 'custom' as const, id: paintId.slice('custom:'.length) }
  }

  return { source: 'catalog' as const, id: paintId }
}

function editorPaintToPickerPaint(paint: PreviewPaint | null): PaintPickerPaint | null {
  if (!paint?.id || paint.id.startsWith('paint:')) return null

  const paintRef = splitPaintId(paint.id)

  return {
    id: paintRef.id,
    source: paint.source ?? paintRef.source,
    name: paint.name,
    brand: paint.brand,
    line: paint.line,
    swatch_image_url: paint.swatch_image_url,
    hex: paint.hex_approx,
    hex_approx: paint.hex_approx,
    is_owned: Boolean(paint.is_owned),
    is_wishlist: Boolean(paint.is_wishlist),
  }
}

function deckPaintToPickerPaint(
  paint: GuidesV3DeckDetail['paintList'][number]
): PaintPickerPaint {
  const paintRef = splitPaintId(paint.id)

  return {
    id: paintRef.id,
    source: paintRef.source,
    name: paint.name,
    brand: paint.brand,
    line: paint.line,
    swatch_image_url: paint.swatchImageUrl,
    hex: paint.color,
    hex_approx: paint.color,
    is_owned: paint.isOwned,
    is_wishlist: paint.isWishlist,
  }
}

function pickerPaintToEditorPaint(
  paint: PaintPickerPaint,
  ratioText?: string | null
): PreviewPaint {
  return {
    id: `${paint.source}:${paint.id}`,
    source: paint.source,
    brand: paint.brand,
    line: paint.line,
    name: paint.name,
    hex_approx: paint.hex_approx ?? paint.hex ?? null,
    swatch_image_url: paint.swatch_image_url,
    ratio_text: ratioText ?? null,
    is_owned: Boolean(paint.is_owned),
    is_wishlist: Boolean(paint.is_wishlist),
  }
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

function CardTypeIcon({ template }: { template: CardTemplate }) {
  const label = templateLabel(template)

  return (
    <span className={styles.cardTypeIcon} aria-label={`${label} card`}>
      {label}
    </span>
  )
}

function makeNewCard(
  template: CardTemplate,
  index: number,
  deckPaints: GuidesV3DeckDetail['paintList']
): EditorCard {
  return {
    id: `new:${template}:${Date.now()}:${index}`,
    title: `${templateLabel(template)} Card`,
    template,
    body:
      template === 'cover'
        ? 'Describe the deck at a glance: subject, style, and promise.'
        : template === 'theme'
          ? 'Describe the palette, mood, finish, and visual intent.'
          : template === 'image'
            ? 'Add the visual checkpoint notes for this card.'
            : template === 'paints'
              ? 'The full palette for this deck, at a glance.'
              : template === 'video'
                ? 'Add a short caption for the video.'
                : 'Describe the painting action, timing, and result to check.',
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
  }
}

export default function DeckEditorClient({
  backHref,
  deck,
  featureGuides,
  initialCards,
  isSaving = false,
  onBack,
  onSaveDraft,
  saveError,
  saveLabel = 'Save',
}: {
  backHref: string
  deck: GuidesV3DeckDetail
  featureGuides: FeatureGuideEntry[]
  initialCards?: DeckEditorInitialCard[]
  isSaving?: boolean
  onBack?: () => void
  onSaveDraft?: (payload: DeckEditorSavePayload) => void
  saveError?: string | null
  saveLabel?: string
}) {
  const [activeTab, setActiveTab] = useState<DeckEditorTab>('details')
  const [title, setTitle] = useState(deck.title)
  const [description, setDescription] = useState(deck.description)
  const [difficulty, setDifficulty] = useState<DeckDifficulty>(
    inferDifficulty(deck.cards)
  )
  const [status, setStatus] = useState<DeckStatus>(deck.isPublic ? 'Public' : 'Private')
  const [cards, setCards] = useState<EditorCard[]>(() =>
    initialCards
      ? initialCards.map((card) => ({
          ...card,
          paints: card.paints ?? [],
          videoUrl: card.videoUrl ?? null,
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
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [isAddCardOpen, setIsAddCardOpen] = useState(false)
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const heroImage = useMemo(
    () => gallery.find((image) => image.id === heroImageId)?.url ?? deck.image,
    [deck.image, gallery, heroImageId]
  )
  const editingCard = cards.find((card) => card.id === editingCardId) ?? null
  const coverCard = cards.find((card) => card.template === 'cover')

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

  function updateEditingCard(update: Partial<EditorCard>) {
    if (!editingCardId) return
    setCards((current) =>
      current.map((card) =>
        card.id === editingCardId ? { ...card, ...update } : card
      )
    )
  }

  function updateActiveCard(update: Partial<EditorCard>) {
    if (editingCard?.template === 'cover') {
      if (typeof update.title === 'string') setTitle(update.title)
      if (typeof update.body === 'string') setDescription(update.body)
    }
    updateEditingCard(update)
  }

  function updateEditingCardPaint(
    paintIndex: number,
    patch: Partial<PreviewPaint>
  ) {
    if (!editingCardId) return
    setCards((current) =>
      current.map((card) => {
        if (card.id !== editingCardId) return card
        const paints = [...card.paints]
        const existing = paints[paintIndex] ?? {
          id: `paint:${Date.now()}:${paintIndex}`,
          brand: null,
          line: null,
          name: null,
          hex_approx: null,
          swatch_image_url: null,
          ratio_text: null,
        }
        paints[paintIndex] = { ...existing, ...patch }
        return { ...card, paints }
      })
    )
  }

  function addEditingCardPaint() {
    if (!editingCardId) return
    setCards((current) =>
      current.map((card) =>
        card.id === editingCardId &&
        (card.template === 'paints' || card.paints.length < 4)
          ? {
              ...card,
              paints: [
                ...card.paints,
                {
                  id: `paint:${Date.now()}:${card.paints.length}`,
                  brand: null,
                  line: null,
                  name: null,
                  hex_approx: null,
                  swatch_image_url: null,
                  ratio_text: null,
                },
              ],
            }
          : card
      )
    )
  }

  function deleteEditingCardPaint(paintIndex: number) {
    if (!editingCardId) return
    setCards((current) =>
      current.map((card) =>
        card.id === editingCardId
          ? {
              ...card,
              paints: card.paints.filter((_, index) => index !== paintIndex),
            }
          : card
      )
    )
  }

  function selectEditingCardPaint(
    paintIndex: number,
    selectedPaint: PaintPickerPaint | null
  ) {
    const existingRatio = editingCard?.paints[paintIndex]?.ratio_text ?? null
    updateEditingCardPaint(
      paintIndex,
      selectedPaint
        ? pickerPaintToEditorPaint(selectedPaint, existingRatio)
        : {
            id: `paint:${Date.now()}:${paintIndex}`,
            brand: null,
            line: null,
            name: null,
            hex_approx: null,
            swatch_image_url: null,
          }
    )
  }

  function updateEditingCardImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    updateEditingCard({
      image: url,
      template: editingCard?.template === 'cover' ? 'cover' : 'image',
    })
    event.target.value = ''
  }

  function deleteEditingCard() {
    if (!editingCardId) return
    if (editingCard?.template === 'cover') {
      setEditingCardId(null)
      return
    }
    setCards((current) => current.filter((card) => card.id !== editingCardId))
    setEditingCardId(null)
  }

  function addCard(template: CardTemplate) {
    const nextCard = makeNewCard(template, cards.length + 1, deck.paintList)
    setCards((current) => [...current, nextCard])
    setEditingCardId(nextCard.id)
    setIsAddCardOpen(false)
  }

  function handleSave() {
    onSaveDraft?.({
      title,
      description,
      difficulty,
      status,
      heroImage: coverCard?.image ?? heroImage,
      cards: cards.map((card) => ({
        id: card.id,
        title: card.title,
        template: card.template,
        body: card.body,
        image: card.image,
        paints: card.paints,
        videoUrl: card.videoUrl,
      })),
    })
  }

  function addGalleryFiles(event: ChangeEvent<HTMLInputElement>, source: 'camera' | 'gallery') {
    const files = Array.from(event.target.files ?? [])
    if (!files.length) return

    const nextImages = files.map((file, index) => ({
      id: `${source}:${Date.now()}:${index}:${file.name}`,
      url: URL.createObjectURL(file),
      alt: file.name,
    }))

    setGallery((current) => [...current, ...nextImages])
    if (!heroImageId && nextImages[0]) setHeroImageId(nextImages[0].id)
    event.target.value = ''
  }

  function toggleImageSelection(imageId: string) {
    setSelectedImageIds((current) =>
      current.includes(imageId)
        ? current.filter((id) => id !== imageId)
        : [...current, imageId]
    )
  }

  function deleteSelectedImages() {
    setGallery((current) => {
      const next = current.filter((image) => !selectedImageIds.includes(image.id))
      if (!next.some((image) => image.id === heroImageId)) {
        setHeroImageId(next[0]?.id ?? '')
      }
      return next
    })
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
              <Link href={backHref} className={styles.iconButton} aria-label="Back to guides">
                Back
              </Link>
            )}
            <div className={styles.heroActions}>
              <FeatureGuideLauncher
                guides={featureGuides}
                label="Deck editor help"
                buttonClassName={styles.iconButton}
              />
              {!deck.saved ? (
                <button className={styles.iconButton} type="button" aria-label="Favorite deck">
                  <HeartIcon />
                </button>
              ) : null}
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
            <p className={styles.eyebrow}>Deck Editor</p>
            <h1>{title || 'Untitled Deck'}</h1>
            <div className={styles.counters}>
              <span>{deck.usedIn} hearts</span>
              <span>{deck.saved ? 1 : 0} saves</span>
            </div>
          </div>
        </header>

        <div className={styles.tabs} role="tablist" aria-label="Deck editor tabs">
          {(['details', 'cards', 'preview'] as DeckEditorTab[]).map((tab) => (
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
                <div className={styles.field}>
                  <span>Cards</span>
                  <strong className={styles.statValue}>{cards.length}</strong>
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
              onSetHeroImage={setHeroImageId}
              onToggleEdit={() => {
                setIsEditingGallery((current) => !current)
                setSelectedImageIds([])
              }}
              onToggleSelection={toggleImageSelection}
            />
          </div>
        ) : null}

        {activeTab === 'cards' ? (
          <section className={styles.panel}>
            <div className={styles.cardList}>
              {cards.map((card, index) => (
                <article
                  key={card.id}
                  className={[
                    styles.cardRow,
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
                  <span className={styles.cardNumber} aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className={styles.cardInfo}>
                    <span className={styles.cardTypeLabel}>{templateLabel(card.template)}</span>
                    <span className={styles.cardName}>{card.title}</span>
                  </span>
                  <button
                    className={styles.editButton}
                    type="button"
                    onClick={() => setEditingCardId(card.id)}
                  >
                    Edit
                  </button>
                </article>
              ))}
            </div>
            <button
              type="button"
              className={styles.addCardButton}
              onClick={() => setIsAddCardOpen(true)}
            >
              Add New Card
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

        {saveError ? (
          <p className={styles.saveError}>{saveError}</p>
        ) : null}
      </div>

      {editingCard ? (
        <CardEditorSheet
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
        <AddCardSheet
          onAddCard={addCard}
          onClose={() => setIsAddCardOpen(false)}
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
  onSetHeroImage: (imageId: string) => void
  onToggleEdit: () => void
  onToggleSelection: (imageId: string) => void
  selectedImageIds: string[]
}) {
  const [isAddImageOpen, setIsAddImageOpen] = useState(false)

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

      <div className={styles.galleryGrid}>
        {images.map((image) => {
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
                onClick={() => onSetHeroImage(image.id)}
              >
                {isHero ? 'Hero' : 'Hero'}
              </button>
            </article>
          )
        })}

        <button
          type="button"
          className={styles.galleryUploadTile}
          onClick={() => galleryInputRef.current?.click()}
        >
          Add Image
        </button>
      </div>
    </section>
  )
}

function AddCardSheet({
  onAddCard,
  onClose,
}: {
  onAddCard: (template: CardTemplate) => void
  onClose: () => void
}) {
  return (
    <div className={styles.sheetBackdrop} role="dialog" aria-modal="true">
      <section className={styles.sheet}>
        <header>
          <h2>Add New Card</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <div className={styles.templateGrid}>
          {addCardTemplateOptions.map((template) => (
            <button
              key={template}
              type="button"
              className={styles.templateButton}
              onClick={() => onAddCard(template)}
            >
              <CardTypeIcon template={template} />
              <span>
                <strong>{templateLabel(template)} Card</strong>
                <small>{templateDescription(template)}</small>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function CardEditorSheet({
  card,
  deckPaints,
  onAddPaint,
  onChange,
  onChangeImage,
  onChangePaint,
  onClose,
  onDelete,
  onDeletePaint,
  onSelectPaint,
}: {
  card: EditorCard
  deckPaints: GuidesV3DeckDetail['paintList']
  onAddPaint: () => void
  onChange: (patch: Partial<EditorCard>) => void
  onChangeImage: (event: ChangeEvent<HTMLInputElement>) => void
  onChangePaint: (paintIndex: number, patch: Partial<PreviewPaint>) => void
  onClose: () => void
  onDelete: () => void
  onDeletePaint: (paintIndex: number) => void
  onSelectPaint: (paintIndex: number, paint: PaintPickerPaint | null) => void
}) {
  const isCover = card.template === 'cover'
  const isStepLike = card.template === 'step' || card.template === 'image' || card.template === 'theme'
  const isPaintsList = card.template === 'paints'
  const isVideo = card.template === 'video'
  const embedUrl = isVideo ? getYoutubeEmbedUrl(card.videoUrl) : null
  const initialPaints = useMemo(
    () => deckPaints.map(deckPaintToPickerPaint),
    [deckPaints]
  )

  return (
    <div className={styles.sheetBackdrop} role="dialog" aria-modal="true">
      <section className={styles.sheet}>
        <header>
          <span>
            <h2>Edit {templateLabel(card.template)} Card</h2>
            <p>{templateEditorSubtitle(card.template)}</p>
          </span>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>

        <label className={styles.field}>
          <span>{isCover ? 'Cover Title' : 'Title'}</span>
          <input
            value={card.title}
            onChange={(event) => onChange({ title: event.target.value })}
          />
        </label>

        {!isPaintsList && !isVideo ? (
          <section className={styles.cardImageEditor}>
            <div className={styles.cardImagePreview}>
              {card.image ? (
                <Image src={card.image} alt="" fill sizes="420px" unoptimized />
              ) : (
                <span>No image selected</span>
              )}
            </div>
            <div className={styles.cardImageActions}>
              <label>
                <input
                  type="file"
                  accept="image/*"
                  className={styles.hiddenInput}
                  onChange={onChangeImage}
                />
                From Gallery
              </label>
              <label>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className={styles.hiddenInput}
                  onChange={onChangeImage}
                />
                Camera
              </label>
            </div>
          </section>
        ) : null}

        {isVideo ? (
          <section className={styles.videoEditor}>
            <label className={styles.field}>
              <span>YouTube URL</span>
              <input
                type="url"
                value={card.videoUrl ?? ''}
                onChange={(event) => onChange({ videoUrl: event.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </label>
            {card.videoUrl?.trim() ? (
              embedUrl ? (
                <div className={styles.videoPreview}>
                  <iframe src={embedUrl} title="Video preview" allowFullScreen />
                </div>
              ) : (
                <p className={styles.videoPreviewError}>
                  Paste a valid YouTube link to see the preview.
                </p>
              )
            ) : null}
          </section>
        ) : null}

        {!isCover ? (
          <label className={styles.field}>
            <span>Card Type</span>
            <select
              value={card.template}
              onChange={(event) =>
                onChange({ template: event.target.value as CardTemplate })
              }
            >
              {cardTemplateOptions.map((template) => (
                <option key={template} value={template}>
                  {templateLabel(template)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className={styles.descriptionPanel}>
          <span>{isCover ? 'Description' : isPaintsList || isVideo ? 'Caption' : 'Instructions'}</span>
          <textarea
            value={card.body}
            onChange={(event) => onChange({ body: event.target.value })}
            rows={6}
          />
        </label>

        {isStepLike ? (
          <section className={styles.paintEditor}>
            <div className={styles.paintEditorHeader}>
              <h3>Paints & Ratios</h3>
              {card.paints.length < 4 ? (
                <button type="button" onClick={onAddPaint}>
                  Add Paint
                </button>
              ) : null}
            </div>
            {card.paints.length ? (
              <div className={styles.paintRows}>
                {card.paints.map((paint, index) => (
                  <div key={`${paint.id}:${index}`} className={styles.paintRow}>
                    <DeckPaintPickerField
                      initialPaints={initialPaints}
                      paint={paint}
                      onClearPaint={() => onSelectPaint(index, null)}
                      onSelectPaint={(selectedPaint) =>
                        onSelectPaint(index, selectedPaint)
                      }
                    />
                    <label>
                      <span>Ratio</span>
                      <input
                        value={paint.ratio_text ?? ''}
                        onChange={(event) =>
                          onChangePaint(index, { ratio_text: event.target.value })
                        }
                        placeholder="1:1"
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.paintDeleteButton}
                      onClick={() => onDeletePaint(index)}
                      aria-label={`Remove paint ${index + 1}`}
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button
                type="button"
                className={styles.emptyPaintButton}
                onClick={onAddPaint}
              >
                Add Paint
              </button>
            )}
          </section>
        ) : null}

        {isPaintsList ? (
          <section className={styles.paintEditor}>
            <div className={styles.paintEditorHeader}>
              <h3>Deck Paints</h3>
              <button type="button" onClick={onAddPaint}>
                Add Paint
              </button>
            </div>
            {card.paints.length ? (
              <div className={styles.paintRows}>
                {card.paints.map((paint, index) => (
                  <div key={`${paint.id}:${index}`} className={styles.paintsListRow}>
                    <DeckPaintPickerField
                      initialPaints={initialPaints}
                      paint={paint}
                      onClearPaint={() => onSelectPaint(index, null)}
                      onSelectPaint={(selectedPaint) =>
                        onSelectPaint(index, selectedPaint)
                      }
                    />
                    <span
                      className={
                        paint.is_owned
                          ? styles.ownershipBadgeOwned
                          : paint.is_wishlist
                            ? styles.ownershipBadgeWishlist
                            : styles.ownershipBadge
                      }
                    >
                      {paint.is_owned ? 'Owned' : paint.is_wishlist ? 'Wishlist' : 'Not Owned'}
                    </span>
                    <button
                      type="button"
                      className={styles.paintDeleteButton}
                      onClick={() => onDeletePaint(index)}
                      aria-label={`Remove paint ${index + 1}`}
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <button
                type="button"
                className={styles.emptyPaintButton}
                onClick={onAddPaint}
              >
                Add Paint
              </button>
            )}
          </section>
        ) : null}

        <div className={styles.sheetActions}>
          {!isCover ? (
            <button type="button" className={styles.dangerButton} onClick={onDelete}>
              Delete Card
            </button>
          ) : <span />}
          <button type="button" className={styles.saveButton} onClick={onClose}>
            Done
          </button>
        </div>
      </section>
    </div>
  )
}

function DeckPaintPickerField({
  initialPaints,
  onClearPaint,
  onSelectPaint,
  paint,
}: {
  initialPaints: PaintPickerPaint[]
  onClearPaint: () => void
  onSelectPaint: (paint: PaintPickerPaint) => void
  paint: PreviewPaint
}) {
  const [isOpen, setIsOpen] = useState(false)
  const selectedPaint = editorPaintToPickerPaint(paint)
  const paintLabel = [paint.brand, paint.line, paint.name].filter(Boolean).join(' / ')

  return (
    <div className={styles.paintPickerField}>
      <span className={styles.paintPickerLabel}>Paint</span>
      <button
        type="button"
        className={styles.paintPickerButton}
        onClick={() => setIsOpen(true)}
      >
        <span
          className={styles.paintPickerSwatch}
          style={{ backgroundColor: paint.hex_approx ?? 'var(--og-brass-500)' }}
        />
        <span className={styles.paintPickerCopy}>
          <strong>{paintLabel || 'No paint selected'}</strong>
          <small>{paintLabel ? 'Catalog paint' : 'Choose from paint catalog'}</small>
        </span>
        <span className={styles.paintPickerAction}>Choose</span>
      </button>
      {selectedPaint ? (
        <button
          type="button"
          className={styles.paintPickerClear}
          onClick={onClearPaint}
        >
          Clear
        </button>
      ) : null}
      <PaintPickerDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        title="Choose Paint"
        selectedPaint={selectedPaint}
        selectedPaintId={selectedPaint ? `${selectedPaint.source}:${selectedPaint.id}` : null}
        onSelectPaint={(nextPaint) => {
          onSelectPaint(nextPaint)
          setIsOpen(false)
        }}
        source="deck_card_editor"
        initialPaints={initialPaints}
      />
    </div>
  )
}

function DeckPreview({
  cards,
  deck,
  description,
  heroImage,
  status,
  title,
}: {
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
  const featuredImage: RecipeImage | null = isUsableImageUrl(heroImage)
    ? {
        id: `${deck.id}:hero`,
        image_url: heroImage,
        is_featured: true,
        alt_text: title,
      }
    : null
  const stepCards = cards.filter((card) => card.template !== 'cover')

  return (
    <section className={styles.previewStack} aria-label="Deck preview">
      <div className={styles.previewShareMount}>
        <RecipeGuideCoverCard
          recipe={recipe}
          featuredImage={featuredImage}
          stepCount={stepCards.length}
          paintCount={deck.paintList.length}
        />
      </div>
      {stepCards.map((card, index) => {
        const step: RecipeStep = {
          id: card.id,
          step_number: index + 1,
          title: card.title,
          instructions: card.body,
          image_url: card.image,
        }

        return (
          <div key={card.id} className={styles.previewShareMount}>
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
          </div>
        )
      })}
    </section>
  )
}

function HeartIcon() {
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
      <path d="M20.8 4.6c-1.8-1.7-4.7-1.6-6.4.2L12 7.2 9.6 4.8C7.9 3 5 2.9 3.2 4.6c-2 1.9-2.1 5.1-.2 7.1L12 21l9-9.3c1.9-2 1.8-5.2-.2-7.1Z" />
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
