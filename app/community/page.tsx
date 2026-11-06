import { Suspense } from 'react'
import { isCurrentUserAdmin } from '../../lib/admin'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import CommunityV3Preview from './community-v3-preview'
import { getUpcomingCommunityEvents } from './events-queries'
import { getLatestNews } from './news/news-queries'

const LATEST_NEWS_COUNT = 3

async function canManageNews() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  return user ? isCurrentUserAdmin(user.id) : false
}

export default function CommunityPage() {
  // Not awaited: only the tab that shows each one waits for it.
  const eventsPromise = getUpcomingCommunityEvents()
  const newsPromise = getLatestNews(LATEST_NEWS_COUNT)
  const canManageNewsPromise = canManageNews()

  return (
    <Suspense fallback={null}>
      <CommunityV3Preview
        canManageNewsPromise={canManageNewsPromise}
        eventsPromise={eventsPromise}
        newsPromise={newsPromise}
      />
    </Suspense>
  )
}
