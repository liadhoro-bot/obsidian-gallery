// Shared by server and client: the free-tier limits and what a server
// returns when a free user hits one. The numbers live in the plan_limits
// table (see lib/plan/limits.ts), so they can change without a deploy.

import { MONTHLY_PRICE_ILS } from '../subscription/plans'

export const PREMIUM_PRICE_ILS = MONTHLY_PRICE_ILS

export const PLAN_LIMIT_KEYS = [
  'active_projects',
  'unfinished_units',
  'collection_paints',
] as const

export type PlanLimitKey = (typeof PLAN_LIMIT_KEYS)[number]

/** A free user tried to go past a limit. */
export type PlanLimitHit = {
  key: PlanLimitKey
  /** Short noun phrase, e.g. "active projects". */
  label: string
  limit: number
  used: number
}

/** Fallback labels when a plan_limits row has none. */
export const DEFAULT_PLAN_LIMIT_LABELS: Record<PlanLimitKey, string> = {
  active_projects: 'active projects',
  unfinished_units: 'unfinished units',
  collection_paints: 'paints in your collection',
}

export function isPlanLimitHit(value: unknown): value is PlanLimitHit {
  if (!value || typeof value !== 'object') return false
  const hit = value as Partial<PlanLimitHit>
  return (
    typeof hit.key === 'string' &&
    (PLAN_LIMIT_KEYS as readonly string[]).includes(hit.key) &&
    typeof hit.limit === 'number' &&
    typeof hit.used === 'number'
  )
}

const LIMIT_PARAM = 'plan_limit'

/** For actions that redirect: carries the hit in the URL for the upgrade prompt. */
export function planLimitSearchParams(hit: PlanLimitHit) {
  return new URLSearchParams({
    [LIMIT_PARAM]: hit.key,
    limit_label: hit.label,
    limit_max: String(hit.limit),
    limit_used: String(hit.used),
  }).toString()
}

export function planLimitFromSearchParams(params: URLSearchParams): PlanLimitHit | null {
  const hit = {
    key: params.get(LIMIT_PARAM),
    label: params.get('limit_label') ?? '',
    limit: Number(params.get('limit_max')),
    used: Number(params.get('limit_used')),
  }
  if (!isPlanLimitHit(hit) || !Number.isFinite(hit.limit) || !Number.isFinite(hit.used)) return null
  return { ...hit, label: hit.label || DEFAULT_PLAN_LIMIT_LABELS[hit.key] }
}

export const PLAN_LIMIT_URL_PARAMS = [LIMIT_PARAM, 'limit_label', 'limit_max', 'limit_used']

export function describePlanLimitHit(hit: PlanLimitHit) {
  return `The free plan includes up to ${hit.limit} ${hit.label}.`
}
