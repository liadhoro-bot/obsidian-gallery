import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Weekly Recommended Action quality report (spec §7, §11). Reads the
 * append-only events and the ranking traces and prints raw counts and unique
 * users per rule and lifecycle. It proposes nothing automatically: every
 * line marked "requires approval" is for a human to decide, and small
 * samples say "insufficient evidence".
 *
 * Usage:
 *   npx tsx scripts/recommended-action-report.ts [--days 7] [--out report.md]
 *   npx tsx scripts/recommended-action-report.ts --prune     (delete traces older than 90 days)
 */

function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/)
    if (!match) continue
    const key = match[1].trim()
    if (process.env[key]) continue
    process.env[key] = match[2].trim().replace(/^["']|["']$/g, '')
  }
}
loadDotEnvLocal()

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const DAY = 24 * 60 * 60 * 1000
const TRACE_RETENTION_DAYS = 90
// Starting safeguards from the spec, not significance thresholds.
const MIN_EXPOSURES = 20
const MIN_USERS = 8

type EventRow = {
  user_id: string
  event_type: string
  recommendation_key: string
  created_at: string
  metadata: Record<string, unknown> | null
}

type TraceRow = {
  user_id: string
  created_at: string
  ranking_revision: string
  served: boolean
  lifecycle: string | null
  data_confidence: string | null
  snapshot_coverage: string | null
  winner: { ruleId?: string } | null
  shadow_agreement: boolean | null
}

async function fetchAll<T>(table: string, columns: string, since: string): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(from, from + 999)
    if (error) throw error
    rows.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) return rows
  }
}

function table(headers: string[], rows: (string | number)[][]) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

const pct = (part: number, whole: number) => (whole ? `${Math.round((100 * part) / whole)}%` : '—')

// Meaningful activity in the 7 days after a user's first impression of the
// window. Association only, never proof the card caused it.
async function meaningfulReturn(events: EventRow[], nowMs: number) {
  const firstSeen = new Map<string, number>()
  for (const event of events) {
    if (event.event_type !== 'impression') continue
    const at = Date.parse(event.created_at)
    if (!firstSeen.has(event.user_id) || at < firstSeen.get(event.user_id)!) firstSeen.set(event.user_id, at)
  }

  let eligible = 0
  let returned = 0
  for (const [userId, at] of [...firstSeen].slice(0, 200)) {
    if (at + 7 * DAY > nowMs) continue
    const { data, error } = await supabase.rpc('recommended_action_activity', {
      p_user_id: userId,
      p_now: new Date(at + 7 * DAY).toISOString(),
    })
    if (error) continue
    eligible += 1
    if (Number((data as { actions_7?: number })?.actions_7 ?? 0) > 0) returned += 1
  }
  return { eligible, returned }
}

async function prune() {
  const cutoff = new Date(Date.now() - TRACE_RETENTION_DAYS * DAY).toISOString()
  const { error, count } = await supabase
    .from('recommended_action_traces')
    .delete({ count: 'exact' })
    .lt('created_at', cutoff)
  if (error) throw error
  console.log(`Deleted ${count ?? 0} traces older than ${TRACE_RETENTION_DAYS} days.`)
}

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--prune')) return prune()

  const days = Number(args[args.indexOf('--days') + 1]) || 7
  const outIndex = args.indexOf('--out')
  const nowMs = Date.now()
  const since = new Date(nowMs - days * DAY).toISOString()

  const [events, traces] = await Promise.all([
    fetchAll<EventRow>('recommended_action_events', 'user_id, event_type, recommendation_key, created_at, metadata', since),
    fetchAll<TraceRow>(
      'recommended_action_traces',
      'user_id, created_at, ranking_revision, served, lifecycle, data_confidence, snapshot_coverage, winner, shadow_agreement',
      since
    ),
  ])

  const lines: string[] = [`# Recommended Action quality report`, ``, `Window: last ${days} days (since ${since.slice(0, 10)}).`, ``]

  // 1. Ranking relevance -------------------------------------------------
  lines.push(`## Ranking relevance`, ``)
  const revisions = [...new Set(traces.map((row) => row.ranking_revision))].sort()
  lines.push(
    table(
      ['Revision', 'Traces', 'Users', 'Served', 'Stale RA03 #1 (established/lapsed)', '#1 agrees with other revision'],
      revisions.map((revision) => {
        const rows = traces.filter((row) => row.ranking_revision === revision)
        const stale = rows.filter(
          (row) => row.winner?.ruleId === 'RA03' && (row.lifecycle === 'established' || row.lifecycle === 'lapsed')
        )
        const agree = rows.filter((row) => row.shadow_agreement)
        return [
          revision,
          rows.length,
          new Set(rows.map((row) => row.user_id)).size,
          rows.filter((row) => row.served).length,
          `${stale.length} (${new Set(stale.map((row) => row.user_id)).size} users)`,
          pct(agree.length, rows.length),
        ]
      })
    ),
    ``,
    `Winners by lifecycle (v1.1):`,
    ``
  )
  const v11 = traces.filter((row) => row.ranking_revision === 'v1.1')
  const byLifecycle = new Map<string, Map<string, number>>()
  for (const row of v11) {
    const lifecycle = row.lifecycle ?? 'unknown'
    const rule = row.winner?.ruleId ?? 'none'
    const counts = byLifecycle.get(lifecycle) ?? new Map()
    counts.set(rule, (counts.get(rule) ?? 0) + 1)
    byLifecycle.set(lifecycle, counts)
  }
  lines.push(
    table(
      ['Lifecycle', 'Winners'],
      [...byLifecycle].map(([lifecycle, counts]) => [
        lifecycle,
        [...counts].sort((a, b) => b[1] - a[1]).map(([rule, n]) => `${rule} ${n}`).join(', '),
      ])
    ),
    ``
  )

  // 2. Recommendation quality per rule × lifecycle ------------------------
  lines.push(`## Quality by rule and lifecycle`, ``)
  type Bucket = { users: Set<string>; counts: Record<string, number>; reasons: Record<string, number> }
  const buckets = new Map<string, Bucket>()
  for (const event of events) {
    const rule = (event.metadata?.rule_id as string | undefined) ?? event.recommendation_key.split(':')[0]
    if (!/^RA\d{2}$/.test(rule)) continue
    const key = `${rule}|${(event.metadata?.lifecycle as string | undefined) ?? 'unknown'}`
    const bucket = buckets.get(key) ?? { users: new Set(), counts: {}, reasons: {} }
    bucket.counts[event.event_type] = (bucket.counts[event.event_type] ?? 0) + 1
    if (event.event_type === 'impression') bucket.users.add(event.user_id)
    const reason = event.metadata?.reason as string | undefined
    if (event.event_type === 'dismiss_reason' && reason) bucket.reasons[reason] = (bucket.reasons[reason] ?? 0) + 1
    buckets.set(key, bucket)
  }

  const qualityRows = [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([key, bucket]) => {
    const [rule, lifecycle] = key.split('|')
    const c = (type: string) => bucket.counts[type] ?? 0
    const exposures = c('impression')
    const enough = exposures >= MIN_EXPOSURES && bucket.users.size >= MIN_USERS
    return {
      rule,
      lifecycle,
      exposures,
      users: bucket.users.size,
      enough,
      c,
      reasons: bucket.reasons,
      row: [
        rule,
        lifecycle,
        exposures,
        bucket.users.size,
        c('primary_click'),
        c('goal_completed'),
        c('show_another'),
        c('dismiss'),
        c('snooze'),
        c('action_failed'),
        c('invalidated'),
        Object.entries(bucket.reasons).map(([reason, n]) => `${reason} ${n}`).join(', ') || '—',
        enough ? 'ok' : 'insufficient evidence',
      ],
    }
  })
  lines.push(
    table(
      ['Rule', 'Lifecycle', 'Exposures', 'Users', 'Clicks', 'Verified', 'Show another', 'Not interested', 'Snooze', 'Failures', 'Invalidated', 'Reasons', 'Sample'],
      qualityRows.map((entry) => entry.row)
    ),
    ``
  )

  // 3. Operational correctness -------------------------------------------
  const faults = events.filter((event) => event.event_type === 'evaluation_fault')
  const coverage = new Map<string, number>()
  for (const row of traces) coverage.set(row.snapshot_coverage ?? 'unknown', (coverage.get(row.snapshot_coverage ?? 'unknown') ?? 0) + 1)
  lines.push(
    `## Operational`,
    ``,
    `- Evaluation faults: ${faults.length} (${new Set(faults.map((event) => event.user_id)).size} users)`,
    `- Action failures: ${events.filter((event) => event.event_type === 'action_failed').length}`,
    `- Invalidated clicks: ${events.filter((event) => event.event_type === 'invalidated').length}`,
    `- Snapshot coverage: ${[...coverage].map(([label, n]) => `${label} ${n}`).join(', ') || '—'}`,
    ``
  )

  // 4. Meaningful return (association) -----------------------------------
  const { eligible, returned } = await meaningfulReturn(events, nowMs)
  lines.push(
    `## Meaningful activity within 7 days of first impression`,
    ``,
    `${returned} of ${eligible} users (${pct(returned, eligible)}). Association, not causation.`,
    ``
  )

  // 5. Calibration candidates — proposals only -------------------------
  lines.push(`## Calibration candidates (requires approval)`, ``)
  const proposals: string[] = []
  for (const entry of qualityRows) {
    if (!entry.enough) continue
    const { c } = entry
    if (c('action_failed') > 0) {
      proposals.push(`- ${entry.rule} / ${entry.lifecycle}: ${c('action_failed')} failures. Engineering fix, not a preference penalty.`)
    }
    if ((entry.reasons.already_done ?? 0) > 0) {
      proposals.push(`- ${entry.rule} / ${entry.lifecycle}: "Already done" ×${entry.reasons.already_done}. Check the snapshot for stale data.`)
    }
    if (c('dismiss') + c('show_another') > entry.exposures / 2) {
      proposals.push(`- ${entry.rule} / ${entry.lifecycle}: misses (${c('dismiss')} not interested, ${c('show_another')} show another of ${entry.exposures}). Tighten the gate or improve targeting.`)
    }
    if (c('snooze') > entry.exposures / 3) {
      proposals.push(`- ${entry.rule} / ${entry.lifecycle}: mistimed (${c('snooze')} snoozes of ${entry.exposures}). Change timing, not relevance.`)
    }
    if (c('goal_completed') >= entry.exposures / 4 && c('dismiss') < entry.exposures / 10) {
      proposals.push(`- ${entry.rule} / ${entry.lifecycle}: hits the mark (${c('goal_completed')} verified of ${entry.exposures}). Consider a small boost after checking value.`)
    }
  }
  lines.push(...(proposals.length ? proposals : ['- None: no segment has enough evidence yet.']), ``)

  const report = lines.join('\n')
  if (outIndex >= 0 && args[outIndex + 1]) {
    writeFileSync(args[outIndex + 1], report)
    console.log(`Wrote ${args[outIndex + 1]}`)
  } else {
    console.log(report)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
