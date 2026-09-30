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
}: {
  deck: GuidesV3DeckDetail
  featureGuides: FeatureGuideEntry[]
  initialInventoryNotes?: string
  initialExpertTips?: string
}) {
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
          title: card.title,
          template: card.template,
          body: card.body,
          image: card.image,
          videoUrl: card.videoUrl,
          paintAlignment: card.paintAlignment ?? 'left',
          subtitle: card.subtitle ?? null,
          imageFocalX: card.imageFocalX,
          imageFocalY: card.imageFocalY,
          paints: card.paints?.map((paint) => ({
            id: paint.id,
            ratio_text: paint.ratio_text ?? null,
          })),
        })),
      })

      router.refresh()
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
      backHref="/guides?preview=1"
      featureGuides={featureGuides}
      initialInventoryNotes={initialInventoryNotes}
      initialExpertTips={initialExpertTips}
      isSaving={isSaving}
      onDeleteDeck={handleDeleteDeck}
      onSaveDraft={handleSaveDraft}
      onTogglePaintOwnership={handleTogglePaintOwnership}
      saveError={saveError}
      saveLabel="Save"
    />
  )
}
