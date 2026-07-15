'use client'

import dynamic from 'next/dynamic'

const DeferredUnitSessionTracker = dynamic(() => import('./unit-session-tracker'), {
  loading: () => (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="space-y-2">
        <div className="h-4 w-32 rounded bg-white/10" />
        <div className="h-8 w-40 rounded bg-white/10" />
        <div className="h-20 rounded-2xl bg-white/[0.04]" />
      </div>
    </section>
  ),
})

type Session = {
  id: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
  entry_source?: string | null
  notes?: string | null
}

export default function LazyUnitSessionTracker(props: {
  unitId: string
  activeSession: Session | null
  sessions: Session[]
  totalLoggedSeconds: number
  autoStart?: boolean
  onMutationCommitted?: () => void
  onStateChange?: (state: {
    activeSession: Session | null
    sessions: Session[]
    totalLoggedSeconds: number
  }) => void
}) {
  return <DeferredUnitSessionTracker {...props} />
}
