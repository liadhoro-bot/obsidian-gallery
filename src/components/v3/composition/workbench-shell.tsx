import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from 'react'
import styles from '../primitives.module.css'
import { cx } from '../utils'

type WorkbenchShellProps = ComponentPropsWithoutRef<'main'> & {
  children: ReactNode
  contentClassName?: string
  gutter?: 'none' | 'default' | 'comfortable'
  hasBottomNav?: boolean
  maxWidth?: string
}

export function WorkbenchShell({
  children,
  className,
  contentClassName,
  gutter = 'default',
  hasBottomNav = true,
  maxWidth,
  style,
  ...props
}: WorkbenchShellProps) {
  const shellStyle = {
    ...style,
    ...(maxWidth ? { '--og-shell-max-width': maxWidth } : null),
  } as CSSProperties

  return (
    <main
      className={cx(styles.workbenchShell, className)}
      data-bottom-nav={hasBottomNav ? 'true' : undefined}
      style={shellStyle}
      {...props}
    >
      <div
        className={cx(styles.workbenchInner, contentClassName)}
        data-gutter={gutter === 'default' ? undefined : gutter}
      >
        {children}
      </div>
    </main>
  )
}
