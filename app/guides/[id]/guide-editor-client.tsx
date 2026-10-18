'use client'

import { useEditorChanges } from '@/app/components/navigation-feedback/unsaved-changes'

import GuideBackButton from '@/app/guides/shared/guide-back-button'
import { useEditorTab } from '@/app/guides/shared/use-editor-tab'
import { addInlineGuideCard, createDeckFromForge, deleteInlineGuideCard, loadGuideEditorDeck, updateInlineGuideCard } from '../actions'
import { AddContentSheet, CardTypeSheet } from '../shared/card-type-sheet'
import { CardEditorSheet, cardEditingHandlers, editorCardFromStep, type CardEditorCard } from '../shared/card-editor-sheet'
import { hasUnuploadedImage } from '../shared/deck-save-values'
import { addableCardTypes, cardTypeLabel, isCardTypeId, type CardTypeId } from '../shared/card-templates'

import Image from 'next/image'
import { useMemo, useState, type DragEvent, type ReactNode } from 'react'
import { guideCardNodes } from '../shared/deck-card-entries'
import { flattenGuideContentItems, newGuideCoverCardId, newGuideIndexCardId, guideCardKey, guideContentItems, isGuideCoverCard, isGuideIndexCard, isGuideOwnedCard, resolveGuideCards, type GuideCardPlacement, type GuideContentItem } from '../shared/guide-card-layout'
import { GuideCardNavigationContext } from '../shared/guide-card-navigation'
import { MAX_GUIDE_TAGS, normalizeGuideTag, normalizeGuideTags } from '../shared/guide-tags'
import FeatureGuideLauncher from '../../components/feature-guide-launcher'
import GalleryPager, { useGalleryPages } from '../../components/gallery/gallery-pager'
import type { FeatureGuideEntry } from '../../components/feature-guide-types'
import type { GuidesV3Deck } from '../guides-v3-data'
import type { GuidesV3DeckDetail, GuidesV3GuideDetail } from '../guides-v3-detail-data'
import styles from '../decks/[id]/deck-editor-client.module.css'

// The friendly name for a saved card's type ("Small Image", not "small-image").
function cardTypeName(template: string | null | undefined) {
  return template && isCardTypeId(template) ? cardTypeLabel(template) : 'Step'
}

type GuideEditorTab = 'details' | 'decks' | 'preview'
type GuideDifficulty = 'Beginner' | 'Intermediate' | 'Advanced'
type GuideStatus = 'Draft' | 'Private' | 'Public'
type DropTarget = { edge: 'before' | 'after'; id: string }



export type GuideEditorSavePayload = {
  title: string
  description: string
  image: string | null
  status: GuideStatus
  difficulty: GuideDifficulty
  deckIds: string[]
  cardLayout: GuideCardPlacement[]
  tags: string[]
}

const difficultyOptions: GuideDifficulty[] = ['Beginner', 'Intermediate', 'Advanced']
const statusOptions: GuideStatus[] = ['Draft', 'Private', 'Public']

function inferDifficulty(cardCount: number): GuideDifficulty {
  if (cardCount >= 12) return 'Advanced'
  if (cardCount >= 6) return 'Intermediate'
  return 'Beginner'
}

const editorTabs = ['details', 'decks', 'preview'] as const
// The tab ids stay put so existing ?editorTab= links keep working.
const editorTabLabels: Record<GuideEditorTab, string> = { details: 'Details', decks: 'Contents', preview: 'Preview' }

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
  onSaveDraft?: (payload: GuideEditorSavePayload) => void | Promise<boolean>
  saveError?: string | null
  saveLabel?: string
}) {
  const [activeTab, setActiveTab] = useEditorTab<GuideEditorTab>('details', editorTabs)
  const [title, setTitle] = useState(guide.title)
  const [description, setDescription] = useState(guide.subtitle)
  const [tags, setTags] = useState(() => normalizeGuideTags(guide.tags))
  const [tagDraft, setTagDraft] = useState('')
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
  // One + Add entry point: the menu, then the existing-guide picker or the
  // new-guide form.
  const [addSheet, setAddSheet] = useState<'menu' | 'card-type' | 'existing' | 'new' | null>(null)
  const [deckSearch, setDeckSearch] = useState('')
  const [cardLayout, setCardLayout] = useState<GuideCardPlacement[]>(guide.cardLayout ?? [])
  const [loadedDecks, setLoadedDecks] = useState<GuidesV3DeckDetail[]>([])
  const [addingDeckId, setAddingDeckId] = useState<string | null>(null)
  const [cardLoadError, setCardLoadError] = useState<string | null>(null)
  const [expandedDecks, setExpandedDecks] = useState<string[]>([])
  const [draggingCardKey, setDraggingCardKey] = useState<string | null>(null)
  const [cardDropTarget, setCardDropTarget] = useState<DropTarget | null>(null)
  // Edit on a direct card opens the card editor right here.
  const [editingDirectCard, setEditingDirectCard] = useState<{ deckId: string; stepId: string } | null>(null)

  const deckById = useMemo(() => {
    const map = new Map<string, GuidesV3Deck>()
    for (const deck of memberDecks) map.set(deck.id, deck)
    for (const deck of availableDecks) map.set(deck.id, deck)
    // Guides created from + Add > New Guide during this edit.
    for (const deck of loadedDecks) if (!map.has(deck.id)) map.set(deck.id, deck)
    return map
  }, [memberDecks, availableDecks, loadedDecks])
  const deckDetailById = useMemo(
    () => new Map([...deckDetails, ...loadedDecks].map((deck) => [deck.id, deck])),
    [deckDetails, loadedDecks]
  )

  const selectedDecks = selectedDeckIds
    .map((id) => deckById.get(id))
    .filter((deck): deck is GuidesV3Deck => Boolean(deck))
  const selectedDetails = selectedDeckIds.map(id => deckDetailById.get(id)).filter((deck): deck is GuidesV3DeckDetail => Boolean(deck))
  const resolvedCards = resolveGuideCards(selectedDetails, cardLayout)
  // Cover cards show the guide's current title, description and cover image.
  const cardNodes = guideCardNodes(selectedDetails, resolvedCards, { id: guide.id, title: title || 'Untitled Guide', description, image: coverImage })
  // The guide's own cards (its inline deck), if it has any yet.
  const inlineDeckId = selectedDetails.find((deck) => deck.isInline)?.id ?? null
  const contentItems = guideContentItems(selectedDetails, resolvedCards)

  function addGuideIndex() {
    // With direct cards the index is a top-level card; otherwise it sits in
    // the first nested guide, as before.
    const groupId = inlineDeckId ?? selectedDeckIds.find((id) => !deckDetailById.get(id)?.isInline)
    if (!groupId) return
    setCardLayout([{ deckId: guide.id, cardId: newGuideIndexCardId(resolvedCards), groupId, hidden: false }, ...resolvedCards])
    setExpandedDecks(current => current.includes(groupId) ? current : [...current, groupId])
  }

  // Guide Cover: placed first in the top-level sequence (or the first
  // nested guide when the guide has no cards of its own yet).
  function addGuideCover() {
    const groupId = inlineDeckId ?? selectedDeckIds.find((id) => !deckDetailById.get(id)?.isInline)
    if (!groupId) return
    setCardLayout([{ deckId: guide.id, cardId: newGuideCoverCardId(resolvedCards), groupId, hidden: false }, ...resolvedCards])
  }

  function removeGuideIndex(key: string) {
    setCardLayout(resolvedCards.filter(card => guideCardKey(card) !== key))
  }

  // Source cards reorder only within the nested guide they sit in; moving them
  // between nested guides is not offered. Cards already placed in another
  // group by an earlier editor keep that placement. The Guide Index belongs
  // to this guide, so it may still move anywhere.
  function canMoveBetween(card: GuideCardPlacement, target: GuideCardPlacement | undefined) {
    return Boolean(target) && (isGuideOwnedCard(card) || target!.groupId === card.groupId)
  }

  function moveCard(key: string, direction: -1 | 1) {
    const next = [...resolvedCards]
    const index = next.findIndex(card => guideCardKey(card) === key)
    const target = index + direction
    if (index < 0 || !canMoveBetween(next[index], next[target])) return
    const moved = { ...next[index], groupId: next[target].groupId }
    next.splice(index, 1)
    next.splice(target, 0, moved)
    setCardLayout(next)
  }

  function reorderCard(cardKey: string, targetKey: string, edge: DropTarget['edge']) {
    if (cardKey === targetKey) return
    const next = [...resolvedCards]
    const fromIndex = next.findIndex((card) => guideCardKey(card) === cardKey)
    const targetIndex = next.findIndex((card) => guideCardKey(card) === targetKey)
    if (fromIndex < 0 || targetIndex < 0 || !canMoveBetween(next[fromIndex], next[targetIndex])) return
    const targetGroupId = next[targetIndex].groupId
    const [moved] = next.splice(fromIndex, 1)
    const adjustedTarget = fromIndex < targetIndex ? targetIndex - 1 : targetIndex
    next.splice(adjustedTarget + (edge === 'after' ? 1 : 0), 0, {
      ...moved,
      groupId: targetGroupId,
    })
    setCardLayout(next)
  }
  const selectedDeckIdSet = new Set(selectedDeckIds)
  const pickableDecks = availableDecks.filter((deck) => !selectedDeckIdSet.has(deck.id))
  const normalizedDeckSearch = deckSearch.trim().toLowerCase()
  const filteredPickableDecks = pickableDecks.filter((deck) =>
    `${deck.title} ${deck.category}`.toLowerCase().includes(normalizedDeckSearch)
  )
  // The guide's own cards deck has no cover of its own to offer.
  const coverImageCandidates = selectedDecks.filter((deck) => !deckDetailById.get(deck.id)?.isInline).map((deck) => ({
    id: deck.id,
    image: deckDetailById.get(deck.id)?.fullImage || deckDetailById.get(deck.id)?.image || deck.image,
  }))
  const coverPages = useGalleryPages(coverImageCandidates)

  function contentItemKey(item: GuideContentItem) {
    return item.kind === 'guide' ? `guide:${item.deckId}` : `card:${guideCardKey(item.card)}`
  }

  // Moves a top-level item (a nested guide or a direct card). Without direct
  // cards this is the existing deck reorder, unchanged.
  function reorderTopLevel(fromKey: string, toKey: string, edge: DropTarget['edge']) {
    if (fromKey === toKey) return
    if (!inlineDeckId) {
      if (fromKey.startsWith('guide:') && toKey.startsWith('guide:')) reorderDeck(fromKey.slice(6), toKey.slice(6), edge)
      return
    }
    const next = [...contentItems]
    const fromIndex = next.findIndex((item) => contentItemKey(item) === fromKey)
    const toIndex = next.findIndex((item) => contentItemKey(item) === toKey)
    if (fromIndex < 0 || toIndex < 0) return
    const [moved] = next.splice(fromIndex, 1)
    const adjusted = fromIndex < toIndex ? toIndex - 1 : toIndex
    next.splice(adjusted + (edge === 'after' ? 1 : 0), 0, moved)
    applyContentItems(next)
  }

  function moveTopLevel(key: string, direction: -1 | 1) {
    const index = contentItems.findIndex((item) => contentItemKey(item) === key)
    const target = contentItems[index + direction]
    if (index < 0 || !target) return
    reorderTopLevel(key, contentItemKey(target), direction === 1 ? 'after' : 'before')
  }

  // Nested guides keep their block order in guide_decks; the guide's own
  // cards deck stays last so likes and first-deck fallbacks never land on it.
  function applyContentItems(items: GuideContentItem[]) {
    setCardLayout(flattenGuideContentItems(items))
    const blockIds = items.flatMap((item) => item.kind === 'guide' ? [item.deckId] : [])
    setSelectedDeckIds((current) => [
      ...blockIds,
      ...current.filter((id) => !blockIds.includes(id) && id !== inlineDeckId),
      ...(inlineDeckId ? [inlineDeckId] : []),
    ])
  }

  function toggleCardHidden(key: string) {
    setCardLayout(resolvedCards.map(item => guideCardKey(item) === key ? { ...item, hidden: !item.hidden } : item))
  }

  // New Card: add a card of the chosen type straight to this guide's own
  // cards (its hidden inline deck, created on first use). It lands at the end
  // of Contents; Edit opens it in the card editor.
  async function addDirectCard(template: CardTypeId) {
    if (addingDeckId) return
    setAddingDeckId('card')
    setCardLoadError(null)
    try {
      const { deckId, deck } = await addInlineGuideCard(guide.id, template)
      setLoadedDecks((current) => [...current.filter((item) => item.id !== deckId), deck])
      setSelectedDeckIds((current) => current.includes(deckId) ? current : [...current, deckId])
      setAddSheet(null)
    } catch (error) {
      setCardLoadError(error instanceof Error ? error.message : 'Could not add this card.')
    } finally { setAddingDeckId(null) }
  }

  // A direct card saved or deleted from its editor sheet: show the inline
  // deck's fresh detail in place, as New Card does.
  function showInlineDeck(deck: GuidesV3DeckDetail) {
    setLoadedDecks((current) => [...current.filter((item) => item.id !== deck.id), deck])
  }

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

  async function addDeck(deckId: string) {
    if (addingDeckId) return
    setAddingDeckId(deckId)
    setCardLoadError(null)
    try {
      if (!deckDetailById.has(deckId)) {
        const detail = await loadGuideEditorDeck(deckId)
        setLoadedDecks(current => [...current, detail])
      }
      setSelectedDeckIds(current => current.includes(deckId) ? current : [...current, deckId])
    } catch (error) {
      setCardLoadError(error instanceof Error ? error.message : 'Could not load this guide.')
    } finally { setAddingDeckId(null) }
  }

  // A nested guide is backed by a deck for now: create a private one with
  // just its cover card, then place it here. It exists on its own (My Guides)
  // even if this guide is not saved.
  async function createNestedGuide(name: string) {
    if (addingDeckId) return false
    setAddingDeckId('new')
    setCardLoadError(null)
    try {
      const created = await createDeckFromForge({
        title: name,
        description: 'A reusable guide.',
        status: 'Private',
        image: null,
        cards: [{ template: 'cover', title: name, body: '', image: null }],
      })
      const detail = await loadGuideEditorDeck(created.id)
      setLoadedDecks(current => [...current, detail])
      setSelectedDeckIds(current => current.includes(created.id) ? current : [...current, created.id])
      return true
    } catch (error) {
      setCardLoadError(error instanceof Error ? error.message : 'Could not create this guide.')
      return false
    } finally { setAddingDeckId(null) }
  }

  function removeDeck(deckId: string) {
    setSelectedDeckIds((current) => current.filter((id) => id !== deckId))
  }

  const saveChanges = useEditorChanges(JSON.stringify({ title, description, tags, coverImage, selectedDeckIds, cardLayout, status, difficulty }), isSaving || Boolean(addingDeckId))

  function addTag() {
    const tag = normalizeGuideTag(tagDraft)
    if (!tag || tags.length >= MAX_GUIDE_TAGS) return
    if (!tags.some((current) => current.toLocaleLowerCase() === tag.toLocaleLowerCase())) {
      setTags((current) => [...current, tag])
    }
    setTagDraft('')
  }

  function handleSave() {
    void saveChanges(() => onSaveDraft?.({
      title,
      description,
      image: coverImage,
      status,
      difficulty,
      deckIds: selectedDeckIds,
      cardLayout: resolvedCards,
      tags,
    }))
  }

  return (
    <section className={styles.deckEditorPage}>
      <div className={styles.editorFrame}>
        <header className={styles.hero}>
          <Image src={coverImage} alt="" fill priority sizes="760px" className={styles.heroImage} />
          <span className={styles.heroShade} />
          <div className={styles.heroTop}>
            <GuideBackButton fallbackHref={backHref} className={styles.iconButton} />
            <div className={styles.heroActions}>
              <FeatureGuideLauncher
                guides={featureGuides}
                label="Guide editor help"
                buttonClassName={styles.iconButton}
              />
              <button
                className={styles.saveButton}
                type="button"
                disabled={isSaving || Boolean(addingDeckId)}
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
                <h2>Tags</h2>
                <span>{tags.length}/{MAX_GUIDE_TAGS}</span>
              </div>
              <div className={styles.tagList} aria-label="Guide tags">
                {tags.map((tag) => (
                  <span key={tag.toLocaleLowerCase()} className={styles.tagPill}>
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove ${tag} tag`}
                      onClick={() => setTags((current) => current.filter((item) => item !== tag))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {!tags.length ? <p className={styles.emptyTagText}>Add tags to make this guide easier to find.</p> : null}
              </div>
              <div className={styles.addTagRow}>
                <label className={styles.field}>
                  <span className="sr-only">New tag</span>
                  <input
                    value={tagDraft}
                    maxLength={64}
                    placeholder="New tag"
                    disabled={tags.length >= MAX_GUIDE_TAGS}
                    onChange={(event) => setTagDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        addTag()
                      }
                    }}
                  />
                </label>
                <button type="button" className={styles.editButton} disabled={!tagDraft.trim() || tags.length >= MAX_GUIDE_TAGS} onClick={addTag}>
                  Add Tag
                </button>
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <h2>Gallery</h2>
                <span>From guides inside</span>
              </div>
              <div className={styles.galleryGrid} {...coverPages.swipeHandlers}>
                {coverPages.pageItems.map((candidate) => (
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
              <GalleryPager
                page={coverPages.page}
                pageCount={coverPages.pageCount}
                onPageChange={coverPages.goToPage}
                label="Cover image pages"
              />
            </section>
          </div>
        ) : null}

        {activeTab === 'decks' ? (
          <section className={styles.panel}>
            <p>Changes here affect this guide only. The source guide stays unchanged.</p>
            <div className={styles.cardList}>
              {contentItems.map((item, itemIndex) => {
                if (item.kind === 'card') {
                  const card = item.card
                  const key = guideCardKey(card)
                  const itemKey = contentItemKey(item)
                  const isIndex = isGuideIndexCard(card)
                  const isGuideCover = isGuideCoverCard(card)
                  const step = deckDetailById.get(card.deckId)?.steps.find((candidate) => candidate.id === card.cardId)
                  const label = isIndex ? 'Guide Index' : isGuideCover ? title || 'Untitled Guide' : step?.title ?? 'Card'
                  return (
                    <TopLevelCardRow
                      key={itemKey}
                      label={label}
                      typeLabel={isIndex ? 'Index' : isGuideCover ? 'Cover' : cardTypeName(step?.template)}
                      hidden={card.hidden}
                      preview={cardNodes.get(key)}
                      onEdit={!isIndex && !isGuideCover && step ? () => setEditingDirectCard({ deckId: card.deckId, stepId: card.cardId }) : undefined}
                      onRemove={isIndex || isGuideCover ? { label: isIndex ? 'Remove index' : 'Remove cover', run: () => removeGuideIndex(key) } : undefined}
                      isDragging={draggingDeckId === itemKey}
                      dropEdge={dropTarget?.id === itemKey ? dropTarget.edge : null}
                      canMoveUp={itemIndex > 0}
                      canMoveDown={itemIndex < contentItems.length - 1}
                      onMove={(direction) => moveTopLevel(itemKey, direction)}
                      onToggleHidden={() => toggleCardHidden(key)}
                      onDragStart={(event) => {
                        setDraggingDeckId(itemKey)
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', itemKey)
                      }}
                      onDragOver={(event) => {
                        event.preventDefault()
                        const rect = event.currentTarget.getBoundingClientRect()
                        setDropTarget({ id: itemKey, edge: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after' })
                        event.dataTransfer.dropEffect = 'move'
                      }}
                      onDragLeave={() => { if (dropTarget?.id === itemKey) setDropTarget(null) }}
                      onDrop={(event) => {
                        event.preventDefault()
                        const draggedKey = event.dataTransfer.getData('text/plain') || draggingDeckId
                        if (draggedKey) reorderTopLevel(draggedKey, itemKey, dropTarget?.edge ?? 'before')
                        setDraggingDeckId(null)
                        setDropTarget(null)
                      }}
                      onDragEnd={() => { setDraggingDeckId(null); setDropTarget(null) }}
                    />
                  )
                }
                const deck = deckById.get(item.deckId)
                if (!deck) return null
                const rowKey = contentItemKey(item)
                return (
                <article
                  key={deck.id}
                  className={[
                    styles.cardRow,
                    styles.guideDeckRow,
                    styles.guideDeckRowUnnumbered,
                    draggingDeckId === rowKey ? styles.cardRowDragging : '',
                    dropTarget?.id === rowKey && dropTarget.edge === 'before'
                      ? styles.cardRowDropBefore
                      : '',
                    dropTarget?.id === rowKey && dropTarget.edge === 'after'
                      ? styles.cardRowDropAfter
                      : '',
                  ].join(' ')}
                  onDragStart={(event) => {
                    setDraggingDeckId(rowKey)
                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', rowKey)
                  }}
                  onDragOver={(event) => {
                    event.preventDefault()
                    const rect = event.currentTarget.getBoundingClientRect()
                    const edge =
                      event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
                    setDropTarget({ id: rowKey, edge })
                    event.dataTransfer.dropEffect = 'move'
                  }}
                  onDragLeave={() => {
                    if (dropTarget?.id === rowKey) setDropTarget(null)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const draggedId = event.dataTransfer.getData('text/plain') || draggingDeckId
                    if (draggedId) {
                      reorderTopLevel(draggedId, rowKey, dropTarget?.edge ?? 'before')
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
                    draggable
                  >
                    <DragHandleIcon />
                  </span>
                  <span className={styles.cardInfo}>
                    <span className={styles.cardTypeLabel}>Guide</span>
                    <span className={styles.cardName}>{deck.title}</span>
                  </span>
                  <span className={styles.cardRowActions}>
                    <button type="button" className={styles.editButton} aria-label={expandedDecks.includes(deck.id) ? 'Hide cards' : 'Show cards'} aria-expanded={expandedDecks.includes(deck.id)} aria-controls={`guide-cards-${deck.id}`} onClick={() => setExpandedDecks(current => current.includes(deck.id) ? current.filter(id => id !== deck.id) : [...current, deck.id])}>
                      <span aria-hidden="true">{expandedDecks.includes(deck.id) ? '▴' : '▾'}</span> Cards
                    </button>
                    <button
                      type="button"
                      className={styles.dangerButton}
                      aria-label={`Remove ${deck.title} from guide`}
                      onClick={() => removeDeck(deck.id)}
                    >
                      x
                    </button>
                  </span>
                  {expandedDecks.includes(deck.id) ? <div id={`guide-cards-${deck.id}`} className={styles.guideCardList}>
                    {resolvedCards.filter(card => card.groupId === deck.id).map(card => {
                      const key = guideCardKey(card)
                      const isIndex = isGuideIndexCard(card)
                      const isGuideCover = isGuideCoverCard(card)
                      const source = deckDetailById.get(card.deckId)
                      const step = source?.steps.find(step => step.id === card.cardId)
                      const label = isIndex ? 'Guide Index' : isGuideCover ? title || 'Untitled Guide' : card.cardId === 'cover' ? `${source?.title} — Cover` : step?.title ?? 'Card'
                      const index = resolvedCards.indexOf(card)
                      const previewNode = cardNodes.get(key)
                      const typeLabel = isIndex ? 'Index' : isGuideCover || card.cardId === 'cover' ? 'Cover' : cardTypeName(step?.template)
                      return <div
                        key={key}
                        className={[
                          styles.guideCardRow,
                          draggingCardKey === key ? styles.cardRowDragging : '',
                          cardDropTarget?.id === key && cardDropTarget.edge === 'before' ? styles.cardRowDropBefore : '',
                          cardDropTarget?.id === key && cardDropTarget.edge === 'after' ? styles.cardRowDropAfter : '',
                        ].join(' ')}
                        data-hidden={card.hidden}
                        onDragStart={(event) => {
                          event.stopPropagation()
                          setDraggingCardKey(key)
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', key)
                        }}
                        onDragOver={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          const rect = event.currentTarget.getBoundingClientRect()
                          setCardDropTarget({ id: key, edge: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after' })
                          event.dataTransfer.dropEffect = 'move'
                        }}
                        onDrop={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          const draggedKey = event.dataTransfer.getData('text/plain') || draggingCardKey
                          if (draggedKey) reorderCard(draggedKey, key, cardDropTarget?.edge ?? 'before')
                          setDraggingCardKey(null)
                          setCardDropTarget(null)
                        }}
                        onDragEnd={() => {
                          setDraggingCardKey(null)
                          setCardDropTarget(null)
                        }}
                      >
                        <span className={styles.dragHandle} aria-label={`Drag to reorder ${label}`} title="Drag to reorder" draggable><DragHandleIcon /></span>
                        <span className={styles.guideCardPreview} aria-hidden="true"><span className={styles.guideCardPreviewStage}>{previewNode}</span></span>
                        <span className={styles.guideCardInfo}><span className={styles.cardTypeLabel}>{typeLabel}</span><strong data-guide-card-title>{label}</strong>{isIndex || isGuideCover ? <button type="button" className={styles.guideIndexRemove} onClick={() => removeGuideIndex(key)}>{isIndex ? 'Remove index' : 'Remove cover'}</button> : null}</span>
                        <button className={styles.visibilityButton} type="button" aria-pressed={card.hidden} onClick={() => setCardLayout(resolvedCards.map(item => guideCardKey(item) === key ? { ...item, hidden: !item.hidden } : item))}><VisibilityIcon hidden={card.hidden} />{card.hidden ? 'Unhide' : 'Hide'}</button>
                        <span className={styles.keyboardMoveActions}>
                          <button type="button" disabled={!canMoveBetween(card, resolvedCards[index - 1])} aria-label={`Move ${label} up`} onClick={() => moveCard(key, -1)}>↑</button>
                          <button type="button" disabled={!canMoveBetween(card, resolvedCards[index + 1])} aria-label={`Move ${label} down`} onClick={() => moveCard(key, 1)}>↓</button>
                        </span>
                      </div>
                    })}
                    {!resolvedCards.some(card => card.groupId === deck.id) ? <p>No cards in this guide.</p> : null}
                  </div> : null}
                </article>
                )
              })}
            </div>
            <button
              type="button"
              className={styles.addCardButton}
              aria-haspopup="dialog"
              onClick={() => setAddSheet('menu')}
            >
              + Add
            </button>
            {cardLoadError && !addSheet ? <p role="alert" className={styles.saveError}>{cardLoadError}</p> : null}
          </section>
        ) : null}

        {activeTab === 'preview' ? (
          <GuidePreview nodes={cardNodes} cards={resolvedCards} />
        ) : null}

        {saveError ? <p className={styles.saveError}>{saveError}</p> : null}
      </div>

      {addSheet === 'menu' ? (
        <AddContentSheet
          options={[
            { key: 'card', kind: 'Card', title: 'New Card', note: 'Add a card straight to this guide.' },
            { key: 'existing', kind: 'Guide', title: 'Existing Guide', note: 'Reuse a guide you made. Its source stays unchanged.' },
            { key: 'new', kind: 'Guide', title: 'New Guide', note: 'Start a new reusable guide and place it here.' },
          ]}
          onChoose={(key) => {
            setCardLoadError(null)
            setAddSheet(key === 'card' ? 'card-type' : key === 'existing' ? 'existing' : 'new')
          }}
          onClose={() => setAddSheet(null)}
        />
      ) : null}

      {editingDirectCard && deckDetailById.get(editingDirectCard.deckId) ? (
        <DirectCardEditor
          key={editingDirectCard.stepId}
          guideId={guide.id}
          deck={deckDetailById.get(editingDirectCard.deckId) as GuidesV3DeckDetail}
          stepId={editingDirectCard.stepId}
          onSaved={showInlineDeck}
          onDeleted={(deck) => {
            showInlineDeck(deck)
            setCardLayout((current) => current.filter((placement) =>
              placement.deckId !== editingDirectCard.deckId || placement.cardId !== editingDirectCard.stepId))
          }}
          onClose={() => setEditingDirectCard(null)}
        />
      ) : null}

      {addSheet === 'card-type' ? (
        <CardTypeSheet
          templates={addableCardTypes}
          // Always available, as many as the creator wants. With no guides
          // inside yet it shows an empty state and fills in as guides are added.
          guideIndex={{
            onAdd: () => {
              addGuideIndex()
              setAddSheet(null)
            },
          }}
          isBusy={Boolean(addingDeckId)}
          error={cardLoadError}
          onAddCard={(template) => {
            if (template === 'cover') {
              addGuideCover()
              setAddSheet(null)
            } else void addDirectCard(template)
          }}
          onClose={() => {
            setAddSheet(null)
            setCardLoadError(null)
          }}
        />
      ) : null}

      {addSheet === 'new' ? (
        <NewGuideSheet
          isSaving={Boolean(addingDeckId)}
          error={cardLoadError}
          onCreate={async (name) => {
            if (await createNestedGuide(name)) setAddSheet(null)
          }}
          onClose={() => {
            setAddSheet(null)
            setCardLoadError(null)
          }}
        />
      ) : null}

      {addSheet === 'existing' ? (
        <AddDecksSheet
          decks={filteredPickableDecks}
          isLoading={Boolean(addingDeckId)}
          error={cardLoadError}
          query={deckSearch}
          onAddDeck={(deckId) => {
            void addDeck(deckId)
          }}
          onClose={() => {
            setAddSheet(null)
            setDeckSearch('')
          }}
          onQueryChange={setDeckSearch}
        />
      ) : null}
    </section>
  )
}

// The card editor sheet over the guide editor for one direct card (a step
// of the guide's inline deck). Closing it saves just that card in place if
// anything changed; the guide itself is saved separately with Save.
function DirectCardEditor({
  guideId,
  deck,
  stepId,
  onSaved,
  onDeleted,
  onClose,
}: {
  guideId: string
  deck: GuidesV3DeckDetail
  stepId: string
  onSaved: (deck: GuidesV3DeckDetail) => void
  onDeleted: (deck: GuidesV3DeckDetail) => void
  onClose: () => void
}) {
  const [cards, setCards] = useState<CardEditorCard[]>(() => {
    const step = deck.steps.find((candidate) => candidate.id === stepId)
    return step ? [editorCardFromStep(step)] : []
  })
  const [cardsOnOpen] = useState(() => JSON.stringify(cards))
  const [pendingImageUploads, setPendingImageUploads] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const card = cards[0] ?? null
  const handlers = cardEditingHandlers({
    editingCard: card,
    editingCardId: card?.id ?? null,
    setCards,
    setImageUploadError: setError,
    setPendingImageUploads,
  })

  async function run(task: () => Promise<{ deck: GuidesV3DeckDetail }>, done: (deck: GuidesV3DeckDetail) => void) {
    setIsSaving(true)
    setError(null)
    try {
      const { deck: fresh } = await task()
      done(fresh)
      onClose()
    } catch (taskError) {
      setError(taskError instanceof Error ? taskError.message : 'Could not save this card.')
      setIsSaving(false)
    }
  }

  function close() {
    if (isSaving) return
    if (!card || JSON.stringify(cards) === cardsOnOpen) return onClose()
    if (pendingImageUploads > 0) return setError('Wait for the image upload to finish before saving.')
    if (hasUnuploadedImage([card.image])) {
      return setError('The photo has not finished uploading. Retry or remove it before saving.')
    }
    void run(() => updateInlineGuideCard(guideId, {
      id: card.id,
      title: card.title,
      template: card.template,
      body: card.body,
      image: card.image,
      paints: card.paints.map((paint) => ({ id: paint.id, ratio_text: paint.ratio_text ?? null })),
      videoUrl: card.videoUrl,
      imageFocalX: card.imageFocalX,
      imageFocalY: card.imageFocalY,
      paintAlignment: card.paintAlignment ?? 'left',
      paintVerticalAlignment: card.paintVerticalAlignment ?? 'top',
      subtitle: card.subtitle?.trim() || null,
    }), onSaved)
  }

  function remove() {
    if (!card || isSaving) return
    if (!window.confirm(`Delete "${card.title}" from this guide? This cannot be undone.`)) return
    void run(() => deleteInlineGuideCard(guideId, card.id), onDeleted)
  }

  if (!card) return null
  return (
    <CardEditorSheet
      canDelete={deck.steps.length > 1}
      card={card}
      deckPaints={deck.paintList}
      error={error}
      isSaving={isSaving}
      onAddPaint={handlers.addEditingCardPaint}
      onChange={handlers.updateEditingCard}
      onChangeImage={handlers.updateEditingCardImage}
      onChangePaint={handlers.updateEditingCardPaint}
      onClose={close}
      onDelete={remove}
      onDeletePaint={handlers.deleteEditingCardPaint}
      onSelectPaint={handlers.selectEditingCardPaint}
    />
  )
}

// The preview is a scrolling stack, so index rows scroll to their target card.
const previewNavigation = {
  goToCard: (key: string) => {
    document.querySelector(`[data-guide-card-key="${CSS.escape(key)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  },
}

function GuidePreview({ nodes, cards }: { nodes: Map<string, ReactNode>; cards: GuideCardPlacement[] }) {
  const visible = cards.filter(card => !card.hidden)
  return <GuideCardNavigationContext value={previewNavigation}><section className={styles.previewStack} aria-label="Guide preview">
    {visible.length ? visible.map(card => <div key={guideCardKey(card)} data-guide-card-key={guideCardKey(card)} className={styles.previewShareMount}>{nodes.get(guideCardKey(card))}</div>) : <p>No visible cards. Unhide a card in the Contents tab.</p>}
  </section></GuideCardNavigationContext>
}

// A direct card (or the Guide Index once the guide has direct cards) in the
// top-level sequence. Same row as a card inside a nested guide - preview,
// type over title, Hide/Unhide - on its own surface. Tapping the card opens
// it in the card editor.
function TopLevelCardRow({
  label,
  typeLabel,
  hidden,
  preview,
  onEdit,
  onRemove,
  isDragging,
  dropEdge,
  canMoveUp,
  canMoveDown,
  onMove,
  onToggleHidden,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  label: string
  typeLabel: string
  hidden: boolean
  preview: ReactNode
  onEdit?: () => void
  onRemove?: { label: string; run: () => void }
  isDragging: boolean
  dropEdge: DropTarget['edge'] | null
  canMoveUp: boolean
  canMoveDown: boolean
  onMove: (direction: -1 | 1) => void
  onToggleHidden: () => void
  onDragStart: (event: DragEvent<HTMLElement>) => void
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
}) {
  const previewBox = <span className={styles.guideCardPreviewStage}>{preview}</span>
  return (
    <div
      className={[
        styles.guideCardRow,
        styles.topLevelCardRow,
        isDragging ? styles.cardRowDragging : '',
        dropEdge === 'before' ? styles.cardRowDropBefore : '',
        dropEdge === 'after' ? styles.cardRowDropAfter : '',
      ].join(' ')}
      data-top-level-card
      data-hidden={hidden}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <span className={styles.dragHandle} aria-label={`Drag to reorder ${label}`} title="Drag to reorder" draggable><DragHandleIcon /></span>
      {onEdit ? (
        <button type="button" className={styles.guideCardPreview} aria-hidden="true" tabIndex={-1} onClick={onEdit}>{previewBox}</button>
      ) : (
        <span className={styles.guideCardPreview} aria-hidden="true">{previewBox}</span>
      )}
      <span className={styles.guideCardInfo}>
        <span className={styles.cardTypeLabel}>{typeLabel}</span>
        <strong data-guide-card-title>{label}</strong>
        {onRemove ? <button type="button" className={styles.guideIndexRemove} onClick={onRemove.run}>{onRemove.label}</button> : null}
      </span>
      <span className={styles.topLevelCardActions}>
        {onEdit ? (
          <button type="button" className={styles.visibilityButton} aria-label={`Edit ${label}`} onClick={onEdit}>
            <EditPencilIcon />Edit
          </button>
        ) : null}
        <button className={styles.visibilityButton} type="button" aria-pressed={hidden} aria-label={`${hidden ? 'Unhide' : 'Hide'} ${label}`} onClick={onToggleHidden}>
          <VisibilityIcon hidden={hidden} />{hidden ? 'Unhide' : 'Hide'}
        </button>
      </span>
      <span className={styles.keyboardMoveActions}>
        <button type="button" disabled={!canMoveUp} aria-label={`Move ${label} up`} onClick={() => onMove(-1)}>↑</button>
        <button type="button" disabled={!canMoveDown} aria-label={`Move ${label} down`} onClick={() => onMove(1)}>↓</button>
      </span>
    </div>
  )
}

function NewGuideSheet({
  isSaving,
  error,
  onCreate,
  onClose,
}: {
  isSaving: boolean
  error: string | null
  onCreate: (name: string) => void | Promise<void>
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const trimmed = name.trim()
  return (
    <div className={styles.sheetBackdrop} role="dialog" aria-modal="true" aria-label="New guide">
      <section className={styles.sheet}>
        <header>
          <h2>New Guide</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (trimmed && !isSaving) void onCreate(trimmed)
          }}
        >
          <label className={styles.field}>
            <span>Guide name</span>
            <input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} placeholder="e.g. Forgotten Tomb Gold" autoFocus />
          </label>
          <p className={styles.guideIndexNote}>It starts private with a cover card. Add its cards from My Guides, and reuse it in other guides too.</p>
          {error ? <p role="alert" className={styles.saveError}>{error}</p> : null}
          <button type="submit" className={styles.addCardButton} disabled={!trimmed || isSaving}>
            {isSaving ? 'Creating...' : 'Create and Add'}
          </button>
        </form>
      </section>
    </div>
  )
}

function AddDecksSheet({
  isLoading,
  error,
  decks,
  onAddDeck,
  onClose,
  onQueryChange,
  query,
}: {
  isLoading: boolean
  error: string | null
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
          <h2>Add Existing Guide</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <label className={styles.field}>
          <span>Search your guides</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search your guides..."
          />
        </label>
        {error ? <p role="alert" className={styles.saveError}>{error}</p> : null}
        <div className={styles.cardList}>
          {decks.length ? (
            decks.map((deck) => (
              <article key={deck.id} className={`${styles.cardRow} ${styles.addDeckRow}`}>
                <span className={styles.cardNumber} aria-hidden="true" />
                <span className={styles.cardInfo}>
                  <span className={styles.cardTypeLabel}>{deck.category}</span>
                  <span className={styles.cardName}>{deck.title}</span>
                </span>
                <button
                  type="button"
                  className={styles.editButton}
                  disabled={isLoading}
                  onClick={() => onAddDeck(deck.id)}
                >
                  Add
                </button>
              </article>
            ))
          ) : (
            <p>No more guides to add.</p>
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

function EditPencilIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
      <path d="m14 7 3 3" />
    </svg>
  )
}

function VisibilityIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.7a2 2 0 002.7 2.7" />
      <path d="M9.9 4.2A10.7 10.7 0 0112 4c5.5 0 9 6 9 6a15.5 15.5 0 01-2.1 2.8M6.2 6.2C4.1 7.7 3 10 3 10s3.5 6 9 6c1 0 2-.2 2.8-.5" />
    </svg>
  ) : (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
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
