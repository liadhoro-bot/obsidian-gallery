'use client'

import type { ReactNode } from 'react'
import styles from '../decks/[id]/deck-editor-client.module.css'
import { cardTypeDescription, cardTypeLabel, GUIDE_INDEX_TYPE_DESCRIPTION, type CardTypeId } from './card-templates'

// The card-type list for "New Card", shared by the guide and deck editors.
// The Index Card sits right under the Cover Card.
export function CardTypeSheet({
  templates,
  guideIndex,
  isBusy = false,
  error,
  onAddCard,
  onClose,
}: {
  templates: CardTypeId[]
  // The Index Card option; disabled shows the note instead of the description.
  guideIndex?: { disabled?: boolean; note?: string; onAdd: () => void }
  isBusy?: boolean
  error?: string | null
  onAddCard: (template: CardTypeId) => void
  onClose: () => void
}) {
  const indexOption = guideIndex ? (
    <button
      key="guide-index"
      type="button"
      className={styles.templateButton}
      disabled={isBusy || guideIndex.disabled}
      onClick={guideIndex.onAdd}
    >
      <span className={styles.cardTypeIcon} aria-label="Index card">Index</span>
      <span>
        <strong>Index Card</strong>
        <small>{guideIndex.disabled && guideIndex.note ? guideIndex.note : GUIDE_INDEX_TYPE_DESCRIPTION}</small>
      </span>
    </button>
  ) : null
  const coverFirst = templates[0] === 'cover'

  return (
    <div className={styles.sheetBackdrop} role="dialog" aria-modal="true" aria-label="Add New Card">
      <section className={styles.sheet}>
        <header>
          <h2>Add New Card</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        {error ? <p role="alert" className={styles.saveError}>{error}</p> : null}
        <div className={styles.templateGrid}>
          {coverFirst ? null : indexOption}
          {templates.map((template) => (
            <TemplateOption key={template} template={template} disabled={isBusy} onAdd={onAddCard} after={template === 'cover' ? indexOption : null} />
          ))}
        </div>
      </section>
    </div>
  )
}

function TemplateOption({
  template,
  disabled,
  onAdd,
  after,
}: {
  template: CardTypeId
  disabled: boolean
  onAdd: (template: CardTypeId) => void
  after: ReactNode
}) {
  const label = cardTypeLabel(template)
  return (
    <>
      <button type="button" className={styles.templateButton} disabled={disabled} onClick={() => onAdd(template)}>
        <span className={styles.cardTypeIcon} aria-label={`${label} card`}>{label}</span>
        <span>
          <strong>{label} Card</strong>
          <small>{cardTypeDescription(template)}</small>
        </span>
      </button>
      {after}
    </>
  )
}

export type AddContentOption = { key: string; kind: string; title: string; note: string; disabled?: boolean }

// The "+ Add" chooser used by both editors: one entry point for new cards
// and reused guides.
export function AddContentSheet({
  options,
  onChoose,
  onClose,
}: {
  options: AddContentOption[]
  onChoose: (key: string) => void
  onClose: () => void
}) {
  return (
    <div className={styles.sheetBackdrop} role="dialog" aria-modal="true" aria-label="Add to this guide">
      <section className={styles.sheet}>
        <header>
          <h2>Add</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            Close
          </button>
        </header>
        <div className={styles.cardList}>
          {options.map((option) => (
            <article key={option.key} className={`${styles.cardRow} ${styles.addDeckRow} ${styles.addMenuRow}`}>
              <span className={styles.cardNumber} aria-hidden="true" />
              <span className={styles.cardInfo}>
                <span className={styles.cardTypeLabel}>{option.kind}</span>
                <span className={styles.cardName}>{option.title}</span>
                <small className={styles.guideIndexNote}>{option.note}</small>
              </span>
              <button
                type="button"
                className={styles.editButton}
                disabled={option.disabled}
                aria-label={`Add ${option.title}`}
                onClick={() => onChoose(option.key)}
              >
                Add
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
