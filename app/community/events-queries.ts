import 'server-only'
import { createClient } from '../../utils/supabase/server'
import type { CommunityEvent, CommunityEventType } from './events-data'

const EVENT_COLUMNS =
  'id, name, event_date, start_time, end_time, event_type, location_name, address, city, price, currency, description, contact_name, contact_email, contact_phone, contact_url, image_url, is_featured, store_id'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type CommunityEventRow = {
  id: string
  name: string
  event_date: string
  start_time: string
  end_time: string | null
  event_type: CommunityEventType
  location_name: string | null
  address: string | null
  city: string
  price: number | string | null
  currency: string
  description: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_url: string | null
  image_url: string | null
  store_id: string | null
  is_featured: boolean
}

function toCommunityEvent(row: CommunityEventRow): CommunityEvent {
  return {
    id: row.id,
    name: row.name,
    eventDate: row.event_date,
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time ? row.end_time.slice(0, 5) : null,
    eventType: row.event_type,
    locationName: row.location_name,
    address: row.address,
    city: row.city,
    price: row.price === null ? null : Number(row.price),
    currency: row.currency.trim(),
    description: row.description,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    contactUrl: row.contact_url,
    imageUrl: row.image_url,
    storeId: row.store_id,
    isFeatured: row.is_featured,
  }
}

// Events are listed until their calendar day ends in Israel.
function todayInIsrael() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(
    new Date()
  )
}

export async function getUpcomingCommunityEvents(): Promise<CommunityEvent[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('community_events')
    .select(EVENT_COLUMNS)
    .eq('is_published', true)
    .gte('event_date', todayInIsrael())
    .order('event_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) {
    console.error('Failed to load community events', error)
    return []
  }

  return (data as CommunityEventRow[]).map(toCommunityEvent)
}

export async function getCommunityEvent(id: string): Promise<CommunityEvent | null> {
  if (!UUID_PATTERN.test(id)) return null

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('community_events')
    .select(EVENT_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('Failed to load community event', error)
    return null
  }

  return data ? toCommunityEvent(data as CommunityEventRow) : null
}
