'use client'

import Image from 'next/image'
import { useState } from 'react'
import type { Contest } from '../../lib/contests/types'
import type { ContestPickerSource } from '../../lib/contests/queries'
import PendingSubmitButton from './pending-submit-button'
import styles from './contest-v3-silver.module.css'

export default function NominateModal({
  action,
  contest,
  entryNounCapitalized,
  onClose,
  sources,
}: {
  action: (formData: FormData) => void
  contest: Contest
  entryNounCapitalized: string
  onClose: () => void
  sources: ContestPickerSource[]
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedSource = sources.find((source) => source.id === selectedId)

  return (
    <div
      className={styles.modalOverlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className={styles.modalPanel}>
        <div className={styles.modalHeader}>
          <h2>Nominate Your {entryNounCapitalized}</h2>
          <button
            type="button"
            className={styles.modalCloseButton}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {sources.length === 0 ? (
          <div className={styles.modalList}>
            <p className={styles.mutedText}>
              You don&apos;t have any eligible projects yet. Create one first, then come back
              to nominate it.
            </p>
          </div>
        ) : (
          <div className={styles.modalList}>
            {sources.map((source) => (
              <label key={`${source.sourceType}:${source.id}`} className={styles.modalPickerRow}>
                <input
                  type="checkbox"
                  checked={selectedId === source.id}
                  onChange={() =>
                    setSelectedId((current) => (current === source.id ? null : source.id))
                  }
                />
                <span className={styles.modalPickerThumb}>
                  {source.imageUrl ? (
                    <Image src={source.imageUrl} alt="" fill sizes="54px" className="object-cover" />
                  ) : null}
                </span>
                <span className={styles.modalPickerTitle}>{source.title}</span>
              </label>
            ))}
          </div>
        )}

        <form action={action} className={styles.modalFooter}>
          <input type="hidden" name="contestId" value={contest.id} />
          <input type="hidden" name="sourceType" value={selectedSource?.sourceType ?? ''} />
          <input type="hidden" name="sourceId" value={selectedId ?? ''} />
          <PendingSubmitButton
            disabled={!selectedId}
            pendingLabel="Nominating..."
            className={`${styles.brassButton} ${styles.ctaButtonFull}`}
          >
            Nominate This {entryNounCapitalized}
          </PendingSubmitButton>
        </form>
      </div>
    </div>
  )
}
