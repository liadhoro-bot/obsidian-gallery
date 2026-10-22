// Event types and formatters shared by the Events tab and event pages.
// Event rows come from public.community_events
// (supabase/migrations/20261012120000_add_community_events.sql).

export type CommunityEventType =
  | 'workshop'
  | 'paint_night'
  | 'tournament'
  | 'league'
  | 'class'
  | 'meetup'
  | 'other'

export type CommunityEvent = {
  id: string
  name: string
  eventDate: string
  startTime: string
  endTime: string | null
  eventType: CommunityEventType
  locationName: string | null
  address: string | null
  city: string
  price: number | null
  currency: string
  description: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  contactUrl: string | null
  imageUrl: string | null
  isFeatured: boolean
  // Hosting partner store (stores-data.ts id), if any.
  storeId: string | null
}

export const DEFAULT_EVENT_IMAGE = '/onboarding/problem-desk.jpeg'

// Partner link click tracking (see /api/community/link-clicks).
export type PartnerLinkKind =
  | 'event_page'
  | 'store_page'
  | 'promo_code'
  | 'website'
  | 'registration'
  | 'phone'
  | 'email'
  | 'social'

export type PartnerLinkClick = {
  targetType: 'event' | 'store'
  targetId: string
  linkKind: PartnerLinkKind
  source: string
}

// Tags outbound web links so partners see Obsidian Gallery traffic in their
// own analytics. Existing utm_* values on the link are kept.
export function withReferralParams(url: string) {
  try {
    const target = new URL(url)
    if (target.protocol !== 'http:' && target.protocol !== 'https:') return url
    const params = {
      utm_source: 'obsidian_gallery',
      utm_medium: 'referral',
      utm_campaign: 'community_events',
    }
    for (const [key, value] of Object.entries(params)) {
      if (!target.searchParams.has(key)) target.searchParams.set(key, value)
    }
    return target.toString()
  } catch {
    return url
  }
}


export const eventTypeLabels: Record<CommunityEventType, string> = {
  workshop: 'Workshop',
  paint_night: 'Paint night',
  tournament: 'Tournament',
  league: 'League',
  class: 'Class',
  meetup: 'Meetup',
  other: 'Event',
}

export function formatEventFullLocation(event: CommunityEvent) {
  return [event.locationName, event.address, event.city]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(', ')
}

export function pickFeaturedEvent(events: CommunityEvent[]) {
  return events.find((event) => event.isFeatured) ?? events[0] ?? null
}

// Dates are calendar days, so format in UTC to avoid timezone drift.
function formatDatePart(eventDate: string, options: Intl.DateTimeFormatOptions) {
  return new Date(`${eventDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    ...options,
  })
}

export function formatEventMonth(eventDate: string) {
  return formatDatePart(eventDate, { month: 'short' })
}

export function formatEventDay(eventDate: string) {
  return formatDatePart(eventDate, { day: 'numeric' })
}

export function formatEventWeekday(eventDate: string) {
  return formatDatePart(eventDate, { weekday: 'short' })
}

export function formatEventLongDate(eventDate: string) {
  return formatDatePart(eventDate, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatEventHours(event: CommunityEvent) {
  return event.endTime ? `${event.startTime}–${event.endTime}` : event.startTime
}

export function formatEventPrice(event: CommunityEvent) {
  if (event.price === null) return 'Price TBA'
  if (event.price === 0) return 'Free'
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: event.currency,
    maximumFractionDigits: event.price % 1 === 0 ? 0 : 2,
  }).format(event.price)
}

// Descriptions are plain text: blank lines split blocks, "* " starts a
// bullet, and a line ending in "?" or ":" is a subheading.
export type EventDescriptionBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }

export function parseEventDescription(description: string | null) {
  const blocks: EventDescriptionBlock[] = []
  for (const line of (description ?? '').split(/\r?\n/)) {
    const text = line.trim()
    if (!text) continue
    const last = blocks.at(-1)
    if (/^[*\-•]\s+/.test(text)) {
      const item = text.replace(/^[*\-•]\s+/, '')
      if (last?.kind === 'list') last.items.push(item)
      else blocks.push({ kind: 'list', items: [item] })
    } else if (/[?:]$/.test(text)) {
      blocks.push({ kind: 'heading', text })
    } else {
      blocks.push({ kind: 'paragraph', text })
    }
  }
  return blocks
}

export function getEventSummary(event: CommunityEvent) {
  const paragraph = parseEventDescription(event.description).find(
    (block) => block.kind === 'paragraph'
  )
  return paragraph?.kind === 'paragraph' ? paragraph.text : null
}
