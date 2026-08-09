import type { HTMLAttributes } from 'react'

import { cx } from '../utils'
import styles from '../primitives.module.css'

export type OgDividerProps = HTMLAttributes<HTMLHRElement> & {
  orientation?: 'horizontal' | 'vertical'
}

export function OgDivider({
  className,
  orientation = 'horizontal',
  ...props
}: OgDividerProps) {
  return (
    <hr
      {...props}
      aria-orientation={orientation}
      className={cx(styles.divider, className)}
      data-orientation={orientation}
    />
  )
}
