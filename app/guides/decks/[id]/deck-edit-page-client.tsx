'use client'

import { useRouter } from '@/app/components/navigation-feedback/navigation-provider'
import { useState } from 'react'
import { completeEditorExit } from '@/app/components/navigation-feedback/unsaved-changes'
import type { FeatureGuideEntry } from '../../../components/feature-guide-types'
import type { GuidesV3DeckDetail } from '../../guides-v3-detail-data'
import { deleteDeck, toggleDeckPaintOwnership, updateDeckFromForge } from '../../actions'
import DeckEditorClient, { type DeckEditorSavePayload } from './deck-editor-client'

export default function DeckEditPageClient({
  deck,
  featureGuides,
  initialInventoryNotes = '',
  initialExpertTips = '',
  inlineGuide,
  openAddCard = false,
  openCardId,
}: {
  deck: GuidesV3DeckDetail
  featureGuides: FeatureGuideEntry[]
  initialInventoryNotes?: string
  initialExpertTips?: string
  // A guide's own cards: saving returns to that guide's Contents.
  inlineGuide?: { id: string; title: string }
  openAddCard?: boolean
  openCardId?: string
}) {
  const guideContentsHref = inlineGuide ? `/guides/${inlineGuide.id}?preview=1&edit=1&editorTab=decks` : null
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleSaveDraft(payload: DeckEditorSavePayload) {
    setSaveError(null)
    setIsSaving(true)
    try {
      await updateDeckFromForge(deck.id, {
        title: payload.title,
        description: payload.description,
        status: payload.status,
        difficulty: payload.difficulty,
        image: payload.heroImage,
        heroFocalX: payload.heroFocalX,
        heroFocalY: payload.heroFocalY,
        inventoryRequired: payload.inventoryNotes,
        expertTips: payload.expertTips,
        cards: payload.cards.map((card) => ({
          id: card.id,
          title: card.title,
          template: card.template,
          body: card.body,
          image: card.image,
          videoUrl: card.videoUrl,
          paintAlignment: card.paintAlignment ?? 'left',
          paintVerticalAlignment: card.paintVerticalAlignment ?? 'top',
          subtitle: card.subtitle ?? null,
          imageFocalX: card.imageFocalX,
          imageFocalY: card.imageFocalY,
          paints: card.paints?.map((paint) => ({
            id: paint.id,
            ratio_text: paint.ratio_text ?? null,
          })),
        })),
      })

      if (guideContentsHref) {
        completeEditorExit(() => router.replace(guideContentsHref))
      } else {
        router.refresh()
      }
      return true
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Could not save deck.'
      )
      return false
    } finally {
      setIsSaving(false)
    }
  }

  async function handleTogglePaintOwnership(formData: FormData) {
    await toggleDeckPaintOwnership(formData)
    router.refresh()
  }

  async function handleDeleteDeck() {
    await deleteDeck(deck.id)
    completeEditorExit(() => router.replace('/guides'))
  }

  return (
    <DeckEditorClient
      deck={deck}
      backHref={guideContentsHref ?? '/guides?preview=1&tab=guides'}
      featureGuides={featureGuides}
      initialInventoryNotes={initialInventoryNotes}
      initialExpertTips={initialExpertTips}
      isSaving={isSaving}
      inlineGuide={inlineGuide}
      openAddCard={openAddCard}
      openCardId={openCardId}
      onExit={guideContentsHref ? () => router.replace(guideContentsHref) : undefined}
      onDeleteDeck={inlineGuide ? undefined : handleDeleteDeck}
      onSaveDraft={handleSaveDraft}
      onTogglePaintOwnership={handleTogglePaintOwnership}
      saveError={saveError}
      saveLabel="Save"
    />
  )
}
