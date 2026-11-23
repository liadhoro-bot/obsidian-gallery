import { redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../../utils/supabase/server'
import { createServiceRoleClient } from '../../../utils/supabase/service-role'
import { isCurrentUserAdmin } from '../../../lib/admin'
import { NOTIFICATIONS_COPY } from '../../onboarding/components/screens/notifications-copy'
import type { PreviewScreen } from '../../onboarding/screen-preview/screens'

// Rollout step 2: what a new painter goes through on the way to turning on
// push. Every onboarding screen in a phone frame (the real components, in
// preview mode), who sees the notifications ask and who skips it, what
// happens after "Not now", and the live copy next to the proposed copy.
// Admins only.
export const dynamic = 'force-dynamic'

const DAY = 24 * 60 * 60 * 1000

const ROLLOUT = [
  { n: 1, title: 'Admin panel + engine', note: 'Pushed 23 Nov. Nothing visible to users.', state: 'done' },
  { n: 2, title: 'New users: onboarding ask', note: 'This page. Approve the flow and copy.', state: 'now' },
  { n: 3, title: 'Existing users: opt-in popups', note: 'Turn on push popups and the strip.', state: 'next' },
  { n: 4, title: 'Pushes, popups, toppers', note: 'The rest of the message set.', state: 'next' },
] as const

type FlowStep = {
  screen: PreviewScreen
  title: string
  who: string
  highlight?: boolean
}

const FLOW: FlowStep[] = [
  { screen: 'terms', title: '1 · Terms', who: 'Everyone. Also the email opt-in box (product updates).' },
  { screen: 'goal', title: '2 · Goal', who: 'Everyone. Paint, organise, create, or just look around.' },
  { screen: 'first_unit', title: '3a · First unit', who: 'Chose paint or organise.' },
  { screen: 'first_guide', title: '3b · First guide', who: 'Chose create.' },
  {
    screen: 'notifications',
    title: '4 · Notifications ask',
    who: 'Signed in and the device can ask. Everyone else skips straight to 5.',
    highlight: true,
  },
  { screen: 'curator', title: '5 · Curator, then the dashboard', who: 'Everyone.' },
]

const DEVICE_ROWS = [
  { device: 'Android (Chrome, installed or not)', sees: true, what: 'Sees the ask. Tapping the button opens the browser prompt.' },
  { device: 'Desktop Chrome / Edge / Firefox', sees: true, what: 'Sees the ask, same as Android.' },
  { device: 'iPhone, app added to Home Screen', sees: true, what: 'Sees the ask. iOS only allows push from the installed app.' },
  {
    device: 'iPhone in Safari (not installed)',
    sees: false,
    what: 'Skipped. iOS can’t ask from a browser tab. They can only turn push on after installing the app.',
  },
  { device: 'Already allowed or already blocked', sees: false, what: 'Skipped: nothing to ask.' },
  { device: 'Browser without push support', sees: false, what: 'Skipped.' },
]

function frameUrl(screen: PreviewScreen) {
  return `/onboarding/screen-preview?screen=${screen}`
}

function PhoneFrame({ screen, label }: { screen: PreviewScreen; label: string }) {
  // 390x844 rendered at half size. The iframe keeps the real page's own
  // viewport so the screen lays out exactly as on a phone.
  return (
    <div className="h-[422px] w-[195px] shrink-0 overflow-hidden rounded-[22px] border-4 border-[#1d2731] bg-black shadow-lg">
      <iframe
        title={label}
        src={frameUrl(screen)}
        loading="lazy"
        className="h-[844px] w-[390px] origin-top-left scale-50 border-0"
      />
    </div>
  )
}

function pct(n: number, of: number) {
  return of ? `${Math.round((n / of) * 100)}%` : '–'
}

function deviceOf(userAgent: string | null) {
  const ua = userAgent ?? ''
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone / iPad'
  if (/Android/i.test(ua)) return 'Android'
  return 'Desktop'
}

async function loadNumbers() {
  const service = createServiceRoleClient()
  const since30 = new Date(Date.now() - 30 * DAY).toISOString()
  const [{ data: profiles }, { data: subscriptions }, { data: events }] = await Promise.all([
    service.from('profiles').select('id, created_at, terms_accepted_at'),
    service.from('push_subscriptions').select('user_id, user_agent'),
    service
      .from('engagement_deliveries')
      .select('status, source, user_id')
      .eq('channel', 'permission')
      .eq('source', 'onboarding'),
  ])

  const pushUsers = new Set((subscriptions ?? []).map((row) => row.user_id as string))
  const all = profiles ?? []
  const recent = all.filter((row) => (row.created_at as string) >= since30)

  const devices = new Map<string, Set<string>>()
  for (const row of subscriptions ?? []) {
    const device = deviceOf(row.user_agent as string | null)
    if (!devices.has(device)) devices.set(device, new Set())
    devices.get(device)?.add(row.user_id as string)
  }

  const funnel = new Map<string, Set<string>>()
  for (const row of events ?? []) {
    if (!funnel.has(row.status)) funnel.set(row.status, new Set())
    funnel.get(row.status)?.add(row.user_id as string)
  }

  return {
    total: all.length,
    totalPush: all.filter((row) => pushUsers.has(row.id as string)).length,
    recent: recent.length,
    recentTerms: recent.filter((row) => row.terms_accepted_at).length,
    recentPush: recent.filter((row) => pushUsers.has(row.id as string)).length,
    devices: [...devices.entries()].map(([device, users]) => [device, users.size] as const).sort((a, b) => b[1] - a[1]),
    funnel: (status: string) => funnel.get(status)?.size ?? 0,
  }
}

export default async function AdminOnboardingPage() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) redirect('/login?next=%2Fadmin%2Fonboarding')
  if (!(await isCurrentUserAdmin(user.id))) redirect('/dashboard')

  const numbers = await loadNumbers()
  const live = NOTIFICATIONS_COPY.live
  const proposed = NOTIFICATIONS_COPY.proposed

  const funnelSteps = [
    { status: 'soft_prompt_shown', label: 'Saw the ask' },
    { status: 'soft_prompt_enable', label: 'Tapped the button' },
    { status: 'native_prompt_requested', label: 'Browser prompt opened' },
    { status: 'permission_granted', label: 'Allowed' },
    { status: 'soft_prompt_skipped', label: 'Not now' },
    { status: 'permission_denied', label: 'Blocked in the browser' },
  ]

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8 px-4 pb-28 pt-6 sm:max-w-5xl">
        <header className="space-y-4">
          <div>
            <h1 className="text-3xl font-black">Onboarding → push</h1>
            <p className="mt-1 text-sm text-white/60">
              What a new painter goes through on the way to turning on notifications. These are the real screens in
              preview mode: tapping inside them saves nothing.
            </p>
          </div>
          <ol className="grid gap-2 sm:grid-cols-4">
            {ROLLOUT.map((step) => (
              <li
                key={step.n}
                className={`rounded-2xl border p-3 ${
                  step.state === 'done'
                    ? 'border-emerald-300/30 bg-emerald-300/[0.06]'
                    : step.state === 'now'
                      ? 'border-cyan-300/50 bg-cyan-300/[0.1]'
                      : 'border-white/10 bg-white/[0.03] opacity-70'
                }`}
              >
                <div className="text-xs font-black uppercase tracking-wide text-white/60">
                  Step {step.n} · {step.state === 'done' ? 'done' : step.state === 'now' ? 'now' : 'later'}
                </div>
                <div className="mt-1 font-black">{step.title}</div>
                <p className="mt-1 text-xs text-white/60">{step.note}</p>
              </li>
            ))}
          </ol>
        </header>

        {/* ------------------------------------------------------------------ */}
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-black">The flow today</h2>
            <p className="mt-1 text-sm text-white/55">
              Live in production now. Scroll sideways. The notifications ask is the only push moment a new user gets
              until step 3 goes live.
            </p>
          </div>
          <div className="-mx-4 overflow-x-auto px-4 pb-2">
            <ol className="flex w-max gap-4">
              {FLOW.map((step, index) => (
                <li key={step.screen} className="flex items-start gap-4">
                  <div
                    className={`w-[211px] space-y-2 rounded-2xl border p-2 ${
                      step.highlight ? 'border-cyan-300/60 bg-cyan-300/[0.08]' : 'border-white/10 bg-white/[0.03]'
                    }`}
                  >
                    <PhoneFrame screen={step.screen} label={step.title} />
                    <div className="px-1">
                      <div className={`text-sm font-black ${step.highlight ? 'text-cyan-100' : ''}`}>{step.title}</div>
                      <p className="text-xs text-white/55">{step.who}</p>
                    </div>
                  </div>
                  {index < FLOW.length - 1 ? (
                    <span aria-hidden className="self-center pt-2 text-2xl text-white/25">
                      →
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
          <p className="text-xs text-white/45">
            3a and 3b are either/or; &ldquo;just look around&rdquo; skips both. Logged-out previews skip the ask.
          </p>
        </section>

        {/* ------------------------------------------------------------------ */}
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-black">Who sees the ask</h2>
            <p className="mt-1 text-sm text-white/55">The screen only appears when this device can actually ask.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-white/[0.06]">
                {DEVICE_ROWS.map((row) => (
                  <tr key={row.device} className="align-top">
                    <td className="w-[38%] px-3 py-2.5 font-bold">{row.device}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${
                          row.sees ? 'bg-emerald-300/20 text-emerald-100' : 'bg-white/10 text-white/60'
                        }`}
                      >
                        {row.sees ? 'sees it' : 'skips'}
                      </span>
                      <span className="text-white/70">{row.what}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-white/45">
            Devices with push on right now:{' '}
            {numbers.devices.map(([device, n]) => `${device} ${n}`).join(' · ') || 'none'}.
          </p>
        </section>

        {/* ------------------------------------------------------------------ */}
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-black">After the ask</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.05] p-3">
              <div className="text-xs font-black uppercase tracking-wide text-emerald-200">Allowed</div>
              <p className="mt-1 text-sm text-white/75">
                Push is on. Nothing else asks again. They start getting pushes once step 4 goes live.
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/25 bg-amber-300/[0.05] p-3">
              <div className="text-xs font-black uppercase tracking-wide text-amber-200">Not now</div>
              <p className="mt-1 text-sm text-white/75">
                No ask for 7 days. After that (once step 3 is live) the opt-in popup comes on their next visit, then
                the one-line strip. Settings → Notifications always works.
              </p>
            </div>
            <div className="rounded-2xl border border-red-300/25 bg-red-300/[0.05] p-3">
              <div className="text-xs font-black uppercase tracking-wide text-red-200">Blocked in the browser</div>
              <p className="mt-1 text-sm text-white/75">
                We can never ask again; only the user can undo it in their browser settings. That&apos;s why the
                browser prompt only opens after they tap our button.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-black">The ask: live vs proposed</h2>
            <p className="mt-1 text-sm text-white/55">
              The proposed copy is not live. Approve it (or tell me what to change) and it replaces the live screen.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { screen: 'notifications' as const, label: 'Live now', copy: live, tone: 'border-white/15' },
              {
                screen: 'notifications_proposed' as const,
                label: 'Proposed',
                copy: proposed,
                tone: 'border-cyan-300/50',
              },
            ].map((variant) => (
              <div key={variant.screen} className={`flex gap-3 rounded-2xl border p-3 ${variant.tone}`}>
                <PhoneFrame screen={variant.screen} label={variant.label} />
                <dl className="min-w-0 space-y-2 text-sm">
                  <div className="text-xs font-black uppercase tracking-wide text-white/60">{variant.label}</div>
                  <div>
                    <dt className="text-xs font-bold text-white/40">Title</dt>
                    <dd className="font-bold">{variant.copy.title}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-bold text-white/40">Body</dt>
                    {variant.copy.body.map((paragraph) => (
                      <dd key={paragraph} className="text-white/75">
                        {paragraph}
                      </dd>
                    ))}
                    {variant.copy.note ? <dd className="text-white/45">{variant.copy.note}</dd> : null}
                  </div>
                  <div>
                    <dt className="text-xs font-bold text-white/40">Button</dt>
                    <dd className="text-white/75">{variant.copy.cta.replace(' ->', '')}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-black">Numbers</h2>
            <p className="mt-1 text-sm text-white/55">Ask tracking started 23 Nov, so the funnel starts near zero.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 p-3">
              <div className="text-xs font-bold uppercase text-white/45">Everyone</div>
              <div className="mt-1 text-2xl font-black">
                {numbers.totalPush} <span className="text-base text-white/50">of {numbers.total}</span>
              </div>
              <p className="text-xs text-white/55">have push on ({pct(numbers.totalPush, numbers.total)})</p>
            </div>
            <div className="rounded-2xl border border-white/10 p-3">
              <div className="text-xs font-bold uppercase text-white/45">Joined in the last 30 days</div>
              <div className="mt-1 text-2xl font-black">
                {numbers.recentPush} <span className="text-base text-white/50">of {numbers.recent}</span>
              </div>
              <p className="text-xs text-white/55">
                have push on ({pct(numbers.recentPush, numbers.recent)}); {numbers.recentTerms} got past the terms
                screen
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 p-3">
              <div className="text-xs font-bold uppercase text-white/45">Onboarding ask, since tracking</div>
              <ul className="mt-1 space-y-0.5 text-sm">
                {funnelSteps.map((step) => (
                  <li key={step.status} className="flex justify-between gap-2">
                    <span className="text-white/65">{step.label}</span>
                    <b>{numbers.funnel(step.status)}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
