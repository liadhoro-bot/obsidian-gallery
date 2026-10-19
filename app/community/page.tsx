import { Suspense } from 'react'
import CommunityV3Preview from './community-v3-preview'
import { getUpcomingCommunityEvents } from './events-queries'

export default function CommunityPage() {
  // Not awaited: only the Events tab waits for this.
  const eventsPromise = getUpcomingCommunityEvents()

  return (
    <Suspense fallback={null}>
      <CommunityV3Preview eventsPromise={eventsPromise} />
    </Suspense>
  )
}
