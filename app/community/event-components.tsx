import Image from 'next/image'
import Link from '@/app/components/navigation-feedback/navigation-link'
import { TrackedAnchor, TrackedLink } from './tracked-link'
import {
  formatEventDay,
  formatEventMonth,
  formatEventWeekday,
  getEventSummary,
  DEFAULT_EVENT_IMAGE,
  withReferralParams,
  type StoreSpotlight,
  type CommunityEvent,
} from './events-data'

export function eventHref(event: CommunityEvent) {
  return `/community/events/${event.id}`
}

export function EventHero({ event }: { event: CommunityEvent }) {
  const summary = getEventSummary(event)

  return (
    <article
      data-v3-community-indicator="event-hero"
      data-feature-guide-target="community.hero"
    >
      <Image
        src={event.imageUrl ?? DEFAULT_EVENT_IMAGE}
        alt=""
        fill
        sizes="(max-width: 640px) 100vw, 448px"
        className="object-cover"
      />
      <div data-v3-community-indicator="event-hero-shade" aria-hidden="true" />
      <div data-v3-community-indicator="event-hero-body">
        <span data-v3-community-indicator="event-hero-tag">Featured Event</span>
        <h2 data-v3-community-indicator="event-hero-title">{event.name}</h2>
        <p data-v3-community-indicator="event-hero-meta">
          <CalendarIcon />
          {formatEventWeekday(event.eventDate)} {formatEventDay(event.eventDate)}{' '}
          {formatEventMonth(event.eventDate)} · {event.startTime}
        </p>
        <p data-v3-community-indicator="event-hero-meta">
          <PinIcon />
          {event.city}
        </p>
        <span data-v3-community-indicator="event-hero-divider" aria-hidden="true" />
        {summary ? (
          <p data-v3-community-indicator="event-hero-text">{summary}</p>
        ) : null}
        <TrackedLink
          href={eventHref(event)}
          click={{ targetType: 'event', targetId: event.id, linkKind: 'event_page', source: 'events_tab_featured' }}
          data-v3-community-indicator="event-hero-action"
        >
          View event
          <ChevronIcon />
        </TrackedLink>
      </div>
    </article>
  )
}

export function StoreRow({ store }: { store: StoreSpotlight }) {
  return (
    <TrackedAnchor
      href={withReferralParams(store.url)}
      click={{ targetType: 'store', targetId: store.id, linkKind: 'website', source: 'events_tab_stores' }}
      target="_blank"
      rel="noopener"
      data-v3-community-indicator="store-row"
    >
      <span
        data-v3-community-indicator="store-photo"
        data-logo={store.imageIsLogo ? 'true' : undefined}
      >
        <Image
          src={store.image}
          alt=""
          fill
          sizes="80px"
          className={store.imageIsLogo ? 'object-contain' : 'object-cover'}
        />
      </span>
      <span data-v3-community-indicator="upcoming-copy">
        <span data-v3-community-indicator="store-heading">
          <span data-v3-community-indicator="store-name">{store.name}</span>
          <span data-v3-community-indicator="store-chip">
            {store.city ? <PinIcon /> : <GlobeIcon />}
            {store.city ?? 'Online'}
          </span>
        </span>
        <span data-v3-community-indicator="store-text">
          {store.description}
        </span>
      </span>
    </TrackedAnchor>
  )
}

export function UpcomingEventRow({
  event,
  source,
}: {
  event: CommunityEvent
  source: string
}) {
  return (
    <TrackedLink
      href={eventHref(event)}
      click={{ targetType: 'event', targetId: event.id, linkKind: 'event_page', source }}
      data-v3-community-indicator="upcoming-row"
    >
      <span data-v3-community-indicator="date-plate">
        <span>{formatEventMonth(event.eventDate)}</span>
        <span>{formatEventDay(event.eventDate)}</span>
      </span>
      <span data-v3-community-indicator="upcoming-copy">
        <span data-v3-community-indicator="upcoming-title">{event.name}</span>
        <span data-v3-community-indicator="upcoming-meta">
          {formatEventWeekday(event.eventDate)} {event.startTime} ·{' '}
          {event.city}
        </span>
      </span>
      <span data-v3-community-indicator="row-chevron" aria-hidden="true">
        <ChevronIcon />
      </span>
    </TrackedLink>
  )
}

function Icon({ children, size = 14 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

export function CalendarIcon() {
  return (
    <Icon>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </Icon>
  )
}

export function PinIcon() {
  return (
    <Icon>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </Icon>
  )
}

export function ClockIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icon>
  )
}

export function TagIcon() {
  return (
    <Icon>
      <path d="M3 12V4h8l10 10-8 8L3 12Z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </Icon>
  )
}

export function TicketIcon() {
  return (
    <Icon>
      <path d="M3 8a2 2 0 0 0 0 4v4h18v-4a2 2 0 0 1 0-4V4H3v4Z" />
      <path d="M14 4v12" />
    </Icon>
  )
}

export function GlobeIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </Icon>
  )
}

export function ChevronIcon() {
  return (
    <Icon size={16}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  )
}

export function BackIcon() {
  return (
    <Icon size={20}>
      <path d="m15 6-6 6 6 6" />
    </Icon>
  )
}

export function EventsPageHeader({
  backHref,
  backLabel,
  title,
}: {
  backHref: string
  backLabel: string
  title: string
}) {
  return (
    <header data-v3-community-indicator="app-header">
      <Link
        href={backHref}
        aria-label={backLabel}
        data-v3-community-indicator="menu-control"
      >
        <BackIcon />
      </Link>
      <h1 data-v3-community-indicator="app-title">{title}</h1>
      <span aria-hidden="true" className="w-10" />
    </header>
  )
}
