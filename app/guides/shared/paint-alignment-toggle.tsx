'use client'

import styles from '../decks/[id]/deck-editor-client.module.css'

export function PaintAlignmentToggle({
  value = 'left',
  onChange,
}: {
  value?: 'left' | 'right'
  onChange: (value: 'left' | 'right') => void
}) {
  const right = value === 'right'
  return (
    <button
      type="button"
      role="switch"
      aria-label="Align paints right"
      aria-checked={right}
      className={styles.paintAlignmentToggle}
      onClick={() => onChange(right ? 'left' : 'right')}
    >
      <span className={styles.paintAlignmentTrack} aria-hidden="true" data-right={right}>
        <span>←</span><span>→</span>
      </span>
      <span>Aligned {value}</span>
    </button>
  )
}
