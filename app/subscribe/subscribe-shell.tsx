import type { ReactNode } from 'react'
import Image from 'next/image'
import authStyles from '../auth-flow-silver.module.css'
import styles from './subscribe-silver.module.css'

/** Hero frame shared by the /subscribe and /trial gate pages. */
export default function SubscribeShell({ children }: { children: ReactNode }) {
  return (
    <main className={authStyles.authRoot}>
      <div className={authStyles.authFrame}>
        <Image
          src="/onboarding/welcome-hero.jpeg"
          alt="Miniature painting hobby workspace"
          fill
          priority
          className={authStyles.heroImage}
        />

        <div className={authStyles.loginShade} />

        <div className={styles.pageContent}>
          <div className={styles.eyebrowRow}>
            <span className={styles.eyebrow}>Obsidian Gallery</span>
            <span className={styles.eyebrowDivider}>·</span>
            <span className={styles.eyebrow}>Create. Discover. Master. Share.</span>
          </div>

          {children}

          <p className={styles.footerTag}>Your Miniatures Deserve Better</p>
        </div>
      </div>
    </main>
  )
}

export function ImageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="8.5" cy="9.5" r="1.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 16.5l5-4.5 4 3 3-2.5 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CrownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 17.5h16M4.6 17.5l-1.4-9 5 3.4L12 5.5l3.8 6.4 5-3.4-1.4 9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function TrophyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 4h10v4a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M7 5.5H4.5a2 2 0 0 0 2 3.3M17 5.5h2.5a2 2 0 0 1-2 3.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 13v3.5M9 19.5h6M9.8 19.5l.6-3M14.2 19.5l-.6-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function BookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5v-15ZM20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5v-15Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}
