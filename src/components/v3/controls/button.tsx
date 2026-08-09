import type { ButtonHTMLAttributes, ReactNode } from 'react'

import type { OgSize } from '../types'
import { cx } from '../utils'
import styles from '../primitives.module.css'

export type OgButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'destructive'
  | 'success'

export type OgButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode
  loading?: boolean
  size?: OgSize
  variant?: OgButtonVariant
}

export function OgButton({
  children,
  className,
  disabled,
  icon,
  loading = false,
  size = 'default',
  type = 'button',
  variant = 'secondary',
  ...props
}: OgButtonProps) {
  return (
    <button
      {...props}
      aria-busy={loading || undefined}
      className={cx(styles.button, className)}
      data-size={size}
      data-variant={variant}
      disabled={disabled || loading}
      type={type}
    >
      {icon ? <span className={styles.buttonIcon} aria-hidden="true">{icon}</span> : null}
      {children}
    </button>
  )
}

export type OgIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string
  size?: OgSize
  variant?: OgButtonVariant
}

export function OgIconButton({
  children,
  className,
  label,
  size = 'default',
  type = 'button',
  variant = 'tertiary',
  ...props
}: OgIconButtonProps) {
  return (
    <button
      {...props}
      aria-label={label}
      className={cx(styles.iconButton, className)}
      data-size={size}
      data-variant={variant}
      type={type}
    >
      {children}
    </button>
  )
}
