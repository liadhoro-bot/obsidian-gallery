import { redirect } from 'next/navigation'
import { revalidateTag } from 'next/cache'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import {
  getAccessState,
  getSubscriptionCacheTag,
  getSubscriptionStatus,
  getTrialCacheTag,
  hasAppAccess,
} from '../../lib/subscription/subscription-guard'
import {
  isMonthlyPaymentEnabled,
  isPricingV2Active,
} from '../../lib/subscription/pricing'
import { safeNextPath } from '../../lib/subscription/next-path'
import styles from './subscribe-silver.module.css'
import SubscribeClient from './subscribe-client'
import SubscribeShell, { BookIcon, CrownIcon, ImageIcon, TrophyIcon } from './subscribe-shell'

type SubscribePageProps = {
  searchParams?: Promise<{ next?: string }>
}

// Founding-member enrollment window: access always runs through the same
// end date regardless of purchase day, so only the end date is fixed here —
// the start is just "today" from the viewer's perspective.
const FOUNDERS_ACCESS_END = 'November 18, 2026'

function formatAccessStart(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(date)
}

export default async function SubscribePage({ searchParams }: SubscribePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const nextPath = safeNextPath(resolvedSearchParams?.next)

  const supabase = await createClient()
  const user = await getSessionUser(supabase)

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }

  if (isPricingV2Active()) {
    const access = await getAccessState(user)

    if (access.status === 'trial_available') {
      redirect(`/trial?next=${encodeURIComponent(nextPath)}`)
    }

    if (hasAppAccess(access)) {
      if (user.email) {
        revalidateTag(getSubscriptionCacheTag(user.email), { expire: 0 })
      }
      revalidateTag(getTrialCacheTag(user.id), { expire: 0 })
      redirect(nextPath)
    }

    return <TrialEndedView email={user.email ?? ''} nextPath={nextPath} />
  }

  const status = await getSubscriptionStatus(user.email)

  if (status.isActive) {
    revalidateTag(getSubscriptionCacheTag(user.email ?? ''), { expire: 0 })
    redirect(nextPath)
  }

  return (
    <SubscribeShell>
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
    </SubscribeShell>
  )
}

function TrialEndedView({ email, nextPath }: { email: string; nextPath: string }) {
  return (
    <SubscribeShell>
      <div className={styles.introBlock}>
        <h1 className={styles.pageTitle}>Your free trial has ended</h1>
        <p className={styles.pageCopy}>
          Continue for ₪10/month to keep full access to Obsidian Gallery.
        </p>
      </div>

      <div className={styles.passCard}>
        <div className={styles.passHeader}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className={styles.passIcon} />
          <div className={styles.passHeaderText}>
            <span className={styles.passTitle}>Monthly</span>
          </div>
          <span className={styles.passPrice}>₪10</span>
        </div>

        <span className={styles.passSubtitle}>Continue for ₪10/month</span>

        <div className={styles.benefitRow}>
          <div className={styles.benefitItem}>
            <span className={styles.benefitIcon}>
              <ImageIcon />
            </span>
            <span className={styles.benefitLabel}>Full App Access</span>
          </div>

          <div className={styles.benefitItem}>
            <span className={styles.benefitIcon}>
              <BookIcon />
            </span>
            <span className={styles.benefitLabel}>Guides &amp; Recipes</span>
          </div>

          <div className={styles.benefitItem}>
            <span className={styles.benefitIcon}>
              <TrophyIcon />
            </span>
            <span className={styles.benefitLabel}>Contest Eligibility</span>
          </div>
        </div>
      </div>

      {isMonthlyPaymentEnabled() ? (
        <SubscribeClient
          email={email}
          nextPath={nextPath}
          ctaLabel="Continue for ₪10/month"
        />
      ) : (
        <p className={styles.statusMessage}>
          Monthly subscriptions open very soon. We&apos;ll let you know.
        </p>
      )}
    </SubscribeShell>
  )
}
