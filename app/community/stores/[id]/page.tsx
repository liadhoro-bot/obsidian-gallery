import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from '@/app/components/navigation-feedback/navigation-link'
import {
  ChevronIcon,
  EventsPageHeader,
  GlobeIcon,
  PinIcon,
  UpcomingEventRow,
} from '../../event-components'
import { withReferralParams } from '../../events-data'
import { getUpcomingCommunityEvents } from '../../events-queries'
import {
  InfoClockIcon,
  InfoGlobeIcon,
  InfoPhoneIcon,
  InfoPinIcon,
  OfferingIcon,
} from '../../store-icons'
import { getStore, storeOfferingLabels } from '../../stores-data'
import { TrackedAnchor } from '../../tracked-link'
import styles from '../../community-v3-silver.module.css'

const MIN_PHOTO_SLOTS = 3
const COMING_SOON = 'Coming soon'

export default async function CommunityStorePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const store = getStore(id)
  if (!store) notFound()

  // Events aren't linked to stores yet, so show what's on in the store's
  // city, or the next community events for online stores and quiet cities.
  const upcoming = await getUpcomingCommunityEvents()
  const localEvents = store.city
    ? upcoming.filter((event) => event.city === store.city)
    : []
  const events = (localEvents.length > 0 ? localEvents : upcoming).slice(0, 3)
  const eventsTitle =
    localEvents.length > 0 ? `Events in ${store.city}` : 'Upcoming community events'

  const photoSlots = Math.max(MIN_PHOTO_SLOTS, store.photos.length)
  const website = store.url ? withReferralParams(store.url) : null
  const trackStore = (linkKind: 'website' | 'phone' | 'social', source: string) => ({
    targetType: 'store' as const,
    targetId: store.id,
    linkKind,
    source,
  })

  return (
    <main className={styles.communitySilver}>
      <div
        className="mx-auto flex w-full max-w-md flex-col gap-3 px-3 pb-28 pt-6"
        data-v3-community-indicator="content"
      >
        <EventsPageHeader
          backHref="/community"
          backLabel="Back to community"
          title="Store"
        />

        <article data-v3-community-indicator="event-hero" data-variant="store">
          <Image
            src={store.heroImage ?? store.image}
            alt=""
            fill
            priority
            sizes="(max-width: 640px) 100vw, 448px"
            className="object-cover"
          />
          <div data-v3-community-indicator="event-hero-shade" aria-hidden="true" />
          <div data-v3-community-indicator="event-hero-body">
            <h2 data-v3-community-indicator="store-hero-title">{store.name}</h2>
            <p data-v3-community-indicator="store-hero-tagline">{store.tagline}</p>
            <p data-v3-community-indicator="event-hero-meta">
              {store.city ? <PinIcon /> : <GlobeIcon />}
              {store.city ?? 'Online store'}
            </p>
            {store.highlights.length > 0 ? (
              <ul data-v3-community-indicator="store-hero-chips">
                {store.highlights.slice(0, 3).map((highlight) => (
                  <li key={highlight}>{highlight}</li>
                ))}
              </ul>
            ) : null}
            <div data-v3-community-indicator="store-hero-actions">
              <a href="#store-events" data-v3-community-indicator="event-hero-action">
                View events
                <ChevronIcon />
              </a>
              {website ? (
                <TrackedAnchor
                  href={website}
                  click={trackStore('website', 'store_page_hero')}
                  target="_blank"
                  rel="noopener"
                  data-v3-community-indicator="store-hero-secondary"
                >
                  Visit website
                </TrackedAnchor>
              ) : null}
            </div>
          </div>
        </article>

        <StoreSection title="About the store">
          <p data-v3-community-indicator="store-about">{store.about}</p>
        </StoreSection>

        <StoreSection title="Quick info">
          <dl data-v3-community-indicator="store-info-grid">
            <InfoItem icon={<InfoPinIcon />} label="Address">
              {store.city ? (
                <>
                  <span data-placeholder={store.address ? undefined : 'true'}>
                    {store.address ?? COMING_SOON}
                  </span>
                  <span>{store.city}</span>
                </>
              ) : (
                <span>Online store</span>
              )}
            </InfoItem>
            <InfoItem icon={<InfoClockIcon />} label="Opening hours">
              {store.hours ? (
                store.hours.map((line) => <span key={line}>{line}</span>)
              ) : (
                <span data-placeholder="true">{COMING_SOON}</span>
              )}
            </InfoItem>
            <InfoItem icon={<InfoPhoneIcon />} label="Contact">
              {store.phone ? (
                <TrackedAnchor
                  href={`tel:${store.phone.replace(/[^\d+]/g, '')}`}
                  click={trackStore('phone', 'store_page_info')}
                >
                  {store.phone}
                </TrackedAnchor>
              ) : null}
              {store.whatsapp ? (
                <TrackedAnchor
                  href={`https://wa.me/${store.whatsapp.replace(/\D/g, '')}`}
                  click={trackStore('phone', 'store_page_whatsapp')}
                  target="_blank"
                  rel="noopener"
                >
                  WhatsApp
                </TrackedAnchor>
              ) : null}
              {!store.phone && !store.whatsapp ? (
                <span data-placeholder="true">{COMING_SOON}</span>
              ) : null}
            </InfoItem>
            <InfoItem icon={<InfoGlobeIcon />} label="Website & socials">
              {website && store.url ? (
                <TrackedAnchor
                  href={website}
                  click={trackStore('website', 'store_page_info')}
                  target="_blank"
                  rel="noopener"
                >
                  {new URL(store.url).hostname.replace(/^www\./, '')}
                </TrackedAnchor>
              ) : null}
              {store.instagram ? (
                <TrackedAnchor
                  href={store.instagram}
                  click={trackStore('social', 'store_page_info')}
                  target="_blank"
                  rel="noopener"
                >
                  Instagram
                </TrackedAnchor>
              ) : null}
              {store.facebook ? (
                <TrackedAnchor
                  href={store.facebook}
                  click={trackStore('social', 'store_page_info')}
                  target="_blank"
                  rel="noopener"
                >
                  Facebook
                </TrackedAnchor>
              ) : null}
              {!website && !store.instagram && !store.facebook ? (
                <span data-placeholder="true">{COMING_SOON}</span>
              ) : null}
            </InfoItem>
          </dl>
        </StoreSection>

        {store.offerings.length > 0 ? (
          <StoreSection title="What you'll find">
            <ul data-v3-community-indicator="store-offerings">
              {store.offerings.slice(0, 5).map((offering) => (
                <li key={offering}>
                  <OfferingIcon offering={offering} />
                  <span>{storeOfferingLabels[offering]}</span>
                </li>
              ))}
            </ul>
          </StoreSection>
        ) : null}

        <StoreSection
          id="store-events"
          title={eventsTitle}
          action={<Link href="/community/events">View all</Link>}
        >
          <div className="divide-y">
            {events.length > 0 ? (
              events.map((event) => (
                <UpcomingEventRow key={event.id} event={event} source="store_page" />
              ))
            ) : (
              <p data-v3-community-indicator="events-empty">
                No upcoming events yet. Check back soon.
              </p>
            )}
          </div>
        </StoreSection>

        <StoreSection title="Store photos">
          <ul data-v3-community-indicator="store-photos">
            {Array.from({ length: photoSlots }, (_, index) => {
              const photo = store.photos[index]
              return (
                <li key={photo ?? `placeholder-${index}`} data-placeholder={photo ? undefined : 'true'}>
                  {photo ? (
                    <Image
                      src={photo}
                      alt={`${store.name} photo ${index + 1}`}
                      fill
                      sizes="(max-width: 640px) 33vw, 150px"
                      className="object-cover"
                    />
                  ) : (
                    <span>Photo coming soon</span>
                  )}
                </li>
              )
            })}
          </ul>
        </StoreSection>
      </div>
    </main>
  )
}

function StoreSection({
  action,
  children,
  id,
  title,
}: {
  action?: React.ReactNode
  children: React.ReactNode
  id?: string
  title: string
}) {
  return (
    <section
      id={id}
      data-v3-community-indicator="section-card"
      className="scroll-mt-4 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-[10px] uppercase">{title}</h2>
        {action}
      </div>
      <div>{children}</div>
    </section>
  )
}

function InfoItem({
  children,
  icon,
  label,
}: {
  children: React.ReactNode
  icon: React.ReactNode
  label: string
}) {
  return (
    <div data-v3-community-indicator="store-info-item">
      <span data-v3-community-indicator="store-info-icon">{icon}</span>
      <div>
        <dt>{label}</dt>
        <dd>{children}</dd>
      </div>
    </div>
  )
}
