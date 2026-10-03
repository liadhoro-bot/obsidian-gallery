// Pricing v2 (14-day free trial, then monthly) replaces the Founder's Pass
// paywall at this instant. Before it, every gate behaves exactly as it did
// with the Founder's Pass. Default: 00:00 on 4 Oct 2026, Israel time (IDT,
// UTC+3). Set PRICING_V2_STARTS_AT to a past ISO time on a Preview
// deployment to test the trial flow early. Never set it in Production.
const DEFAULT_PRICING_V2_STARTS_AT = '2026-10-03T21:00:00Z'

export const PRICING_V2_STARTS_AT =
  process.env.PRICING_V2_STARTS_AT?.trim() || DEFAULT_PRICING_V2_STARTS_AT

const pricingV2StartsAtMs = (() => {
  const parsed = new Date(PRICING_V2_STARTS_AT).getTime()
  // A malformed override must not flip pricing early or never; fall back to
  // the planned cutover.
  return Number.isNaN(parsed)
    ? new Date(DEFAULT_PRICING_V2_STARTS_AT).getTime()
    : parsed
})()

export function isPricingV2Active(now: Date = new Date()) {
  return now.getTime() >= pricingV2StartsAtMs
}

export const TRIAL_LENGTH_DAYS = 14

/**
 * Off until the monthly (₪10/month) Grow + Make flow is wired. While off,
 * an expired trial sees a "coming soon" notice instead of a payment form,
 * and /api/subscription/create-payment refuses after the cutover so the
 * existing ₪15 Make scenario can't sell a Founder's Pass by accident.
 */
export function isMonthlyPaymentEnabled() {
  return process.env.MONTHLY_PAYMENT_ENABLED === 'true'
}
