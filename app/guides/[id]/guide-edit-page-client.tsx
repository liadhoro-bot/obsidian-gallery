'use client'

import { useRouter } from '@/app/components/navigation-feedback/navigation-provider'
import { useState } from 'react'
import type { FeatureGuideEntry } from '../../components/feature-guide-types'
import type { GuidesV3Deck } from '../guides-v3-data'
import type { GuidesV3DeckDetail, GuidesV3GuideDetail } from '../guides-v3-detail-data'
import { updateGuideFromDecks } from '../actions'
import GuideEditorClient, { type GuideEditorSavePayload } from './guide-editor-client'

export default function GuideEditPageClient({
  guide,
  memberDecks,
  availableDecks,
  deckDetails,
  initialCoverImage,
  featureGuides,
}: {
  guide: GuidesV3GuideDetail
  memberDecks: GuidesV3Deck[]
  availableDecks: GuidesV3Deck[]
  deckDetails: GuidesV3DeckDetail[]
  initialCoverImage: string
  featureGuides: FeatureGuideEntry[]
}) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleSaveDraft(payload: GuideEditorSavePayload) {
    setSaveError(null)
    setIsSaving(true)
    try {
      await updateGuideFromDecks(guide.id, {
        title: payload.title,
        description: payload.description,
        image: payload.image,
        status: payload.status,
        difficulty: payload.difficulty,
        deckIds: payload.deckIds,
      })

      router.refresh()
      return true
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Could not save guide.'
      )
      return false
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <GuideEditorClient
      guide={guide}
      memberDecks={memberDecks}
      availableDecks={availableDecks}
      deckDetails={deckDetails}
      initialCoverImage={initialCoverImage}
      backHref="/guides?preview=1"
      featureGuides={featureGuides}
      isSaving={isSaving}
      onSaveDraft={handleSaveDraft}
      saveError={saveError}
      saveLabel="Save"
    />
  )
}
