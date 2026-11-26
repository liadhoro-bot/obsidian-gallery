// Black Friday 2026: ₪7/month for 12 months, for new Premium sign-ups.
// The charge itself is set in the Make scenario "OG - Monthly Create Payment
// Link" (price 7, 12 payments). This file only drives what the app shows;
// when the sale ends, set that scenario back to price 10 / 36 payments.

import { MONTHLY_PRICE_ILS } from './plans'

export const SALE = {
  name: 'Black Friday',
  priceIls: 7,
  months: 12,
  /** Last moment of Nov 30, Israel time. */
  endsAt: '2026-11-30T23:59:59+02:00',
  endsLabel: 'Nov 30',
} as const

export function isSaleActive(now: number = Date.now()) {
  return now <= new Date(SALE.endsAt).getTime()
}

/** The monthly price a new subscriber pays right now. */
export function currentPremiumPrice(now: number = Date.now()) {
  return isSaleActive(now) ? SALE.priceIls : MONTHLY_PRICE_ILS
}
