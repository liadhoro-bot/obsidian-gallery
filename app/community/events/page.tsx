import { EventsPageHeader, UpcomingEventRow } from '../event-components'
import EventsCalendar from '../events-calendar'
import { getUpcomingCommunityEvents } from '../events-queries'
import styles from '../community-v3-silver.module.css'

export default async function CommunityEventsPage() {
  const events = await getUpcomingCommunityEvents()

  return (
    <main className={styles.communitySilver}>
      <div
        className="mx-auto flex w-full max-w-md flex-col gap-3 px-3 pb-28 pt-6"
        data-v3-community-indicator="content"
      >
        <EventsPageHeader
          backHref="/community"
          backLabel="Back to community"
          title="Events"
        />

        <EventsCalendar events={events} />

        <section data-v3-community-indicator="section-card" className="overflow-hidden">
          <div className="px-4 py-3">
            <h2 className="text-[10px] uppercase">Upcoming Events</h2>
          </div>
          <div className="divide-y">
            {events.length > 0 ? (
              events.map((event) => (
                <UpcomingEventRow key={event.id} event={event} source="events_list" />
              ))
            ) : (
              <p data-v3-community-indicator="events-empty">
                No upcoming events yet. Check back soon.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
