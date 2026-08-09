import type { HTMLAttributes, ReactNode } from 'react'

import type { OgTone } from '../types'
import { cx } from '../utils'
import styles from '../primitives.module.css'

export type OgBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
  tone?: OgTone
}

export function OgBadge({
  children,
  className,
  tone = 'neutral',
  ...props
}: OgBadgeProps) {
  return (
    <span {...props} className={cx(styles.badge, className)} data-tone={tone}>
      {children}
    </span>
  )
}
