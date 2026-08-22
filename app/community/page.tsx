import { Suspense } from 'react'
import CommunityV3Preview from './community-v3-preview'

export default function CommunityPage() {
  return (
    <Suspense fallback={null}>
      <CommunityV3Preview />
    </Suspense>
  )
}
