import type { CSSProperties, HTMLAttributes } from 'react'

import { cx } from '../utils'
import styles from '../primitives.module.css'

export type OgProgressTrackProps = HTMLAttributes<HTMLDivElement> & {
  label: string
  max?: number
  value: number
}

export function OgProgressTrack({
  className,
  label,
  max = 100,
  style,
  value,
  ...props
}: OgProgressTrackProps) {
  const boundedMax = max > 0 ? max : 100
  const boundedValue = Math.min(Math.max(value, 0), boundedMax)
  const percentage = `${(boundedValue / boundedMax) * 100}%`
  const progressStyle = {
    ...style,
    '--og-progress-value': percentage,
  } as CSSProperties

  return (
    <div
      {...props}
      aria-label={label}
      aria-valuemax={boundedMax}
      aria-valuemin={0}
      aria-valuenow={boundedValue}
      className={cx(styles.progressTrack, className)}
      role="progressbar"
      style={progressStyle}
    >
      <span className={styles.progressFill} />
    </div>
  )
}
