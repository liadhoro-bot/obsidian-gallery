'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import type { OgSize } from '../types'
import { cx } from '../utils'
import styles from '../primitives.module.css'
import feedbackStyles from './button-feedback.module.css'

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
  const form = useFormStatus()
  const busy = loading || (type === 'submit' && form.pending)
  return (
    <button
      {...props}
      aria-busy={busy || undefined}
      className={cx(styles.button, className)}
      data-size={size}
      data-variant={variant}
      disabled={disabled || busy}
      type={type}
    >
      {busy ? <span className={feedbackStyles.spinner} aria-hidden="true" /> : icon ? <span className={styles.buttonIcon} aria-hidden="true">{icon}</span> : null}
      {children}
      {busy ? <span className="sr-only" role="status">Working…</span> : null}
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
