import Image from 'next/image'
import Link from 'next/link'
import { getSupabaseImageUrl } from '../../utils/images/supabase-image'
import { createPerfTimer } from '../../utils/perf/server'
import {
  getDashboardCurrentUser,
  getDashboardProfile,
} from './dashboard-data'
import SupportButton from '../components/SupportButton'
import DownloadAppButton from '../components/download-app-button'
import styles from './dashboard-og.module.css'

type ProfileResult = {
  data: {
    avatar_url: string | null
    level: number | null
    username: string | null
  } | null
}

type ProfilePromise = Promise<ProfileResult>

type DashboardTopBarProps = {
  userId?: string
  profilePromise?: ProfilePromise
}

function getAvatarInitials(username?: string | null) {
  const letters = (username || '').replace(/^@/, '').match(/[a-z0-9]/gi)

  return letters?.slice(0, 2).join('').toUpperCase() || 'OG'
}

export default async function DashboardTopBar({
  userId,
  profilePromise,
}: DashboardTopBarProps) {
  const perf = createPerfTimer('/dashboard:topbar')
  let profile: ProfileResult['data'] = null

  if (profilePromise) {
    const result = await perf.measure('profile promise', async () => profilePromise)
    profile = result.data
  } else {
    let resolvedUserId = userId

    if (!resolvedUserId) {
      resolvedUserId = (await perf.measure('current user', async () =>
        getDashboardCurrentUser()
      ))?.id
    }

    if (resolvedUserId) {
      profile = await perf.measure('profile fetch', async () =>
        getDashboardProfile(resolvedUserId)
      )
    }
  }
  perf.total()

  const avatarUrl = getSupabaseImageUrl(profile?.avatar_url, {
    width: 96,
    height: 96,
    quality: 60,
    resize: 'cover',
  })
  const level = profile?.level ?? 0
  const avatarInitials = getAvatarInitials(profile?.username)

  return (
    <div className={styles.dashboardTopBar}>
      <div className={styles.profileCluster}>
        <Link
          href="/settings"
          className={styles.avatarLink}
          aria-label="Open settings"
        >
          {avatarUrl ? (
            <div className={styles.avatar}>
              <Image
                src={avatarUrl}
                alt="User avatar"
                fill
                className="object-cover"
                sizes="52px"
              />
            </div>
          ) : (
            <div className={styles.avatar}>{avatarInitials}</div>
          )}
        </Link>

        <div>
          <p className={styles.brandLabel}>Obsidian Gallery</p>
          <p className={styles.levelText}>Lv. {level} Painter</p>
        </div>
      </div>

      <div className={styles.headerActions}>
        <DownloadAppButton className={styles.inlineLinkButton} />
        <SupportButton className={styles.inlineLinkButton} />
      </div>
    </div>
  )
}

