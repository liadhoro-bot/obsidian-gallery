import { notFound } from 'next/navigation'
import Image from 'next/image'
import {
  CalendarIcon,
  ClockIcon,
  EventsPageHeader,
  PinIcon,
  TagIcon,
  TicketIcon,
} from '../../event-components'
import {
  eventTypeLabels,
  formatEventFullLocation,
  formatEventHours,
  formatEventLongDate,
  formatEventPrice,
  DEFAULT_EVENT_IMAGE,
  parseEventDescription,
  withReferralParams,
  type PartnerLinkKind,
} from '../../events-data'
import { getCommunityEvent } from '../../events-queries'
import { TrackedAnchor } from '../../tracked-link'
import styles from '../../community-v3-silver.module.css'

type ContactLine = {
  label: string
  value: string
  href?: string
  kind?: PartnerLinkKind
  external?: boolean
}

export default async function CommunityEventPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const event = await getCommunityEvent(id)
  if (!event) notFound()

  const details = [
    { label: 'Date', value: formatEventLongDate(event.eventDate), icon: <CalendarIcon /> },
    { label: 'Hours', value: formatEventHours(event), icon: <ClockIcon /> },
    { label: 'Type', value: eventTypeLabels[event.eventType], icon: <TagIcon /> },
    {
      label: 'Location',
      value: formatEventFullLocation(event),
      icon: <PinIcon />,
    },
    { label: 'Price', value: formatEventPrice(event), icon: <TicketIcon /> },
  ]

  const descriptionBlocks = parseEventDescription(event.description)

  const contacts: ContactLine[] = []
  if (event.contactName) contacts.push({ label: 'Host', value: event.contactName })
  if (event.contactEmail) {
    contacts.push({
      label: 'Email',
      value: event.contactEmail,
      href: `mailto:${event.contactEmail}`,
      kind: 'email',
    })
  }
  if (event.contactPhone) {
    contacts.push({
      label: 'Phone',
      value: event.contactPhone,
      href: `tel:${event.contactPhone.replace(/[^\d+]/g, '')}`,
      kind: 'phone',
    })
  }
  if (event.contactUrl) {
    contacts.push({
      label: 'Website',
      value: event.contactUrl.replace(/^https?:\/\//, ''),
      href: withReferralParams(event.contactUrl),
      kind: 'website',
      external: true,
    })
  }

  return (
    <main className={styles.communitySilver}>
      <div
        className="mx-auto flex w-full max-w-md flex-col gap-3 px-3 pb-28 pt-6"
        data-v3-community-indicator="content"
      >
        <EventsPageHeader
          backHref="/community/events"
          backLabel="Back to events"
          title="Event"
        />

        <article data-v3-community-indicator="event-hero" data-variant="compact">
          <Image
            src={event.imageUrl ?? DEFAULT_EVENT_IMAGE}
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 100vw, 448px"
            className="object-cover"
          />
          <div data-v3-community-indicator="event-hero-shade" aria-hidden="true" />
          <div data-v3-community-indicator="event-hero-body">
            <span data-v3-community-indicator="event-hero-tag">
              {eventTypeLabels[event.eventType]}
            </span>
            <h2 data-v3-community-indicator="event-hero-title">{event.name}</h2>
          </div>
        </article>

        <section data-v3-community-indicator="section-card" className="overflow-hidden">
          <div className="px-4 py-3">
            <h2 className="text-[10px] uppercase">Details</h2>
          </div>
          <div className="divide-y">
            {details.map((detail) => (
              <div key={detail.label} data-v3-community-indicator="detail-row">
                <span data-v3-community-indicator="detail-icon">{detail.icon}</span>
                <span data-v3-community-indicator="detail-label">{detail.label}</span>
                <span data-v3-community-indicator="detail-value">{detail.value}</span>
              </div>
            ))}
          </div>
        </section>

        {descriptionBlocks.length > 0 ? (
          <section data-v3-community-indicator="section-card" className="overflow-hidden">
            <div className="px-4 py-3">
              <h2 className="text-[10px] uppercase">About</h2>
            </div>
            <div data-v3-community-indicator="detail-description">
              {descriptionBlocks.map((block, index) =>
                block.kind === 'heading' ? (
                  <h3 key={index} dir="auto">
                    {block.text}
                  </h3>
                ) : block.kind === 'list' ? (
                  <ul key={index}>
                    {block.items.map((item) => (
                      <li key={item} dir="auto">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p key={index} dir="auto">
                    {block.text}
                  </p>
                )
              )}
            </div>
          </section>
        ) : null}

        {contacts.length > 0 ? (
          <section data-v3-community-indicator="section-card" className="overflow-hidden">
            <div className="px-4 py-3">
              <h2 className="text-[10px] uppercase">Contact</h2>
            </div>
            <div className="divide-y">
              {contacts.map((contact) => (
                <div
                  key={contact.label}
                  data-v3-community-indicator="detail-row"
                  data-variant="contact"
                >
                  <span data-v3-community-indicator="detail-label">{contact.label}</span>
                  {contact.href && contact.kind ? (
                    <TrackedAnchor
                      href={contact.href}
                      click={{
                        targetType: 'event',
                        targetId: event.id,
                        linkKind: contact.kind,
                        source: 'event_page_contact',
                      }}
                      target={contact.external ? '_blank' : undefined}
                      rel={contact.external ? 'noopener' : undefined}
                      data-v3-community-indicator="detail-value"
                    >
                      {contact.value}
                    </TrackedAnchor>
                  ) : (
                    <span data-v3-community-indicator="detail-value">{contact.value}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  )
}
