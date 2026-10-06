'use client'

import { useEditorChanges } from '@/app/components/navigation-feedback/unsaved-changes'

import GuideBackButton from '@/app/guides/shared/guide-back-button'
import { useEditorTab } from '@/app/guides/shared/use-editor-tab'
import { loadGuideEditorDeck } from '../actions'
import Image from 'next/image'
import { useMemo, useState } from 'react'
import { deckCardEntries } from '../shared/deck-card-entries'
import { guideCardKey, resolveGuideCards, type GuideCardPlacement } from '../shared/guide-card-layout'
import { MAX_GUIDE_TAGS, normalizeGuideTag, normalizeGuideTags } from '../shared/guide-tags'
import FeatureGuideLauncher from '../../components/feature-guide-launcher'
import GalleryPager, { useGalleryPages } from '../../components/gallery/gallery-pager'
import type { FeatureGuideEntry } from '../../components/feature-guide-types'
import type { GuidesV3Deck } from '../guides-v3-data'
import type { GuidesV3DeckDetail, GuidesV3GuideDetail } from '../guides-v3-detail-data'
import styles from '../decks/[id]/deck-editor-client.module.css'

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
  const [isAddDecksOpen, setIsAddDecksOpen] = useState(false)
  const [deckSearch, setDeckSearch] = useState('')
  const [cardLayout, setCardLayout] = useState<GuideCardPlacement[]>(guide.cardLayout ?? [])
  const [loadedDecks, setLoadedDecks] = useState<GuidesV3DeckDetail[]>([])
  const [addingDeckId, setAddingDeckId] = useState<string | null>(null)
  const [cardLoadError, setCardLoadError] = useState<string | null>(null)
  const [expandedDecks, setExpandedDecks] = useState<string[]>([])
  const [draggingCardKey, setDraggingCardKey] = useState<string | null>(null)
  const [cardDropTarget, setCardDropTarget] = useState<DropTarget | null>(null)

  const deckById = useMemo(() => {
    const map = new Map<string, GuidesV3Deck>()
    for (const deck of memberDecks) map.set(deck.id, deck)
    for (const deck of availableDecks) map.set(deck.id, deck)
    return map
  }, [memberDecks, availableDecks])
  const deckDetailById = useMemo(
    () => new Map([...deckDetails, ...loadedDecks].map((deck) => [deck.id, deck])),
    [deckDetails, loadedDecks]
  )

  const selectedDecks = selectedDeckIds
    .map((id) => deckById.get(id))
    .filter((deck): deck is GuidesV3Deck => Boolean(deck))
  const selectedDetails = selectedDeckIds.map(id => deckDetailById.get(id)).filter((deck): deck is GuidesV3DeckDetail => Boolean(deck))
  const resolvedCards = resolveGuideCards(selectedDetails, cardLayout)
  function moveCard(key: string, direction: -1 | 1) {
    const next = [...resolvedCards]
    const index = next.findIndex(card => guideCardKey(card) === key)
    const target = index + direction
    if (index < 0 || target < 0 || target >= next.length) return
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
    if (fromIndex < 0 || targetIndex < 0) return
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
  const coverImageCandidates = selectedDecks.map((deck) => ({
    id: deck.id,
    image: deckDetailById.get(deck.id)?.fullImage || deckDetailById.get(deck.id)?.image || deck.image,
  }))
  const coverPages = useGalleryPages(coverImageCandidates)

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
      setCardLoadError(error instanceof Error ? error.message : 'Could not load this deck.')
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
              {tab[0]?.toUpperCase()}{tab.slice(1)}
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
                <span>From selected decks</span>
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
            <p>Arrange cards for this guide only. Source decks stay unchanged. Moving past a group boundary moves the card into the next group.</p>
            <div className={styles.cardList}>
              {selectedDecks.map((deck) => (
                <article
                  key={deck.id}
                  className={[
                    styles.cardRow,
                    styles.guideDeckRow,
                    draggingDeckId === deck.id ? styles.cardRowDragging : '',
                    dropTarget?.id === deck.id && dropTarget.edge === 'before'
                      ? styles.cardRowDropBefore
                      : '',
                    dropTarget?.id === deck.id && dropTarget.edge === 'after'
                      ? styles.cardRowDropAfter
                      : '',
                  ].join(' ')}
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
                    draggable
                  >
                    <DragHandleIcon />
                  </span>
                  <span className={styles.cardNumber} aria-hidden="true">
                    {selectedDeckIds.indexOf(deck.id) + 1}
                  </span>
                  <span className={styles.cardInfo}>
                    <span className={styles.cardTypeLabel}>Deck</span>
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
                      const source = deckDetailById.get(card.deckId)!
                      const step = source.steps.find(step => step.id === card.cardId)
                      const label = card.cardId === 'cover' ? source.title + ' — Cover' : step?.title ?? 'Card'
                      const index = resolvedCards.indexOf(card)
                      const previewNode = deckCardEntries(source).find((entry) => entry.key === card.cardId)?.node
                      const typeLabel = card.cardId === 'cover' ? 'Cover' : step?.template || 'Step'
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
                        <span className={styles.guideCardInfo}><span className={styles.cardTypeLabel}>{typeLabel}</span><strong data-guide-card-title>{label}</strong></span>
                        <button className={styles.visibilityButton} type="button" aria-pressed={card.hidden} onClick={() => setCardLayout(resolvedCards.map(item => guideCardKey(item) === key ? { ...item, hidden: !item.hidden } : item))}><VisibilityIcon hidden={card.hidden} />{card.hidden ? 'Unhide' : 'Hide'}</button>
                        <span className={styles.keyboardMoveActions}>
                          <button type="button" disabled={index === 0} aria-label={`Move ${label} up`} onClick={() => moveCard(key, -1)}>↑</button>
                          <button type="button" disabled={index === resolvedCards.length - 1} aria-label={`Move ${label} down`} onClick={() => moveCard(key, 1)}>↓</button>
                          <label><span className="sr-only">Move {label} to deck group</span><select value={card.groupId} onChange={event => {
                            const next = resolvedCards.filter(item => guideCardKey(item) !== key)
                            const last = next.findLastIndex(item => item.groupId === event.target.value)
                            next.splice(last + 1, 0, { ...card, groupId: event.target.value })
                            setCardLayout(next)
                          }}>{selectedDecks.map(group => <option key={group.id} value={group.id}>{group.title}</option>)}</select></label>
                        </span>
                      </div>
                    })}
                    {!resolvedCards.some(card => card.groupId === deck.id) ? <p>No cards in this group.</p> : null}
                  </div> : null}
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
          <GuidePreview decks={selectedDetails} cards={resolvedCards} />
        ) : null}

        {saveError ? <p className={styles.saveError}>{saveError}</p> : null}
      </div>

      {isAddDecksOpen ? (
        <AddDecksSheet
          decks={filteredPickableDecks}
          isLoading={Boolean(addingDeckId)}
          error={cardLoadError}
          query={deckSearch}
          onAddDeck={(deckId) => {
            void addDeck(deckId)
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

function GuidePreview({ decks, cards }: { decks: GuidesV3DeckDetail[]; cards: GuideCardPlacement[] }) {
  const nodes = new Map(decks.flatMap(deck => deckCardEntries(deck).map(card => [deck.id + ':' + card.key, card.node] as const)))
  const visible = cards.filter(card => !card.hidden)
  return <section className={styles.previewStack} aria-label="Guide preview">
    {visible.length ? visible.map(card => <div key={guideCardKey(card)} className={styles.previewShareMount}>{nodes.get(guideCardKey(card))}</div>) : <p>No visible cards. Unhide a card in the Decks tab.</p>}
  </section>
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
        {error ? <p role="alert" className={styles.saveError}>{error}</p> : null}
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
                  disabled={isLoading}
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
