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
}

export const DEFAULT_EVENT_IMAGE = '/onboarding/problem-desk.jpeg'

export type StoreSpotlight = {
  // Stable id: partner_link_clicks.target_id refers to it, so never reuse one.
  id: string
  name: string
  city: string | null
  url: string
  description: string
  image: string
  // Logos are shown whole on a light mount instead of cropped like photos.
  imageIsLogo?: boolean
}

// city null = online-only store.
export const storeSpotlights: StoreSpotlight[] = [
  {
    id: 'syrolynia-jerusalem',
    name: 'Syrolynia',
    city: 'Jerusalem',
    url: 'https://sirolynia.com/il',
    description: 'Trading cards, board games and dice, with play tables for open game nights.',
    image: '/community/stores/syrolynia.webp',
  },
  {
    id: 'the-kingdom-hod-hasharon',
    name: 'The Kingdom',
    city: 'Hod Hasharon',
    url: 'https://thekingdom.co.il/',
    description: 'Shelves packed with board games, from party picks to strategy heavyweights.',
    image: '/community/stores/the-kingdom.jpg',
  },
  {
    id: 'mythic-games-eilat',
    name: 'Mythic Games',
    city: 'Eilat',
    url: 'https://mythic.co.il/',
    description: 'VAT-free Eilat shop for Magic, Pokémon and Warhammer, with Commander nights in store.',
    image: '/community/stores/mythic-games.webp',
  },
  {
    id: 'hobbytech-online',
    name: 'Hobbytech',
    city: null,
    url: 'https://hobbytech.co.il/',
    description: 'Paints, airbrushes and diorama supplies from Vallejo, AK and AMMO.',
    image: '/community/stores/hobbytech.png',
    imageIsLogo: true,
  },
  {
    id: 'modeltrains-online',
    name: 'ModelTrains',
    city: null,
    url: 'https://modeltrains.co.il/',
    description: 'Märklin, Piko and Minitrix trains, track and scenery in H0 and N scale.',
    image: '/community/stores/modeltrains.webp',
  },
]

// Partner link click tracking (see /api/community/link-clicks).
export type PartnerLinkKind =
  | 'event_page'
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
