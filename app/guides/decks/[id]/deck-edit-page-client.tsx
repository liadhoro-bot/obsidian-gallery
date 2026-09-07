'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { FeatureGuideEntry } from '../../../components/feature-guide-types'
import type { GuidesV3DeckDetail } from '../../guides-v3-detail-data'
import { updateDeckFromForge } from '../../actions'
import DeckEditorClient, { type DeckEditorSavePayload } from './deck-editor-client'

export default function DeckEditPageClient({
  deck,
  featureGuides,
}: {
  deck: GuidesV3DeckDetail
  featureGuides: FeatureGuideEntry[]
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
          cards: payload.cards.map((card) => ({
            title: card.title,
            template: card.template,
            body: card.body,
            image: card.image,
            paints: card.paints?.map((paint) => ({
              id: paint.id,
              ratio_text: paint.ratio_text ?? null,
            })),
          })),
        })

        router.push(`/guides/decks/${deck.id}?preview=1`)
        router.refresh()
      } catch (error) {
        setSaveError(
          error instanceof Error ? error.message : 'Could not save deck.'
        )
      }
    })
  }

  return (
    <DeckEditorClient
      deck={deck}
      backHref={`/guides/decks/${deck.id}?preview=1`}
      featureGuides={featureGuides}
      isSaving={isSaving}
      onSaveDraft={handleSaveDraft}
      saveError={saveError}
      saveLabel="Save"
    />
  )
}
