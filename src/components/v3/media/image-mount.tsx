import type { HTMLAttributes, ReactNode } from 'react'

import { cx } from '../utils'
import styles from '../primitives.module.css'

export type OgImageMountProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  prominence?: 'default' | 'featured'
}

export function OgImageMount({
  children,
  className,
  prominence = 'default',
  ...props
}: OgImageMountProps) {
  return (
    <div {...props} className={cx(styles.imageMount, className)} data-prominence={prominence}>
      <div className={styles.imageMountFrame}>{children}</div>
    </div>
  )
}
