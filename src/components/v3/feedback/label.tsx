import type { HTMLAttributes, ReactNode } from 'react'

import type { OgTone } from '../types'
import { cx } from '../utils'
import styles from '../primitives.module.css'

export type OgLabelProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode
  tone?: OgTone
}

export function OgLabel({
  children,
  className,
  tone = 'neutral',
  ...props
}: OgLabelProps) {
  return (
    <span {...props} className={cx(styles.label, className)} data-tone={tone}>
      {children}
    </span>
  )
}
