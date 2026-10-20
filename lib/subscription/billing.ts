import 'server-only'

import { revalidateTag } from 'next/cache'
import { Resend } from 'resend'
import { createServiceRoleClient } from '../../utils/supabase/service-role'
import {
  getAccessState,
  getSubscriptionCacheTag,
  type AccessUser,
} from './subscription-guard'
import { isMonthlyPaymentEnabled, isPricingV2Active } from './pricing'
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
}

const SUBSCRIPTION_COLUMNS =
  'email, plan_name, amount, billing_type, status, paid_until, cancel_at_period_end, canceled_at, grow_transaction_id, grow_transaction_token, grow_asmachta'

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

  if (!isRenewal) {
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
      'If they did not subscribe again, check the direct debit in Grow and refund.',
      '',
      `Grow transaction: ${notice.transactionId}`,
      `Cancelled at: ${existing.canceled_at ?? 'unknown'}`,
    ])
  }

  return { status: 'recorded', paidUntil }
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
  /** Headline, e.g. "Free trial", "Monthly", "Founder's Pass". */
  label: string
  /** Badge next to the headline. */
  badge: 'Active' | 'Trial' | 'Cancelled' | 'Expired' | 'Staff'
  priceLabel: string
  /** e.g. "Renews Nov 19, 2026", "Access until Dec 18, 2026", "4 days left". */
  detail: string
  canCancel: boolean
  /** Show the "Subscribe" call to action, and what it says. */
  subscribeLabel: string | null
}

export async function getPlanSummary(user: AccessUser): Promise<PlanSummary> {
  const email = normalizeEmail(user.email)
  const [access, row] = await Promise.all([
    getAccessState(user),
    email ? fetchSubscriptionRow(email).catch(() => null) : Promise.resolve(null),
  ])
  const monthlyOpen = !isPricingV2Active() || isMonthlyPaymentEnabled()
  const subscribeLabel = monthlyOpen ? `Subscribe for ₪${MONTHLY_PRICE_ILS}/month` : null

  if (access.status === 'bypass') {
    return {
      label: 'Staff access',
      badge: 'Staff',
      priceLabel: 'Free',
      detail: 'Full access, no billing.',
      canCancel: false,
      subscribeLabel: null,
    }
  }

  if (row?.paid_until) {
    const plan = describePlan(row.plan_name, toNumber(row.amount))
    const isActive = new Date(row.paid_until).getTime() > Date.now()
    const isRecurring = row.billing_type === 'recurring'
    const canceled = Boolean(row.cancel_at_period_end)
    // paid_until on a monthly row includes grace days; the renewal date doesn't.
    const periodEnd = isRecurring
      ? new Date(new Date(row.paid_until).getTime() - MONTHLY_GRACE_DAYS * DAY_MS).toISOString()
      : row.paid_until
    const neverEnds = new Date(row.paid_until).getUTCFullYear() >= 2099

    if (isActive) {
      return {
        label: plan.label,
        badge: isRecurring && canceled ? 'Cancelled' : 'Active',
        priceLabel: plan.priceLabel,
        detail: neverEnds
          ? 'No end date.'
          : isRecurring && !canceled
            ? `Renews ${formatDate(periodEnd)}`
            : `Access until ${formatDate(row.paid_until)}`,
        canCancel: isRecurring && !canceled,
        subscribeLabel: null,
      }
    }

    return {
      label: plan.label,
      badge: 'Expired',
      priceLabel: plan.priceLabel,
      detail: `Ended ${formatDate(row.paid_until)}`,
      canCancel: false,
      subscribeLabel,
    }
  }

  if (access.status === 'trialing') {
    const daysLeft = access.endsAt
      ? Math.max(0, Math.ceil((new Date(access.endsAt).getTime() - Date.now()) / DAY_MS))
      : null
    return {
      label: 'Free trial',
      badge: 'Trial',
      priceLabel: 'Free',
      detail:
        daysLeft === null
          ? 'Trial active'
          : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left · ends ${formatDate(access.endsAt!)}`,
      canCancel: false,
      subscribeLabel,
    }
  }

  if (access.status === 'trial_expired') {
    return {
      label: 'Free trial',
      badge: 'Expired',
      priceLabel: 'Free',
      detail: `Ended ${formatDate(access.endsAt)}`,
      canCancel: false,
      subscribeLabel,
    }
  }

  return {
    label: 'No plan',
    badge: 'Expired',
    priceLabel: '—',
    detail: 'You have no active plan.',
    canCancel: false,
    subscribeLabel,
  }
}
