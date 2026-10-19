'use client'

import { useEffect, useState } from 'react'
import { useRouter } from '@/app/components/navigation-feedback/navigation-provider'
import { upgradeDeckToGuide } from '../../actions'
import styles from './deck-editor-client.module.css'

// One upgrade per deck per page load, even if effects run twice.
const pending = new Map<string, Promise<{ guideId: string }>>()

// Editing a deck opens it as a full guide: the deck becomes that guide's own
// cards (see upgradeDeckToGuide), then the guide editor takes over.
export default function UpgradeDeckToGuide({ deckId }: { deckId: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let upgrade = pending.get(deckId)
    if (!upgrade) {
      upgrade = upgradeDeckToGuide(deckId)
      pending.set(deckId, upgrade)
    }
    upgrade
      .then(({ guideId }) => {
        if (active) router.replace(`/guides/${guideId}?preview=1&edit=1&editorTab=decks`)
      })
      .catch((reason) => {
        pending.delete(deckId)
        if (active) setError(reason instanceof Error ? reason.message : 'Could not open the guide editor.')
      })
    return () => { active = false }
  }, [deckId, router])

  return (
    <section className={styles.deckEditorPage}>
      <div className={styles.editorFrame}>
        <section className={styles.panel} aria-live="polite">
          {error ? <p role="alert" className={styles.saveError}>{error}</p> : <p>Opening the guide editor…</p>}
        </section>
      </div>
    </section>
  )
}
