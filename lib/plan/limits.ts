import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { unstable_cache } from 'next/cache'
import { createServiceRoleClient } from '../../utils/supabase/service-role'
import { getCachedSubscriptionStatus } from '../subscription/subscription-guard'
import {
  DEFAULT_PLAN_LIMIT_LABELS,
  PLAN_LIMIT_KEYS,
  describePlanLimitHit,
  type PlanLimitHit,
  type PlanLimitKey,
} from './limit-types'

export const PLAN_LIMITS_CACHE_TAG = 'plan-limits'

type PlanLimitRow = {
  limit_key: string
  label: string | null
  free_limit: number | null
}

export type PlanLimits = Record<PlanLimitKey, { label: string; limit: number | null }>

function unlimited(): PlanLimits {
  return Object.fromEntries(
    PLAN_LIMIT_KEYS.map((key) => [key, { label: DEFAULT_PLAN_LIMIT_LABELS[key], limit: null }])
  ) as PlanLimits
}

async function fetchPlanLimits(): Promise<PlanLimits> {
  const limits = unlimited()
  const { data, error } = await createServiceRoleClient()
    .from('plan_limits')
    .select('limit_key, label, free_limit')

  // Fail open: a missing table or a DB hiccup must never block anyone.
  if (error) {
    console.error('[plan-limits] lookup failed, treating all limits as unlimited', error.message)
    return limits
  }

  for (const row of (data ?? []) as PlanLimitRow[]) {
    if (!(PLAN_LIMIT_KEYS as readonly string[]).includes(row.limit_key)) continue
    const key = row.limit_key as PlanLimitKey
    limits[key] = {
      label: row.label?.trim() || DEFAULT_PLAN_LIMIT_LABELS[key],
      limit: typeof row.free_limit === 'number' && row.free_limit >= 0 ? row.free_limit : null,
    }
  }

  return applyDevOverride(limits)
}

/**
 * Local testing only: PLAN_LIMITS_DEV_OVERRIDE='{"active_projects":0}' in
 * .env.local sets limits without touching the database. Ignored outside
 * `next dev`.
 */
function applyDevOverride(limits: PlanLimits): PlanLimits {
  const raw = process.env.PLAN_LIMITS_DEV_OVERRIDE
  if (process.env.NODE_ENV !== 'development' || !raw) return limits
  try {
    const override = JSON.parse(raw) as Record<string, unknown>
    for (const key of PLAN_LIMIT_KEYS) {
      const value = override[key]
      if (value === null) limits[key] = { ...limits[key], limit: null }
      if (typeof value === 'number' && value >= 0) limits[key] = { ...limits[key], limit: value }
    }
  } catch {
    console.error('[plan-limits] PLAN_LIMITS_DEV_OVERRIDE is not valid JSON')
  }
  return limits
}

/** Free-tier limits, cached for a minute. A null limit means unlimited. */
export function getPlanLimits() {
  return unstable_cache(fetchPlanLimits, ['plan-limits'], {
    revalidate: 60,
    tags: [PLAN_LIMITS_CACHE_TAG],
  })()
}

/** Premium = staff bypass or any active row in subscriptions (monthly, complimentary, passes). */
export async function isPremiumUser(user: { email?: string | null }) {
  return (await getCachedSubscriptionStatus(user.email)).isActive
}

type Db = SupabaseClient

async function countActiveProjects(db: Db, userId: string) {
  // Projects have no status of their own: one is finished once it has units
  // and every one of them is complete. Empty projects count as active.
  const [projects, units] = await Promise.all([
    db.from('projects').select('id').eq('user_id', userId),
    db.from('units').select('project_id, status').eq('user_id', userId).not('project_id', 'is', null),
  ])
  if (projects.error) throw new Error(projects.error.message)
  if (units.error) throw new Error(units.error.message)

  const unitStatuses = new Map<string, boolean[]>()
  for (const unit of units.data ?? []) {
    const list = unitStatuses.get(unit.project_id as string) ?? []
    list.push(unit.status === 'complete')
    unitStatuses.set(unit.project_id as string, list)
  }

  return (projects.data ?? []).filter((project) => {
    const statuses = unitStatuses.get(project.id as string)
    return !statuses || statuses.length === 0 || statuses.some((done) => !done)
  }).length
}

async function countUnfinishedUnits(db: Db, userId: string) {
  const { count, error } = await db
    .from('units')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .or('status.is.null,status.neq.complete')
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function countCollectionPaints(db: Db, userId: string) {
  const { count, error } = await db
    .from('user_paint_ownership')
    .select('paint_catalog_id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_owned', true)
  if (error) throw new Error(error.message)
  return count ?? 0
}

const counters: Record<PlanLimitKey, (db: Db, userId: string) => Promise<number>> = {
  active_projects: countActiveProjects,
  unfinished_units: countUnfinishedUnits,
  collection_paints: countCollectionPaints,
}

/**
 * Returns a PlanLimitHit when a free user adding `adding` more items would
 * pass the free limit for `key`, otherwise null. Premium users, unlimited
 * keys and lookup errors all return null, so this never blocks by mistake.
 */
export async function checkPlanLimit(
  db: Db,
  user: { id: string; email?: string | null },
  key: PlanLimitKey,
  adding = 1
): Promise<PlanLimitHit | null> {
  try {
    const { label, limit } = (await getPlanLimits())[key]
    if (limit === null) return null
    if (await isPremiumUser(user)) return null

    const used = await counters[key](db, user.id)
    return used + adding > limit ? { key, label, limit, used } : null
  } catch (error) {
    console.error(`[plan-limits] ${key} check failed, allowing`, error)
    return null
  }
}

/** Thrown from helpers that can't return a result; callers turn it into a response. */
export class PlanLimitError extends Error {
  readonly hit: PlanLimitHit

  constructor(hit: PlanLimitHit) {
    super(describePlanLimitHit(hit))
    this.name = 'PlanLimitError'
    this.hit = hit
  }
}
