import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import styles from '../primitives.module.css'
import { cx } from '../utils'

type SurfacePanelProps = ComponentPropsWithoutRef<'section'> & {
  children: ReactNode
  density?: 'compact' | 'default' | 'spacious'
  elevation?: 'flat' | 'contact'
  tone?: 'primary' | 'secondary' | 'walnutInset'
}

export function SurfacePanel({
  children,
  className,
  density = 'default',
  elevation = 'flat',
  tone = 'primary',
  ...props
}: SurfacePanelProps) {
  return (
    <section
      className={cx(styles.surfacePanel, className)}
      data-density={density}
      data-elevation={elevation}
      data-tone={tone === 'walnutInset' ? 'walnut-inset' : tone}
      {...props}
    >
      {children}
    </section>
  )
}
