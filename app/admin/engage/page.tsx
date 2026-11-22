import { redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../../utils/supabase/server'
import { createServiceRoleClient } from '../../../utils/supabase/service-role'
import { isCurrentUserAdmin } from '../../../lib/admin'
import { eligibleTarget } from '../../../lib/engage/candidates'
import { planPushes } from '../../../lib/engage/push-dispatch'
import { messageLabel, simulateUser, type UserPlan } from '../../../lib/engage/simulate'
import {
  LIFECYCLE_LABELS,
  type EngagementMessage,
  type LifecycleState,
  type MessageSurface,
  type UserLifecycle,
} from '../../../lib/engage/types'
import DryRun from './dry-run'
import MessageCard from './message-card'
import UserLookup, { type LookupEntry } from './user-lookup'

// ENGAGE control room: where users are (state x context), who gets what
// (the map and every user), today's push dry run, the opt-in funnel, and the
// message set with previews, editing and status switches. Admins only.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DAY = 24 * 60 * 60 * 1000
const SAMPLE = { unitId: 'sample', unitName: 'Tomb Guard', recipeId: 'sample', guideName: 'Weathered Bronze' }

// Display order: active first, then the people we are trying to win back.
const STATE_ORDER: LifecycleState[] = ['active', 'passive', 'at_risk', 'dormant', 'unactivated']

const STATE_STYLE: Record<LifecycleState, { dot: string; text: string; ring: string }> = {
  active: { dot: 'bg-emerald-400', text: 'text-emerald-200', ring: 'border-emerald-400/40' },
  passive: { dot: 'bg-cyan-400', text: 'text-cyan-200', ring: 'border-cyan-400/40' },
  at_risk: { dot: 'bg-amber-400', text: 'text-amber-200', ring: 'border-amber-400/40' },
  dormant: { dot: 'bg-rose-400', text: 'text-rose-200', ring: 'border-rose-400/40' },
  unactivated: { dot: 'bg-slate-400', text: 'text-slate-300', ring: 'border-slate-400/40' },
}

const STATE_MEANING: Record<LifecycleState, string> = {
  active: 'Made progress in the last 7 days',
  passive: 'Opened the app 2+ days this week, no progress',
  at_risk: 'No progress, barely opened, seen in the last 3 weeks',
  dormant: 'Nothing for 22+ days',
  unactivated: 'Never made any progress',
}

const SURFACE_STYLE: Record<MessageSurface, string> = {
  push: 'border-sky-300/40 bg-sky-300/15 text-sky-50',
  popup: 'border-amber-300/40 bg-amber-300/15 text-amber-50',
  topper: 'border-emerald-300/40 bg-emerald-300/15 text-emerald-50',
  email: 'border-violet-300/40 bg-violet-300/15 text-violet-50',
}

const SURFACE_LABEL: Record<MessageSurface, string> = {
  push: 'Push',
  popup: 'Popup',
  topper: 'Topper',
  email: 'Email',
}

function days(fromIso: string | null, now: number) {
  if (!fromIso) return null
  return Math.max(0, Math.floor((now - Date.parse(fromIso)) / DAY))
}

function ago(fromIso: string | null, now: number, never = 'never') {
  const d = days(fromIso, now)
  return d === null ? never : d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}

const STATUS_GUIDE: { status: string; style: string; who: string; detail: string }[] = [
  {
    status: 'draft',
    style: 'border-white/15 bg-white/[0.04] text-white/70',
    who: 'Nobody',
    detail:
      'Work in progress. Left out of the map, every-user table and dry run. Preview in app and Send to my devices still work.',
  },
  {
    status: 'review',
    style: 'border-amber-300/30 bg-amber-300/[0.06] text-amber-100',
    who: 'Nobody yet, but counted',
    detail:
      'Real users see nothing. The map, every-user table and dry run count it as if it were live, so you can see who it would reach.',
  },
  {
    status: 'live',
    style: 'border-emerald-300/30 bg-emerald-300/[0.06] text-emerald-100',
    who: 'Real users',
    detail:
      'Popups and toppers show on their next app open; pushes go out on the next 16:00 UTC run. Email never goes live: you send it yourself.',
  },
  {
    status: 'paused',
    style: 'border-red-300/30 bg-red-300/[0.06] text-red-100',
    who: 'Nobody, stopped',
    detail:
      'Switched off right away and left out of the map. Its 30-day numbers stay. Use it to stop a live message without losing its history.',
  },
]

function Chip({
  surface,
  children,
  muted = false,
}: {
  surface?: MessageSurface
  children: React.ReactNode
  muted?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
        muted || !surface ? 'border-white/10 bg-white/[0.04] text-white/50' : SURFACE_STYLE[surface]
      }`}
    >
      {children}
    </span>
  )
}

function Count({ n }: { n: number }) {
  return <span className="rounded-full bg-black/30 px-1.5 text-[0.7rem] font-black">{n}</span>
}

function StateName({ state, count }: { state: LifecycleState; count?: number }) {
  return (
    <span className={`inline-flex items-center gap-2 font-black ${STATE_STYLE[state].text}`}>
      <span className={`h-2.5 w-2.5 rounded-full ${STATE_STYLE[state].dot}`} />
      {LIFECYCLE_LABELS[state]}
      {count === undefined ? null : <span className="text-white/50">{count}</span>}
    </span>
  )
}

async function loadOverview() {
  const now = Date.now()
  const since = new Date(now - 30 * DAY).toISOString()
  const service = createServiceRoleClient()
  const { planned, messages, refreshed } = await planPushes(now, { refresh: true })
  const [{ data: lifecycleRows }, { data: deliveries }, { data: profiles }] = await Promise.all([
    service.from('user_lifecycle').select('*'),
    service
      .from('engagement_deliveries')
      .select('message_key, channel, status, is_preview')
      .gte('created_at', since),
    service.from('profiles').select('id, display_name, username, email'),
  ])

  const lifecycles = (lifecycleRows ?? []) as UserLifecycle[]
  const unitIds = [...new Set(lifecycles.map((row) => row.focus_unit_id).filter((id): id is string => Boolean(id)))]
  const { data: units } = unitIds.length
    ? await service.from('units').select('id, name').in('id', unitIds)
    : { data: [] as { id: string; name: string }[] }

  return { planned, messages, refreshed, lifecycles, deliveries, profiles, units, now }
}

export default async function AdminEngagePage() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) redirect('/login?next=%2Fadmin%2Fengage')
  if (!(await isCurrentUserAdmin(user.id))) redirect('/dashboard')

  const { planned, messages, refreshed, lifecycles, deliveries, profiles, units, now } = await loadOverview()

  const messageByKey = new Map(messages.map((message) => [message.key, message]))
  const plannedByUser = new Map(planned.map((plan) => [plan.userId, plan.messageKey]))
  const unitName = new Map((units ?? []).map((unit) => [unit.id, unit.name as string]))
  const profileById = new Map((profiles ?? []).map((row) => [row.id as string, row]))
  const nameOf = (id: string) => {
    const row = profileById.get(id)
    return (row?.display_name || row?.username || row?.email || id.slice(0, 8)) as string
  }

  const users = lifecycles
    .map((lifecycle) => ({ lifecycle, plan: simulateUser(lifecycle, messages, plannedByUser.get(lifecycle.user_id), now) }))
    .sort(
      (a, b) =>
        STATE_ORDER.indexOf(a.lifecycle.lifecycle_state) - STATE_ORDER.indexOf(b.lifecycle.lifecycle_state) ||
        (days(a.lifecycle.last_visit_at, now) ?? 9999) - (days(b.lifecycle.last_visit_at, now) ?? 9999)
    )
  const byState = new Map<LifecycleState, typeof users>(STATE_ORDER.map((state) => [state, []]))
  for (const entry of users) byState.get(entry.lifecycle.lifecycle_state)?.push(entry)

  // --- Map tallies -----------------------------------------------------------
  function tally(entries: typeof users, keyOf: (plan: UserPlan) => string | null) {
    const counts = new Map<string, number>()
    for (const { plan } of entries) {
      const key = keyOf(plan)
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }

  // --- Funnel ------------------------------------------------------------------
  const funnel = new Map<string, number>()
  const deliveryCounts = new Map<string, Record<string, number>>()
  for (const row of deliveries ?? []) {
    if (row.channel === 'permission') {
      funnel.set(row.status, (funnel.get(row.status) ?? 0) + 1)
      continue
    }
    if (row.is_preview || !row.message_key) continue
    const counts = deliveryCounts.get(row.message_key) ?? {}
    counts[row.status] = (counts[row.status] ?? 0) + 1
    deliveryCounts.set(row.message_key, counts)
  }

  const emailList = users.filter(({ plan }) => plan.email)

  // --- Lookup ------------------------------------------------------------------
  const lookupEntries: LookupEntry[] = users.map(({ lifecycle: row, plan }) => {
    const profile = profileById.get(row.user_id)
    const focus = row.focus_unit_id ? unitName.get(row.focus_unit_id) : null
    const idle = days(row.focus_unit_last_activity_at, now)
    const cooldown = row.notification_opt_in_cooldown_until && Date.parse(row.notification_opt_in_cooldown_until) > now
    const askedAt = row.message_family_last_at?.notification_opt_in ?? null
    const push = row.push_subscription_active
      ? 'on'
      : row.push_platform_permission === 'denied'
        ? 'blocked in the browser'
        : row.push_platform_permission === 'unsupported'
          ? 'not supported on their device'
          : 'off'
    return {
      id: row.user_id,
      name: nameOf(row.user_id),
      username: (profile?.username as string | null) ?? '',
      email: (profile?.email as string | null) ?? '',
      stateLabel: LIFECYCLE_LABELS[row.lifecycle_state],
      stateMeaning: STATE_MEANING[row.lifecycle_state],
      stateClass: STATE_STYLE[row.lifecycle_state].text,
      dotClass: STATE_STYLE[row.lifecycle_state].dot,
      // Tracking began 21 Nov 2026; until a user's state changes, that is all
      // state_entered_at tells us.
      stateSince: row.previous_state
        ? `moved here from ${LIFECYCLE_LABELS[row.previous_state]} ${ago(row.state_entered_at, now)}`
        : 'unchanged since tracking began on 21 Nov',
      facts: [
        { label: 'Last opened the app', value: ago(row.last_visit_at, now) },
        { label: 'Days opened, last 7', value: String(row.visits_7d) },
        { label: 'Last painting progress', value: ago(row.last_core_progress_at, now) },
        {
          label: 'Focus unit',
          value: focus
            ? `${focus}${idle !== null ? ` · untouched ${idle === 0 ? 'today' : `${idle}d`}` : ''}`
            : 'none',
        },
        { label: 'Units in progress', value: String(row.active_unit_count) },
        {
          label: 'Guides',
          value: `${row.saved_guides_unassigned_count} saved not on a unit · ${row.draft_guide_count} draft · ${row.assigned_guide_count} on a unit`,
        },
        { label: 'Push', value: push },
        {
          label: 'Push ask',
          value: row.push_subscription_active
            ? 'not needed'
            : cooldown
              ? `paused until ${new Date(row.notification_opt_in_cooldown_until as string).toLocaleDateString('en-GB')} (said Not now)`
              : askedAt
                ? `last asked ${ago(askedAt, now)}`
                : 'never asked',
        },
        {
          label: 'Email',
          value: `${row.email_marketing_allowed ? 'opted in' : 'not opted in'} · ${row.email_status}`,
        },
        { label: 'Last push', value: ago(row.last_push_at, now) },
        { label: 'Last popup', value: ago(row.last_popup_at, now) },
      ],
      inApp: plan.inApp ? { label: messageLabel(plan.inApp.key), surface: plan.inApp.surface } : null,
      push:
        plan.push.kind === 'send'
          ? messageLabel(plan.push.key)
          : plan.push.kind === 'held'
            ? `${messageLabel(plan.push.key)} · held by the weekly limit`
            : plan.push.kind === 'unreachable'
              ? `can't reach, push is ${push}${plan.push.wouldGet ? ` (would get: ${messageLabel(plan.push.wouldGet)})` : ''}`
              : 'nothing matches',
      pushSurface: plan.push.kind === 'send',
      emailPlan: plan.email ? 'On your personal list: write to them' : '',
    }
  })

  const matrixColumns: { label: string; count: (row: UserLifecycle) => boolean }[] = [
    { label: 'Push on', count: (row) => row.push_subscription_active },
    { label: 'Email opt-in', count: (row) => row.email_marketing_allowed },
    { label: 'Has an active unit', count: (row) => row.active_unit_count > 0 },
    { label: 'Unit idle 3+ days', count: (row) => row.stale_active_unit_count > 0 },
    { label: 'Saved guide not on a unit', count: (row) => row.saved_guides_unassigned_count > 0 },
    { label: 'Draft guide', count: (row) => row.draft_guide_count > 0 },
    {
      label: 'Nothing started',
      count: (row) => row.active_unit_count === 0 && row.saved_guides_unassigned_count === 0 && row.draft_guide_count === 0,
    },
  ]

  const groups: { surface: MessageSurface; title: string; note: string }[] = [
    { surface: 'popup', title: 'Popups', note: 'One per app session, 2 seconds after the app opens.' },
    { surface: 'topper', title: 'Toppers', note: 'A one-line strip above the bottom bar. Title and button only.' },
    { surface: 'push', title: 'Pushes', note: 'Daily at 16:00 UTC. One per person per run, at most 2 a week.' },
    { surface: 'email', title: 'Email', note: 'Not sent automatically. Use the personal list above.' },
  ]

  function audienceFact(message: EngagementMessage) {
    const eligible = lifecycles.filter((row) => eligibleTarget(message, row, now) !== null)
    const parts = STATE_ORDER.map((state) => [state, eligible.filter((row) => row.lifecycle_state === state).length] as const)
      .filter(([, count]) => count > 0)
      .map(([state, count]) => `${LIFECYCLE_LABELS[state]} ${count}`)
    const firstChoice = users.filter(
      ({ plan }) =>
        plan.inApp?.key === message.key ||
        (plan.push.kind === 'send' && plan.push.key === message.key) ||
        plan.email === message.key
    ).length
    return `${eligible.length} match the rule${parts.length ? ` (${parts.join(', ')})` : ''} · ${firstChoice} would get this one first`
  }

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 pb-28 pt-6 sm:max-w-5xl">
        <header className="space-y-4">
          <div>
            <h1 className="text-3xl font-black">ENGAGE</h1>
            <p className="mt-1 text-sm text-white/60">
              {refreshed} users recomputed just now. Everything below shows what would happen if every message in
              review were live.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-3">
              <div className="text-xs font-black uppercase tracking-wide text-amber-200">1 · They open the app</div>
              <p className="mt-1 text-sm text-white/75">
                Push off? They are asked to turn it on first, in a popup 2 seconds in. Otherwise the most useful
                popup or one-line topper. One popup per app session.
              </p>
            </div>
            <div className="rounded-2xl border border-sky-300/25 bg-sky-300/[0.06] p-3">
              <div className="text-xs font-black uppercase tracking-wide text-sky-200">2 · Daily push, 16:00 UTC</div>
              <p className="mt-1 text-sm text-white/75">
                Only people with push on. One per run, at most 2 a week; At Risk 1 a week, Dormant 1 every 2 weeks.
              </p>
            </div>
            <div className="rounded-2xl border border-violet-300/25 bg-violet-300/[0.06] p-3">
              <div className="text-xs font-black uppercase tracking-wide text-violet-200">3 · You, personally</div>
              <p className="mt-1 text-sm text-white/75">
                At Risk or Dormant, push off, opted in to email: listed below so you can write to them yourself.
              </p>
            </div>
          </div>
        </header>

        {/* ------------------------------------------------------------------ */}
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-black">Look up a painter</h2>
            <p className="mt-1 text-sm text-white/55">
              Their state and why, and what the app, the daily push and you would send them.
            </p>
          </div>
          <UserLookup entries={lookupEntries} />
        </section>

        {/* ------------------------------------------------------------------ */}
        <section className="space-y-3">
          <h2 className="text-xl font-black">Where we&apos;re at</h2>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-white/[0.04] text-left text-xs uppercase tracking-wide text-white/50">
                <tr>
                  <th className="p-3">State</th>
                  <th className="p-3 text-right">Users</th>
                  {matrixColumns.map((column) => (
                    <th key={column.label} className="p-3 text-right">
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {STATE_ORDER.map((state) => {
                  const rows = (byState.get(state) ?? []).map((entry) => entry.lifecycle)
                  return (
                    <tr key={state}>
                      <td className="p-3">
                        <StateName state={state} />
                        <div className="text-xs text-white/45">{STATE_MEANING[state]}</div>
                      </td>
                      <td className="p-3 text-right text-lg font-black">{rows.length}</td>
                      {matrixColumns.map((column) => {
                        const n = rows.filter(column.count).length
                        return (
                          <td key={column.label} className={`p-3 text-right ${n ? 'font-bold' : 'text-white/25'}`}>
                            {n}
                            {n && rows.length ? (
                              <span className="ml-1 text-xs font-normal text-white/40">
                                {Math.round((n / rows.length) * 100)}%
                              </span>
                            ) : null}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
                <tr className="bg-white/[0.03] font-black">
                  <td className="p-3">All</td>
                  <td className="p-3 text-right text-lg">{lifecycles.length}</td>
                  {matrixColumns.map((column) => (
                    <td key={column.label} className="p-3 text-right">
                      {lifecycles.filter(column.count).length}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-black">Who gets what</h2>
            <p className="mt-1 text-sm text-white/55">
              The first thing each group would get, and how many people. Colours:{' '}
              <Chip surface="popup">Popup</Chip> <Chip surface="topper">Topper</Chip> <Chip surface="push">Push</Chip>{' '}
              <Chip surface="email">Email</Chip>
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <div className="grid min-w-[760px] grid-cols-[12rem_1fr_1fr_0.8fr]">
              <div className="bg-white/[0.04] p-3 text-xs font-black uppercase tracking-wide text-white/50">State</div>
              <div className="bg-white/[0.04] p-3 text-xs font-black uppercase tracking-wide text-amber-200">
                Opens the app → sees
              </div>
              <div className="bg-white/[0.04] p-3 text-xs font-black uppercase tracking-wide text-sky-200">
                Daily push → gets
              </div>
              <div className="bg-white/[0.04] p-3 text-xs font-black uppercase tracking-wide text-violet-200">
                You write to them
              </div>

              {STATE_ORDER.map((state) => {
                const entries = byState.get(state) ?? []
                const inApp = tally(entries, (plan) => plan.inApp?.key ?? null)
                const inAppNone = entries.filter(({ plan }) => !plan.inApp).length
                const sends = tally(entries, (plan) => (plan.push.kind === 'send' ? plan.push.key : null))
                const held = entries.filter(({ plan }) => plan.push.kind === 'held').length
                const unreachable = entries.filter(({ plan }) => plan.push.kind === 'unreachable')
                const wouldGet = tally(unreachable, (plan) => (plan.push.kind === 'unreachable' ? plan.push.wouldGet : null))
                const pushNothing = entries.filter(({ plan }) => plan.push.kind === 'nothing').length
                const emails = entries.filter(({ plan }) => plan.email).length
                return (
                  <div key={state} className="contents">
                    <div className={`border-t border-white/10 border-l-4 p-3 ${STATE_STYLE[state].ring}`}>
                      <StateName state={state} count={entries.length} />
                      <div className="mt-1 text-xs text-white/45">{STATE_MEANING[state]}</div>
                    </div>
                    <div className="flex flex-wrap content-start gap-1.5 border-t border-white/10 p-3">
                      {inApp.map(([key, n]) => (
                        <Chip key={key} surface={messageByKey.get(key)?.surface}>
                          {messageLabel(key)} <Count n={n} />
                        </Chip>
                      ))}
                      {inAppNone ? (
                        <Chip muted>
                          nothing <Count n={inAppNone} />
                        </Chip>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap content-start gap-1.5 border-t border-white/10 p-3">
                      {sends.map(([key, n]) => (
                        <Chip key={key} surface="push">
                          {messageLabel(key)} <Count n={n} />
                        </Chip>
                      ))}
                      {held ? (
                        <Chip muted>
                          held by the weekly limit <Count n={held} />
                        </Chip>
                      ) : null}
                      {unreachable.length ? (
                        <Chip muted>
                          push off, can&apos;t reach <Count n={unreachable.length} />
                        </Chip>
                      ) : null}
                      {pushNothing ? (
                        <Chip muted>
                          nothing matches <Count n={pushNothing} />
                        </Chip>
                      ) : null}
                      {wouldGet.length ? (
                        <div className="w-full text-xs text-white/45">
                          If they turned push on:{' '}
                          {wouldGet.map(([key, n]) => `${messageLabel(key)} (${n})`).join(', ')}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap content-start gap-1.5 border-t border-white/10 p-3">
                      {emails ? (
                        <Chip surface="email">
                          personal email <Count n={emails} />
                        </Chip>
                      ) : (
                        <span className="text-xs text-white/30">–</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        <section className="space-y-3">
          <h2 className="text-xl font-black">Every user</h2>
          {STATE_ORDER.map((state) => {
            const entries = byState.get(state) ?? []
            if (!entries.length) return null
            return (
              <details key={state} open={entries.length <= 10} className="rounded-2xl border border-white/10">
                <summary className="cursor-pointer list-none p-3">
                  <StateName state={state} count={entries.length} />
                  <span className="ml-2 text-xs text-white/40">tap to {entries.length <= 10 ? 'collapse' : 'expand'}</span>
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead className="text-left text-xs uppercase tracking-wide text-white/40">
                      <tr>
                        <th className="px-3 py-2">Painter</th>
                        <th className="px-3 py-2">Their situation</th>
                        <th className="px-3 py-2 text-amber-200/80">Opens the app → sees</th>
                        <th className="px-3 py-2 text-sky-200/80">Daily push</th>
                        <th className="px-3 py-2 text-violet-200/80">Email</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {entries.map(({ lifecycle: row, plan }) => {
                        const seen = days(row.last_visit_at, now)
                        const idle = days(row.focus_unit_last_activity_at, now)
                        const focus = row.focus_unit_id ? unitName.get(row.focus_unit_id) : null
                        return (
                          <tr key={row.user_id} className="align-top">
                            <td className="px-3 py-2">
                              <div className="font-bold">{nameOf(row.user_id)}</div>
                              <div className="text-xs text-white/45">
                                {seen === null ? 'never seen' : seen === 0 ? 'seen today' : `seen ${seen}d ago`}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                {focus ? (
                                  <Chip muted>
                                    {focus}
                                    {idle !== null && idle >= 1 ? ` · idle ${idle}d` : ''}
                                  </Chip>
                                ) : null}
                                {row.active_unit_count > 1 ? <Chip muted>{row.active_unit_count} units</Chip> : null}
                                {row.saved_guides_unassigned_count ? (
                                  <Chip muted>
                                    {row.saved_guides_unassigned_count} saved{' '}
                                    {row.saved_guides_unassigned_count === 1 ? 'guide' : 'guides'} not on a unit
                                  </Chip>
                                ) : null}
                                {row.draft_guide_count ? <Chip muted>draft guide</Chip> : null}
                                <Chip muted>
                                  {row.push_subscription_active
                                    ? '🔔 push on'
                                    : row.push_platform_permission === 'denied'
                                      ? '🔕 push blocked'
                                      : '🔕 push off'}
                                </Chip>
                                {row.email_marketing_allowed ? <Chip muted>✉ opted in</Chip> : null}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {plan.inApp ? (
                                <Chip surface={plan.inApp.surface}>{messageLabel(plan.inApp.key)}</Chip>
                              ) : (
                                <span className="text-xs text-white/30">nothing</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {plan.push.kind === 'send' ? (
                                <Chip surface="push">{messageLabel(plan.push.key)}</Chip>
                              ) : plan.push.kind === 'held' ? (
                                <span className="text-xs text-white/50">
                                  {messageLabel(plan.push.key)} · held by the weekly limit
                                </span>
                              ) : plan.push.kind === 'unreachable' ? (
                                <span className="text-xs text-white/40">
                                  can&apos;t reach
                                  {plan.push.wouldGet ? ` (would get: ${messageLabel(plan.push.wouldGet)})` : ''}
                                </span>
                              ) : (
                                <span className="text-xs text-white/30">nothing matches</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {plan.email ? (
                                <Chip surface="email">write to them</Chip>
                              ) : (
                                <span className="text-xs text-white/30">–</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            )
          })}
        </section>

        {/* ------------------------------------------------------------------ */}
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-black">Write to them personally · {emailList.length}</h2>
            <p className="mt-1 text-sm text-white/55">
              At Risk or Dormant, push off, ticked &ldquo;product updates&rdquo; in onboarding, and has a unit to talk
              about. {lifecycles.filter((row) => row.email_marketing_allowed).length} users opted in to email in total.
            </p>
          </div>
          {emailList.length ? (
            <ul className="divide-y divide-white/10 rounded-2xl border border-violet-300/20">
              {emailList.map(({ lifecycle: row }) => {
                const profile = profileById.get(row.user_id)
                const focus = row.focus_unit_id ? unitName.get(row.focus_unit_id) : null
                const idle = days(row.focus_unit_last_activity_at, now)
                return (
                  <li key={row.user_id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
                    <StateName state={row.lifecycle_state} />
                    <span className="font-bold">{nameOf(row.user_id)}</span>
                    {profile?.email ? (
                      <a className="text-violet-200 underline" href={`mailto:${profile.email}`}>
                        {profile.email}
                      </a>
                    ) : null}
                    {focus ? (
                      <span className="text-white/55">
                        {focus}
                        {idle !== null ? ` untouched ${idle} days` : ''}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-white/50">Nobody right now.</p>
          )}
        </section>

        {/* ------------------------------------------------------------------ */}
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-black">Today&apos;s push run</h2>
            <p className="mt-1 text-sm text-white/55">
              Runs the real daily logic (recompute, rules, weekly limits) and lists who would get which push. Nothing
              is sent.
            </p>
          </div>
          <DryRun />
        </section>

        {/* ------------------------------------------------------------------ */}
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-black">Push opt-in funnel · 30 days</h2>
            <p className="mt-1 text-sm text-white/55">
              Soft prompt = our own ask (onboarding step, popup, topper). Native prompt = the browser&apos;s
              &ldquo;Allow notifications?&rdquo; dialog, which only opens after they tap yes on ours.
            </p>
          </div>
          <div className="flex flex-wrap items-stretch gap-2 text-center">
            {[
              ['Our ask shown', 'soft_prompt_shown'],
              ['Tapped yes', 'soft_prompt_enable'],
              ['Browser asked', 'native_prompt_requested'],
              ['Allowed', 'permission_granted'],
            ].map(([label, key], index) => (
              <div key={key} className="flex items-center gap-2">
                {index ? <span className="text-white/30">→</span> : null}
                <div className="min-w-[7rem] rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-3">
                  <div className="text-2xl font-black">{funnel.get(key) ?? 0}</div>
                  <div className="text-xs text-white/55">{label}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/45">
            Not now: {funnel.get('soft_prompt_dismissed') ?? 0} · Skipped in onboarding:{' '}
            {funnel.get('soft_prompt_skipped') ?? 0} · Blocked in the browser: {funnel.get('permission_denied') ?? 0} ·
            Turned off later: {funnel.get('subscription_removed') ?? 0}
          </p>
        </section>

        {/* ------------------------------------------------------------------ */}
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-black">Messages</h2>
            <p className="mt-1 text-sm text-white/55">
              Edit changes the copy, link, priority and who it targets; the mock updates as you type. Each message has
              one of four statuses:
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            {STATUS_GUIDE.map((item) => (
              <div key={item.status} className={`rounded-2xl border p-3 ${item.style}`}>
                <div className="text-sm font-black">{item.status}</div>
                <div className="text-xs font-bold opacity-80">Who sees it: {item.who}</div>
                <p className="mt-1 text-xs text-white/70">{item.detail}</p>
              </div>
            ))}
          </div>

          {groups.map((group) => {
            const list = messages
              .filter((message) => message.surface === group.surface)
              .sort((a, b) => a.priority - b.priority || (a.v1_number ?? 99) - (b.v1_number ?? 99))
            if (!list.length) return null
            return (
              <div key={group.surface} className="space-y-3">
                <div className="flex flex-wrap items-baseline gap-2">
                  <Chip surface={group.surface}>{SURFACE_LABEL[group.surface]}</Chip>
                  <h3 className="text-lg font-black">{group.title}</h3>
                  <span className="text-sm text-white/45">{group.note}</span>
                </div>
                {list.map((message) => {
                  const counts = deliveryCounts.get(message.key) ?? {}
                  return (
                    <MessageCard
                      key={message.key}
                      message={message}
                      label={messageLabel(message.key)}
                      sample={SAMPLE}
                      facts={[
                        {
                          label: 'Who',
                          value: `${message.lifecycle_states.map((state) => LIFECYCLE_LABELS[state]).join(', ')} · priority ${message.priority}. ${message.eligibility}`,
                        },
                        { label: 'Right now', value: audienceFact(message) },
                        { label: 'Hypothesis → success', value: `${message.hypothesis ?? '–'} → ${message.success_event ?? '–'}` },
                        {
                          label: 'Last 30 days',
                          value: ['shown', 'sent', 'clicked', 'dismissed']
                            .map((status) => `${counts[status] ?? 0} ${status}`)
                            .join(' · '),
                        },
                      ]}
                    />
                  )
                })}
              </div>
            )
          })}
        </section>
      </div>
    </main>
  )
}
