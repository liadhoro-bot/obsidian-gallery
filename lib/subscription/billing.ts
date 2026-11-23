import 'server-only'

import { revalidateTag } from 'next/cache'
import { Resend } from 'resend'
import { createServiceRoleClient } from '../../utils/supabase/service-role'
import {
  getSubscriptionCacheTag,
  getSubscriptionStatus,
} from './subscription-guard'
import {
  MONTHLY_GRACE_DAYS,
  MONTHLY_PLAN_NAME,
  MONTHLY_PRICE_ILS,
  describePlan,
} from './plans'

const DAY_MS = 24 * 60 * 60 * 1000

type SubscriptionRow = {
  email: string
  plan_name: string | null
  amount: number | string | null
  billing_type: string | null
  status: string | null
  paid_until: string | null
  cancel_at_period_end: boolean | null
  canceled_at: string | null
  grow_transaction_id: string | null
  grow_transaction_token: string | null
  grow_asmachta: string | null
  grow_cancel_status: string | null
}

const SUBSCRIPTION_COLUMNS =
  'email, plan_name, amount, billing_type, status, paid_until, cancel_at_period_end, canceled_at, grow_transaction_id, grow_transaction_token, grow_asmachta, grow_cancel_status'

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null
}

async function fetchSubscriptionRow(email: string) {
  const { data, error } = await createServiceRoleClient()
    .from('subscriptions')
    .select(SUBSCRIPTION_COLUMNS)
    .eq('email', email)
    .maybeSingle()

  if (error) throw new Error(`subscriptions lookup failed: ${error.message}`)
  return (data as SubscriptionRow | null) ?? null
}

function toNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  return Number.isFinite(parsed) ? parsed : null
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setUTCMonth(next.getUTCMonth() + months)
  return next
}

export async function notifyAdmin(subject: string, lines: string[]) {
  const adminEmail = process.env.ADMIN_REPORT_EMAIL
  const resendKey = process.env.RESEND_API_KEY
  const text = lines.join('\n')

  if (!adminEmail || !resendKey) {
    console.info(`[billing] ${subject}\n${text}`)
    return
  }

  try {
    const { error } = await new Resend(resendKey).emails.send({
      from: 'Obsidian Gallery <onboarding@resend.dev>',
      to: adminEmail,
      subject,
      text,
    })
    if (error) console.error('[billing] admin email failed', error)
  } catch (error) {
    console.error('[billing] admin email failed', error)
  }
}

// ---------------------------------------------------------------------------
// Grow notifications (forwarded by the Make "OG - Monthly Payment Notify"
// scenario after it approves the transaction).
// ---------------------------------------------------------------------------

export type GrowPaymentNotice = {
  transactionId: string
  transactionToken: string | null
  asmachta: string | null
  email: string
  fullName: string | null
  phone: string | null
  sum: number | null
  raw: Record<string, unknown>
}

export type RecordPaymentResult =
  | { status: 'recorded'; paidUntil: string }
  | { status: 'duplicate' }

/**
 * Applies one monthly charge: extends paid_until by a month from whichever
 * is later, now or the current paid period. The first charge of a new
 * subscription (or of a re-subscription after cancelling) also stores the
 * Grow identifiers that updateDirectDebit needs to cancel it later.
 */
export async function recordMonthlyPayment(
  notice: GrowPaymentNotice
): Promise<RecordPaymentResult> {
  const email = normalizeEmail(notice.email)
  if (!email) throw new Error('Payment notice has no email')

  const service = createServiceRoleClient()
  const existing = await fetchSubscriptionRow(email)
  const now = new Date()

  const isRenewal =
    existing?.billing_type === 'recurring' && !existing.cancel_at_period_end
  // A charge after the user cancelled, while Grow never confirmed stopping
  // the direct debit, is the old debit still running, not a new
  // subscription. Keep the cancellation so the user isn't silently put back
  // on a plan they already left.
  const chargedAfterCancel =
    existing?.billing_type === 'recurring' &&
    Boolean(existing.cancel_at_period_end) &&
    existing.grow_cancel_status !== 'synced'
  const currentPaidUntil = existing?.paid_until ? new Date(existing.paid_until) : null
  // A recurring row's paid_until includes the grace days; don't stack them.
  const currentPeriodEnd =
    currentPaidUntil && existing?.billing_type === 'recurring'
      ? new Date(currentPaidUntil.getTime() - MONTHLY_GRACE_DAYS * DAY_MS)
      : currentPaidUntil
  const base =
    currentPeriodEnd && currentPeriodEnd.getTime() > now.getTime()
      ? currentPeriodEnd
      : now
  const paidUntil = new Date(
    addMonths(base, 1).getTime() + MONTHLY_GRACE_DAYS * DAY_MS
  ).toISOString()

  // Claim the transaction first: Grow re-sends a notification until it is
  // approved, and Make may retry, so the same id can arrive more than once.
  const { error: claimError } = await service.from('subscription_payments').insert({
    grow_transaction_id: notice.transactionId,
    email,
    plan_name: MONTHLY_PLAN_NAME,
    amount: notice.sum,
    paid_until: paidUntil,
    payload: notice.raw,
  })

  if (claimError) {
    if (claimError.code === '23505') return { status: 'duplicate' }
    throw new Error(`payment log insert failed: ${claimError.message}`)
  }

  const row: Record<string, unknown> = {
    email,
    plan_name: MONTHLY_PLAN_NAME,
    billing_type: 'recurring',
    amount: notice.sum ?? MONTHLY_PRICE_ILS,
    currency: 'ILS',
    status: 'active',
    paid_until: paidUntil,
    last_payment_at: now.toISOString(),
  }
  if (notice.fullName) row.full_name = notice.fullName
  if (notice.phone) row.phone = notice.phone

  if (!isRenewal && !chargedAfterCancel) {
    row.grow_transaction_id = notice.transactionId
    row.grow_transaction_token = notice.transactionToken
    row.grow_asmachta = notice.asmachta
    row.cancel_at_period_end = false
    row.canceled_at = null
    row.grow_cancel_status = null
  }

  const { error: upsertError } = await service
    .from('subscriptions')
    .upsert(row, { onConflict: 'email' })

  if (upsertError) {
    // Release the claim so Make's retry can try again.
    await service
      .from('subscription_payments')
      .delete()
      .eq('grow_transaction_id', notice.transactionId)
    throw new Error(`subscription upsert failed: ${upsertError.message}`)
  }

  revalidateTag(getSubscriptionCacheTag(email), { expire: 0 })

  if (existing?.cancel_at_period_end) {
    await notifyAdmin(`Payment on a cancelled subscription: ${email}`, [
      `${email} was charged after cancelling their monthly plan.`,
      chargedAfterCancel
        ? 'Grow never confirmed the cancel, so the old direct debit is still running. Stop it in the Grow dashboard and refund this charge. The plan stays cancelled in the app.'
        : 'If they did not subscribe again, check the direct debit in Grow and refund.',
      '',
      `Grow transaction: ${notice.transactionId}`,
      `Cancelled at: ${existing.canceled_at ?? 'unknown'}`,
    ])
  }

  return { status: 'recorded', paidUntil }
}

/**
 * True when the user already has a monthly plan Grow may still charge.
 * A second payment link would start a second direct debit.
 */
export async function hasUncancelledMonthlyPlan(rawEmail: string | null | undefined) {
  const email = normalizeEmail(rawEmail)
  if (!email) return false
  const row = await fetchSubscriptionRow(email)
  return row?.billing_type === 'recurring' && !row.cancel_at_period_end
}

// ---------------------------------------------------------------------------
// Cancellation
// ---------------------------------------------------------------------------

export type CancelResult =
  | { ok: true; accessUntil: string | null }
  | { ok: false; error: string; status: number }

type GrowCancelOutcome = 'synced' | 'manual' | 'failed'

async function cancelInGrow(row: SubscriptionRow): Promise<GrowCancelOutcome> {
  // Unset for now: Grow's Make "Make an API Call" module fails before
  // reaching Grow (IML error in the module itself), so cancellations go to
  // the admin email fallback. Set this only to a scenario that answers with
  // Grow's updateDirectDebit status; never to the create-link webhook.
  const webhookUrl = process.env.GROW_CANCEL_WEBHOOK_URL
  if (!webhookUrl || !row.grow_transaction_id || !row.grow_transaction_token || !row.grow_asmachta) {
    return 'manual'
  }

  const sharedSecret = process.env.MAKE_WEBHOOK_SHARED_SECRET
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sharedSecret ? { 'x-webhook-secret': sharedSecret } : {}),
      },
      body: JSON.stringify({
        action: 'cancel',
        email: row.email,
        transactionId: row.grow_transaction_id,
        transactionToken: row.grow_transaction_token,
        asmachta: row.grow_asmachta,
      }),
    })
    if (!response.ok) return 'failed'

    // The Make scenario answers with Grow's own status (1 = success).
    const payload = (await response.json().catch(() => null)) as { status?: unknown } | null
    return String(payload?.status) === '1' ? 'synced' : 'failed'
  } catch (error) {
    console.error('[billing] Grow cancel call failed', error)
    return 'failed'
  }
}

/**
 * Stops future monthly charges. Access continues until the end of the
 * period already paid for. If Grow can't be reached, the cancellation is
 * still recorded and the admin is emailed to stop the charge by hand.
 */
export async function cancelMonthlySubscription(
  rawEmail: string | null | undefined
): Promise<CancelResult> {
  const email = normalizeEmail(rawEmail)
  if (!email) return { ok: false, error: 'Not signed in.', status: 401 }

  const row = await fetchSubscriptionRow(email)
  if (!row || row.billing_type !== 'recurring') {
    return { ok: false, error: 'You have no monthly plan to cancel.', status: 404 }
  }
  if (row.cancel_at_period_end) {
    return { ok: true, accessUntil: row.paid_until }
  }

  const outcome = await cancelInGrow(row)
  const canceledAt = new Date().toISOString()

  const { error } = await createServiceRoleClient()
    .from('subscriptions')
    .update({
      cancel_at_period_end: true,
      canceled_at: canceledAt,
      grow_cancel_status: outcome,
    })
    .eq('email', email)

  if (error) {
    console.error('[billing] cancel update failed', error)
    return { ok: false, error: 'Could not cancel right now. Try again in a moment.', status: 500 }
  }

  revalidateTag(getSubscriptionCacheTag(email), { expire: 0 })

  if (outcome !== 'synced') {
    await notifyAdmin(`Cancel monthly plan in Grow: ${email}`, [
      `${email} cancelled their monthly plan, but Grow was not updated automatically (${outcome}).`,
      'Stop their direct debit (הוראת קבע) in the Grow dashboard so they are not charged again.',
      '',
      `Grow transaction: ${row.grow_transaction_id ?? 'unknown'}`,
      `Asmachta: ${row.grow_asmachta ?? 'unknown'}`,
      `Access until: ${row.paid_until ?? 'unknown'}`,
    ])
  }

  return { ok: true, accessUntil: row.paid_until }
}

// ---------------------------------------------------------------------------
// Settings "Plan" card
// ---------------------------------------------------------------------------

export type PlanSummary = {
  /** Headline, e.g. "Free", "Premium", "Founder's Pass". */
  label: string
  /** Badge next to the headline. */
  badge: 'Free' | 'Active' | 'Cancelled' | 'Staff'
  priceLabel: string
  /** e.g. "Renews Nov 19, 2026", "Access until Dec 18, 2026". */
  detail: string
  canCancel: boolean
  /** Show the Upgrade to Premium button. */
  canUpgrade: boolean
}

export async function getPlanSummary(user: { email?: string | null }): Promise<PlanSummary> {
  const email = normalizeEmail(user.email)
  const [status, row] = await Promise.all([
    getSubscriptionStatus(email),
    email ? fetchSubscriptionRow(email).catch(() => null) : Promise.resolve(null),
  ])

  const isStaff = status.isActive && status.planName === 'bypass'
  const isRecurring = row?.billing_type === 'recurring'
  const canceled = Boolean(row?.cancel_at_period_end)

  // A monthly plan that hasn't been cancelled may still be charged by Grow,
  // even after paid_until lapses (a late or missed notify) and even on a
  // staff account. Always show it with a Cancel button, whatever else grants
  // access; never fall through to "Staff" or "Free" and hide it.
  if (row && isRecurring && !canceled) {
    const plan = describePlan(row.plan_name, toNumber(row.amount))
    // paid_until on a monthly row includes grace days; the renewal date doesn't.
    const periodEnd = row.paid_until
      ? new Date(new Date(row.paid_until).getTime() - MONTHLY_GRACE_DAYS * DAY_MS)
      : null
    const lapsed = !periodEnd || periodEnd.getTime() <= Date.now()
    return {
      label: plan.label,
      badge: 'Active',
      priceLabel: plan.priceLabel,
      detail: lapsed
        ? 'Monthly billing is on. Cancel to stop future charges.'
        : `Renews ${formatDate(periodEnd.toISOString())}`,
      canCancel: true,
      canUpgrade: false,
    }
  }

  if (isStaff) {
    return {
      label: 'Staff access',
      badge: 'Staff',
      priceLabel: 'Free',
      detail: 'Premium, no billing.',
      canCancel: false,
      canUpgrade: false,
    }
  }

  if (row?.paid_until && new Date(row.paid_until).getTime() > Date.now()) {
    // Live monthly plans returned above, so this is a cancelled monthly
    // plan or a one-time pass.
    const plan = describePlan(row.plan_name, toNumber(row.amount))
    const neverEnds = new Date(row.paid_until).getUTCFullYear() >= 2099

    return {
      label: plan.label,
      badge: isRecurring && canceled ? 'Cancelled' : 'Active',
      priceLabel: plan.priceLabel,
      detail: neverEnds ? 'No end date.' : `Premium until ${formatDate(row.paid_until)}`,
      canCancel: false,
      canUpgrade: false,
    }
  }

  return {
    label: 'Free',
    badge: 'Free',
    priceLabel: 'Free',
    detail: `Upgrade to Premium for ₪${MONTHLY_PRICE_ILS}/month to lift the free plan's limits.`,
    canCancel: false,
    canUpgrade: true,
  }
}
