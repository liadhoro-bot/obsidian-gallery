import { createClient } from '@supabase/supabase-js'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { buildUserContext } from '../lib/recommended-action/context'
import { evaluateRecommendations } from '../lib/recommended-action/engine'
import { evaluateRecommendationsV11 } from '../lib/recommended-action/engine-v11'
import { buildSuppression, type StoredInstance } from '../lib/recommended-action/feedback'
import { loadEngineSnapshot } from '../lib/recommended-action/snapshot'
import type { EngineResult } from '../lib/recommended-action/types'

/**
 * Shadow review (docs/recommended-action/v1.1-audit-and-plan.md, step 5).
 * Read-only: for each account, prints the current (v1) and contextual (v1.1)
 * top three side by side, with the lifecycle, intent and reasons behind them.
 * Names are printed to this terminal only; nothing is written anywhere.
 *
 * Usage:
 *   npx tsx scripts/recommended-action-review.ts <user-id> [<user-id> ...]
 *   npx tsx scripts/recommended-action-review.ts --recent 20   (most recently active accounts)
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

async function recentUserIds(limit: number) {
  const { data, error } = await supabase
    .from('unit_sessions')
    .select('user_id, started_at')
    .order('started_at', { ascending: false })
    .limit(2000)
  if (error) throw error
  return [...new Set((data ?? []).map((row) => row.user_id as string))].slice(0, limit)
}

async function loadSuppression(userId: string, nowMs: number) {
  const [instances, preferences] = await Promise.all([
    supabase
      .from('recommended_action_instances')
      .select('recommendation_key, status, snoozed_until, cooldown_until, ignored_impressions')
      .eq('user_id', userId)
      .limit(300),
    supabase.from('recommended_action_preferences').select('family_penalties').eq('user_id', userId).maybeSingle(),
  ])
  return buildSuppression(
    (instances.data ?? []) as StoredInstance[],
    (preferences.data?.family_penalties as Record<string, unknown> | undefined) ?? null,
    nowMs
  )
}

function printTop(label: string, result: EngineResult) {
  console.log(`  ${label} (${result.diagnostics.rulesetVersion})`)
  result.recommendations.slice(0, 3).forEach((item, index) => {
    console.log(`    ${index + 1}. ${item.ruleId}  ${String(item.score).padStart(3)}  ${item.title}`)
  })
  const winner = result.diagnostics.trace?.winner
  if (winner?.parts) {
    const parts = Object.entries(winner.parts).map(([key, value]) => `${key} ${value}`).join(', ')
    const penalties = Object.entries(winner.penalties ?? {}).map(([key, value]) => `${key} -${value}`).join(', ')
    console.log(`       why #1: ${parts}${penalties ? `; penalties ${penalties}` : ''}${winner.protected ? '; protected' : ''}`)
  }
  const rejections = Object.entries(result.diagnostics.trace?.rejections ?? {})
  if (rejections.length) {
    console.log(`       rejected: ${rejections.map(([reason, count]) => `${reason} ×${count}`).join(', ')}`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const recentIndex = args.indexOf('--recent')
  const userIds = recentIndex >= 0 ? await recentUserIds(Number(args[recentIndex + 1] ?? 20)) : args

  if (!userIds.length) {
    console.error('Pass user ids, or --recent <n>.')
    process.exit(1)
  }

  let disagreements = 0

  for (const userId of userIds) {
    const now = new Date()
    const snapshot = await loadEngineSnapshot(supabase, userId, now)
    const suppression = await loadSuppression(userId, now.getTime())
    const context = buildUserContext(snapshot)
    const v1 = evaluateRecommendations(snapshot, suppression, { context })
    const v11 = evaluateRecommendationsV11(snapshot, suppression, { context })
    const agree = v1.recommendations[0]?.recommendationKey === v11.recommendations[0]?.recommendationKey
    if (!agree) disagreements += 1

    console.log(`\n${userId}`)
    console.log(
      `  ${context.lifecycle} · intent ${context.intent} · confidence ${context.confidence} · persona ${context.persona}`
    )
    console.log(`  ${context.reasons.join('; ')}`)
    console.log(
      `  ${snapshot.totals.projects} projects, ${snapshot.totals.units} units, ${snapshot.totals.sessions} sessions, ${snapshot.totals.guides} guides, ${snapshot.totals.ownedPaints} paints`
    )
    printTop('v1   current', v1)
    printTop('v1.1 contextual', v11)
    console.log(`  winners ${agree ? 'agree' : 'DIFFER'}`)
  }

  console.log(`\n${userIds.length} accounts, ${disagreements} with a different #1. Read each DIFFER case before switching.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
