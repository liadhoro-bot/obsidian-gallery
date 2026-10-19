// Display info for every plan_name that exists in `subscriptions`. Rows are
// written by Make scenarios and by hand, so names are free text; anything
// unrecognized falls back to a generic paid plan.

export const MONTHLY_PLAN_NAME = 'obsidian-gallery-monthly'
export const MONTHLY_PRICE_ILS = 10

/** Extra days of access after each monthly charge, so a late Grow charge never locks anyone out. */
export const MONTHLY_GRACE_DAYS = 3

export type PlanKind =
  | 'monthly'
  | 'founders'
  | 'pass'
  | 'complimentary'
  | 'lifetime'

export type PlanInfo = {
  kind: PlanKind
  label: string
  /** e.g. "₪10 / month", "₪15 one-time", "Complimentary". */
  priceLabel: string
}

function formatAmount(amount: number | null) {
  return amount && amount > 0 ? `₪${amount}` : null
}

export function describePlan(
  planName: string | null,
  amount: number | null
): PlanInfo {
  const name = (planName ?? '').trim().toLowerCase()
  const paid = formatAmount(amount)

  if (name === MONTHLY_PLAN_NAME) {
    return {
      kind: 'monthly',
      label: 'Monthly',
      priceLabel: `₪${amount && amount > 0 ? amount : MONTHLY_PRICE_ILS} / month`,
    }
  }

  if (name.includes('founder')) {
    return {
      kind: 'founders',
      label: "Founder's Pass",
      priceLabel: paid ? `${paid} one-time` : 'One-time',
    }
  }

  if (name.includes('complimentary') || amount === 0) {
    return { kind: 'complimentary', label: 'Complimentary', priceLabel: 'Free' }
  }

  if (name.includes('lifetime')) {
    return { kind: 'lifetime', label: 'Lifetime Pass', priceLabel: 'No renewal' }
  }

  const duration = name.match(/(\d+)\s*(mo|d)\b/)
  const durationLabel = duration
    ? duration[2] === 'mo'
      ? `${duration[1]}-month`
      : `${duration[1]}-day`
    : null

  return {
    kind: 'pass',
    label: name.includes('creator')
      ? 'Creator Pass'
      : durationLabel
        ? `${durationLabel[0].toUpperCase()}${durationLabel.slice(1)} Pass`
        : 'Pass',
    priceLabel: paid ? `${paid} one-time` : 'One-time',
  }
}
