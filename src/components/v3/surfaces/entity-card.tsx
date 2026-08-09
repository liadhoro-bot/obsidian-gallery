import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import styles from '../primitives.module.css'
import { cx } from '../utils'

type EntityCardProps = ComponentPropsWithoutRef<'article'> & {
  children: ReactNode
  importance?: 'default' | 'featured'
  selected?: boolean
}

export function EntityCard({
  children,
  className,
  importance = 'default',
  selected,
  ...props
}: EntityCardProps) {
  return (
    <article
      className={cx(styles.entityCard, className)}
      data-importance={importance}
      data-selected={selected ? 'true' : undefined}
      {...props}
    >
      {children}
    </article>
  )
}
