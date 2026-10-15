'use client'

import styles from '../decks/[id]/deck-editor-client.module.css'

export type PaintVerticalAlignment = 'top' | 'center' | 'bottom'

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

const verticalOptions: Array<{ value: PaintVerticalAlignment; icon: string; label: string }> = [
  { value: 'top', icon: '↑', label: 'Align paints to top' },
  { value: 'center', icon: '↕', label: 'Align paints to center' },
  { value: 'bottom', icon: '↓', label: 'Align paints to bottom' },
]

export function PaintVerticalAlignmentPicker({
  value = 'top',
  onChange,
}: {
  value?: PaintVerticalAlignment
  onChange: (value: PaintVerticalAlignment) => void
}) {
  return (
    <div role="radiogroup" aria-label="Vertical paint alignment" className={styles.paintAlignmentToggle}>
      <span className={styles.paintAlignmentTrack}>
        {verticalOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-label={option.label}
            aria-checked={value === option.value}
            data-active={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.icon}
          </button>
        ))}
      </span>
    </div>
  )
}
