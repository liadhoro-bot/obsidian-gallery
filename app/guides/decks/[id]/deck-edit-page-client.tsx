'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { FeatureGuideEntry } from '../../../components/feature-guide-types'
import type { GuidesV3DeckDetail } from '../../guides-v3-detail-data'
import { toggleDeckPaintOwnership, updateDeckFromForge } from '../../actions'
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
  const [isSaving, startSaveTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)

  function handleSaveDraft(payload: DeckEditorSavePayload) {
    setSaveError(null)
    startSaveTransition(async () => {
      try {
        await updateDeckFromForge(deck.id, {
          title: payload.title,
          description: payload.description,
          status: payload.status,
          image: payload.heroImage,
          inventoryRequired: payload.inventoryNotes,
          expertTips: payload.expertTips,
          cards: payload.cards.map((card) => ({
            title: card.title,
            template: card.template,
            body: card.body,
            image: card.image,
            videoUrl: card.videoUrl,
            paints: card.paints?.map((paint) => ({
              id: paint.id,
              ratio_text: paint.ratio_text ?? null,
            })),
          })),
        })

        router.refresh()
      } catch (error) {
        setSaveError(
          error instanceof Error ? error.message : 'Could not save deck.'
        )
      }
    })
  }

  async function handleTogglePaintOwnership(formData: FormData) {
    await toggleDeckPaintOwnership(formData)
    router.refresh()
  }

  return (
    <DeckEditorClient
      deck={deck}
      backHref="/guides?preview=1"
      featureGuides={featureGuides}
      initialInventoryNotes={initialInventoryNotes}
      initialExpertTips={initialExpertTips}
      isSaving={isSaving}
      onSaveDraft={handleSaveDraft}
      onTogglePaintOwnership={handleTogglePaintOwnership}
      saveError={saveError}
      saveLabel="Save"
    />
  )
}
