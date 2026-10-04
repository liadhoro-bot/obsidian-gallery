import { redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import {
  getAccessState,
  hasAppAccess,
} from '../../lib/subscription/subscription-guard'
import { isPricingV2Active } from '../../lib/subscription/pricing'
import { safeNextPath } from '../../lib/subscription/next-path'
import styles from '../subscribe/subscribe-silver.module.css'
import SubscribeShell, { BookIcon, ImageIcon } from '../subscribe/subscribe-shell'
import TrialClient from './trial-client'

export const dynamic = 'force-dynamic'

type TrialPageProps = {
  searchParams?: Promise<{ next?: string }>
}

export default async function TrialPage({ searchParams }: TrialPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const nextPath = safeNextPath(resolvedSearchParams?.next)

  if (!isPricingV2Active()) {
    redirect(`/subscribe?next=${encodeURIComponent(nextPath)}`)
  }

  const supabase = await createClient()
  const user = await getSessionUser(supabase)

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }

  const access = await getAccessState(user)

  if (hasAppAccess(access)) {
    redirect(nextPath)
  }

  if (access.status === 'trial_expired') {
    redirect(`/subscribe?next=${encodeURIComponent(nextPath)}`)
  }

  return (
    <SubscribeShell>
      <div className={styles.introBlock}>
        <h1 className={styles.pageTitle}>Start your 14-day free trial</h1>
        <p className={styles.pageCopy}>
          Full access to Obsidian Gallery for 14 days. No payment details needed.
        </p>
      </div>

      <div className={styles.passCard}>
        <div className={styles.passHeader}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className={styles.passIcon} />
          <div className={styles.passHeaderText}>
            <span className={styles.passTitle}>Free trial</span>
          </div>
          <span className={styles.passPrice}>14 days</span>
        </div>

        <span className={styles.passSubtitle}>
          When your trial ends, you can continue for ₪10/month.
        </span>

        <div className={`${styles.benefitRow} ${styles.benefitRowPair}`}>
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
        </div>
      </div>

      <TrialClient nextPath={nextPath} />
    </SubscribeShell>
  )
}
