'use client'

import Link from 'next/link'
import type { HTMLAttributes, ReactNode } from 'react'

import { cx } from '../utils'
import styles from './topper.module.css'

/*
 * OgTopper - a slim parchment announcement strip pinned with four brass
 * rivets, for the top of a screen ("Founders Season - Final Days").
 * Title and dismiss are required; subtitle and CTA are optional.
 * The CTA renders as a Link when given `href`, otherwise as a button.
 *
 *   <OgTopper
 *     title="Founders Season – Final Days"
 *     subtitle="Secure exclusive rewards before it ends."
 *     cta={{ label: 'Claim Rewards', href: '/contests/founders' }}
 *     onDismiss={() => setHidden(true)}
 *   />
 */

export type OgTopperCta = {
  label: string
  href?: string
  onClick?: () => void
}

export type OgTopperProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  title: ReactNode
  subtitle?: ReactNode
  cta?: OgTopperCta
  onDismiss: () => void
  dismissLabel?: string
}

function CloseGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

export function OgTopper({
  title,
  subtitle,
  cta,
  onDismiss,
  dismissLabel = 'Dismiss',
  className,
  ...props
}: OgTopperProps) {
  const ctaContent = (
    <>
      <span>{cta?.label}</span>
      <span aria-hidden="true">→</span>
    </>
  )

  return (
    <aside {...props} className={cx(styles.topper, className)}>
      <span className={styles.rivet} data-corner="tl" aria-hidden="true" />
      <span className={styles.rivet} data-corner="tr" aria-hidden="true" />
      <span className={styles.rivet} data-corner="bl" aria-hidden="true" />
      <span className={styles.rivet} data-corner="br" aria-hidden="true" />

      <div className={styles.inner}>

      <div className={styles.copy}>
        <p className={styles.title}>{title}</p>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>

      {cta ? (
        cta.href ? (
          <Link href={cta.href} className={styles.cta} onClick={cta.onClick}>
            {ctaContent}
          </Link>
        ) : (
          <button type="button" className={styles.cta} onClick={cta.onClick}>
            {ctaContent}
          </button>
        )
      ) : null}

      <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label={dismissLabel}>
        <CloseGlyph />
      </button>
      </div>
    </aside>
  )
}
