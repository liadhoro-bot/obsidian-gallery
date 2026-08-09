import type { HTMLAttributes, ReactNode } from 'react'

import { cx } from '../utils'
import styles from '../primitives.module.css'

export type OgPlaqueProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
  tone?: 'brass' | 'paper'
}

export function OgPlaque({
  children,
  className,
  tone = 'brass',
  ...props
}: OgPlaqueProps) {
  return (
    <span {...props} className={cx(styles.plaque, className)} data-tone={tone}>
      {children}
    </span>
  )
}
