import { redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../../utils/supabase/server'
import { createServiceRoleClient } from '../../../utils/supabase/service-role'
import { isCurrentUserAdmin } from '../../../lib/admin'
import { eligibleTarget, renderMessage } from '../../../lib/engage/candidates'
import { planPushes } from '../../../lib/engage/push-dispatch'
import {
  LIFECYCLE_LABELS,
  LIFECYCLE_STATES,
  type EngagementMessage,
  type LifecycleState,
  type RenderedMessage,
  type UserLifecycle,
} from '../../../lib/engage/types'
import MessageControls from './message-controls'

// ENGAGE control room: lifecycle distribution, context modifiers,
// reachability, and the V1 message set with live previews, audience sizes
// and status switches. Admins only.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const SAMPLE = { unitId: 'sample', unitName: 'Tomb Guard', recipeId: 'sample', guideName: 'Weathered Bronze' }

function pct(part: number, whole: number) {
  return whole ? `${Math.round((part / whole) * 100)}%` : '–'
}

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="text-[0.68rem] font-bold uppercase tracking-wide text-white/50">{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
      {note ? <div className="text-xs text-white/50">{note}</div> : null}
    </div>
  )
}

function SurfaceMock({ rendered }: { rendered: RenderedMessage }) {
  if (rendered.surface === 'push') {
    return (
      <div className="rounded-2xl bg-[#e9edf1] p-3 text-[#1b1f24] shadow-inner">
        <div className="flex items-center gap-2 text-[0.7rem] text-[#5a6470]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="h-4 w-4 rounded" />
          Obsidian Gallery · now
        </div>
        <div className="mt-1 text-sm font-bold">{rendered.title}</div>
        <div className="text-sm leading-snug">{rendered.body}</div>
      </div>
    )
  }

  if (rendered.surface === 'email') {
    return (
      <div className="rounded-2xl bg-[#f6f1e7] p-4 text-[#2a2118]">
        <div className="text-[0.7rem] text-[#7a6a55]">Subject</div>
        <div className="font-bold">{rendered.title}</div>
        <p className="mt-2 text-sm leading-snug">{rendered.body}</p>
        <span className="mt-3 inline-block rounded-lg bg-[#b08a3e] px-3 py-1.5 text-sm font-bold text-[#1d160e]">
          {rendered.ctaLabel}
        </span>
      </div>
    )
  }

  return (
    <div
      className={`rounded-2xl border border-[#b08a3e]/70 bg-[#f6f1e7] text-[#2a2118] ${
        rendered.surface === 'popup' ? 'p-5' : 'p-3'
      }`}
    >
      {rendered.surface === 'popup' ? (
        <div className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-[#8a6a2a]">
          Obsidian Gallery
        </div>
      ) : null}
      <div className={rendered.surface === 'popup' ? 'mt-1 text-xl font-bold' : 'font-bold'}>{rendered.title}</div>
      <p className="mt-1 text-sm leading-snug text-[#5a4a38]">{rendered.body}</p>
      <div className="mt-3 flex items-center gap-3">
        <span
          className={`inline-block rounded-lg bg-[#c9a24e] px-3 py-1.5 text-sm font-extrabold text-[#1d160e] ${
            rendered.surface === 'popup' ? 'w-full text-center' : ''
          }`}
        >
          {rendered.ctaLabel}
        </span>
        {rendered.surface === 'topper' ? <span className="text-sm font-bold text-[#5a4a38]">Not now</span> : null}
      </div>
      {rendered.surface === 'popup' ? (
        <div className="mt-2 text-center text-sm font-bold text-[#5a4a38]">Not now</div>
      ) : null}
    </div>
  )
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-white/10 text-white/70',
  review: 'bg-amber-300/20 text-amber-100',
  live: 'bg-emerald-300/20 text-emerald-100',
  paused: 'bg-red-300/20 text-red-100',
}

async function loadOverview() {
  const now = Date.now()
  const since = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
  const service = createServiceRoleClient()
  const { planned, messages, refreshed } = await planPushes(now, { refresh: true })
  const [{ data: lifecycleRows }, { data: deliveries }, { data: funnel }] = await Promise.all([
    service.from('user_lifecycle').select('*'),
    service
      .from('engagement_deliveries')
      .select('message_key, status, is_preview')
      .gte('created_at', since),
    service
      .from('notification_permission_events')
      .select('event_type, source')
      .gte('created_at', since),
  ])

  return { planned, messages, refreshed, lifecycleRows, deliveries, funnel, now }
}

export default async function AdminEngagePage() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) redirect('/login?next=%2Fadmin%2Fengage')
  if (!(await isCurrentUserAdmin(user.id))) redirect('/dashboard')

  const { planned, messages, refreshed, lifecycleRows, deliveries, funnel, now } = await loadOverview()
  const lifecycles = (lifecycleRows ?? []) as UserLifecycle[]
  const byState = new Map<LifecycleState, UserLifecycle[]>(LIFECYCLE_STATES.map((state) => [state, []]))
  for (const row of lifecycles) byState.get(row.lifecycle_state)?.push(row)

  const modifiers: [string, number][] = [
    ['Active Unit', lifecycles.filter((row) => row.active_unit_count > 0).length],
    ['Stale Unit (3d+)', lifecycles.filter((row) => row.stale_active_unit_count > 0).length],
    ['Draft Guide', lifecycles.filter((row) => row.draft_guide_count > 0).length],
    ['Assigned Guide', lifecycles.filter((row) => row.assigned_guide_count > 0).length],
    ['Saved Guide, unassigned', lifecycles.filter((row) => row.saved_guides_unassigned_count > 0).length],
    ['Deadline < 72h', lifecycles.filter((row) => row.deadline_within_72h).length],
    ['Scheduled session < 24h', lifecycles.filter((row) => row.scheduled_session_within_24h).length],
    ['Recent social reward', lifecycles.filter((row) => row.recent_social_reward_count > 0).length],
    ['Upcoming event < 24h', lifecycles.filter((row) => row.upcoming_event_24h).length],
    ['Reactivated (7d flag)', lifecycles.filter((row) => row.reactivated_until && Date.parse(row.reactivated_until) > now).length],
    ['Notification Off', lifecycles.filter((row) => !row.push_subscription_active).length],
  ]

  const funnelCounts = new Map<string, number>()
  for (const row of funnel ?? []) funnelCounts.set(row.event_type, (funnelCounts.get(row.event_type) ?? 0) + 1)

  const deliveryCounts = new Map<string, Record<string, number>>()
  for (const row of deliveries ?? []) {
    if (row.is_preview) continue
    const counts = deliveryCounts.get(row.message_key) ?? {}
    counts[row.status] = (counts[row.status] ?? 0) + 1
    deliveryCounts.set(row.message_key, counts)
  }

  function audience(message: EngagementMessage) {
    const eligible = lifecycles.filter((row) => eligibleTarget(message, row, now) !== null)
    const byStateCounts = LIFECYCLE_STATES.map(
      (state) => [state, eligible.filter((row) => row.lifecycle_state === state).length] as const
    ).filter(([, count]) => count > 0)
    return { total: eligible.length, byStateCounts }
  }

  const sorted = [...messages].sort(
    (a, b) => (a.v1_number ?? 99) - (b.v1_number ?? 99) || a.surface.localeCompare(b.surface)
  )

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-28 pt-6 sm:max-w-3xl">
        <header>
          <h1 className="text-3xl font-black">ENGAGE</h1>
          <p className="mt-2 text-sm text-white/60">
            Lifecycle state owns the next engagement decision. {refreshed} users recomputed just now.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-black">Lifecycle state</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {LIFECYCLE_STATES.map((state) => {
              const rows = byState.get(state) ?? []
              const push = rows.filter((row) => row.push_subscription_active).length
              const email = rows.filter((row) => row.email_status === 'deliverable').length
              return (
                <Stat
                  key={state}
                  label={LIFECYCLE_LABELS[state]}
                  value={rows.length}
                  note={`push ${pct(push, rows.length)} · email ${pct(email, rows.length)}`}
                />
              )
            })}
          </div>
          <p className="text-xs text-white/45">
            Active: 1+ Core Progress Action in 7 days. Passive: none, but 2+ visit days. At Risk: none, 0–1
            visits, seen within 21 days. Dormant: 22+ days. Unactivated: no Core Progress Action ever. Visits
            are recorded from this release on; until then a progress day or last sign-in stands in.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black">Context modifiers</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {modifiers.map(([label, count]) => (
              <Stat key={label} label={label} value={count} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-black">Push opt-in funnel · 30 days</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Soft prompt shown" value={funnelCounts.get('soft_prompt_shown') ?? 0} />
            <Stat label="Chose Enable" value={funnelCounts.get('soft_prompt_enable') ?? 0} />
            <Stat label="Native prompt" value={funnelCounts.get('native_prompt_requested') ?? 0} />
            <Stat label="Granted" value={funnelCounts.get('permission_granted') ?? 0} />
            <Stat label="Denied" value={funnelCounts.get('permission_denied') ?? 0} />
            <Stat label="Skipped" value={funnelCounts.get('soft_prompt_skipped') ?? 0} />
            <Stat label="Dismissed" value={funnelCounts.get('soft_prompt_dismissed') ?? 0} />
            <Stat label="Turned off" value={funnelCounts.get('subscription_removed') ?? 0} />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-black">V1 messages</h2>
            <p className="mt-1 text-sm text-white/55">
              Review = previews only. Live in-app messages show to eligible users on their next visit; live
              pushes go out on the daily 16:00 UTC run (max 2 per user per 7 days, one per run).
            </p>
          </div>

          {sorted.map((message) => {
            const sample = renderMessage(message, 'sample', SAMPLE, true)
            const { total, byStateCounts } = audience(message)
            const plannedCount = planned.filter((plan) => plan.messageKey === message.key).length
            const counts = deliveryCounts.get(message.key) ?? {}
            return (
              <article key={message.key} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-black text-white/50">#{message.v1_number}</span>
                  <span className="font-black">{message.key}</span>
                  <span className="rounded-full bg-cyan-300/15 px-2 py-0.5 text-xs font-bold text-cyan-100">
                    {message.surface}
                  </span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-white/70">
                    {message.value_pillar}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[message.status]}`}>
                    {message.status}
                  </span>
                </div>

                <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_1fr]">
                  <SurfaceMock rendered={sample} />
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt className="text-xs font-bold uppercase text-white/45">Who</dt>
                      <dd className="text-white/80">{message.eligibility}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase text-white/45">Eligible right now</dt>
                      <dd className="text-white/80">
                        {total} {total === 1 ? 'user' : 'users'}
                        {byStateCounts.length
                          ? ` (${byStateCounts.map(([state, count]) => `${LIFECYCLE_LABELS[state]} ${count}`).join(', ')})`
                          : ''}
                        {message.surface === 'push' ? ` · ${plannedCount} after push-on + cadence` : ''}
                        {message.surface === 'popup' || message.surface === 'topper'
                          ? ' · device push state is checked at display time'
                          : ''}
                        {message.surface === 'email' ? ' · not sendable: no sender domain or marketing consent yet' : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase text-white/45">Hypothesis → success</dt>
                      <dd className="text-white/80">
                        {message.hypothesis} → {message.success_event}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase text-white/45">Last 30 days</dt>
                      <dd className="text-white/80">
                        {['shown', 'sent', 'clicked', 'dismissed']
                          .map((status) => `${counts[status] ?? 0} ${status}`)
                          .join(' · ')}
                      </dd>
                    </div>
                  </dl>
                </div>

                <MessageControls
                  messageKey={message.key}
                  surface={message.surface}
                  status={message.status}
                  previewPath={`/dashboard?engage_preview=${message.key}`}
                />
              </article>
            )
          })}
        </section>
      </div>
    </main>
  )
}
