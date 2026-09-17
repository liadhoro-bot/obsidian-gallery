import { redirect } from 'next/navigation'
import Image from 'next/image'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import { getSubscriptionStatus } from '../../lib/subscription/subscription-guard'
import authStyles from '../auth-flow-silver.module.css'
import styles from './subscribe-silver.module.css'
import SubscribeClient from './subscribe-client'

type SubscribePageProps = {
  searchParams?: Promise<{ next?: string }>
}

function safeNextPath(value: string | undefined) {
  if (!value?.startsWith('/')) {
    return '/dashboard'
  }

  return value
}

// Founding-member enrollment window: access always runs through the same
// end date regardless of purchase day, so only the end date is fixed here —
// the start is just "today" from the viewer's perspective.
const FOUNDERS_ACCESS_END = 'November 18, 2026'

function formatAccessStart(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(date)
}

function ImageIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="8.5" cy="9.5" r="1.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 16.5l5-4.5 4 3 3-2.5 4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CrownIcon() {
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

function TrophyIcon() {
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

export default async function SubscribePage({ searchParams }: SubscribePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const nextPath = safeNextPath(resolvedSearchParams?.next)

  const supabase = await createClient()
  const user = await getSessionUser(supabase)

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }

  const status = await getSubscriptionStatus(user.email)

  if (status.isActive) {
    redirect(nextPath)
  }

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

          <div className={styles.introBlock}>
            <h1 className={styles.pageTitle}>Your chapter begins here.</h1>
            <p className={styles.pageCopy}>
              Claim your Founder&apos;s Pass to unlock Obsidian Gallery and take
              your place at the table from day one.
            </p>
          </div>

          <div className={styles.passCard}>
            <div className={styles.passHeader}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-192.png" alt="" className={styles.passIcon} />
              <div className={styles.passHeaderText}>
                <span className={styles.passTitle}>Founder&apos;s Pass</span>
              </div>
              <span className={styles.passPrice}>₪15</span>
            </div>

            <span className={styles.passSubtitle}>
              One-time payment · Access {formatAccessStart(new Date())} – {FOUNDERS_ACCESS_END}
            </span>

            <div className={styles.benefitRow}>
              <div className={styles.benefitItem}>
                <span className={styles.benefitIcon}>
                  <ImageIcon />
                </span>
                <span className={styles.benefitLabel}>Full App Access</span>
              </div>

              <div className={styles.benefitItem}>
                <span className={styles.benefitIcon}>
                  <CrownIcon />
                </span>
                <span className={styles.benefitLabel}>Founding Member Seal</span>
              </div>

              <div className={styles.benefitItem}>
                <span className={styles.benefitIcon}>
                  <TrophyIcon />
                </span>
                <span className={styles.benefitLabel}>Contest Eligibility</span>
              </div>
            </div>
          </div>

          <SubscribeClient email={user.email ?? ''} nextPath={nextPath} />

          <p className={styles.footerTag}>Your Miniatures Deserve Better</p>
        </div>
      </div>
    </main>
  )
}
