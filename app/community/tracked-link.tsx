'use client'

import type { ComponentProps, MouseEvent } from 'react'
import Link from '@/app/components/navigation-feedback/navigation-link'
import type { PartnerLinkClick } from './events-data'

const CLICK_ENDPOINT = '/api/community/link-clicks'

// sendBeacon survives the page navigating away; fetch keepalive is the
// fallback for browsers without it.
export function recordPartnerLinkClick(click: PartnerLinkClick) {
  const body = JSON.stringify(click)
  try {
    if (navigator.sendBeacon?.(CLICK_ENDPOINT, new Blob([body], { type: 'application/json' }))) {
      return
    }
  } catch {
    // Fall through to fetch.
  }
  void fetch(CLICK_ENDPOINT, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
  }).catch(() => {})
}

function trackOn(click: PartnerLinkClick) {
  return {
    onClick: () => recordPartnerLinkClick(click),
    // Middle-click opens a new tab without firing onClick.
    onAuxClick: (event: MouseEvent) => {
      if (event.button === 1) recordPartnerLinkClick(click)
    },
  }
}

// In-app link (e.g. an event page) that logs the click.
export function TrackedLink({
  click,
  ...props
}: ComponentProps<typeof Link> & { click: PartnerLinkClick }) {
  return <Link {...props} {...trackOn(click)} />
}

// Outbound link (website, phone, email) that logs the click.
export function TrackedAnchor({
  click,
  ...props
}: ComponentProps<'a'> & { click: PartnerLinkClick }) {
  return <a {...props} {...trackOn(click)} />
}
