import { NextResponse } from 'next/server'
import { getCommunityEvent } from '../../../community/events-queries'
import type { PartnerLinkClick, PartnerLinkKind } from '../../../community/events-data'
import { getStore, storeHref } from '../../../community/stores-data'
import { captureServerEvent } from '../../../../utils/analytics/server'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'

const LINK_KINDS: PartnerLinkKind[] = [
  'event_page',
  'store_page',
  'website',
  'registration',
  'phone',
  'email',
  'social',
]

type ResolvedTarget = { name: string; destination: string | null }

// The destination comes from our own data, never from the request, so the
// log only ever holds links that are actually on the page.
async function resolveTarget(click: PartnerLinkClick): Promise<ResolvedTarget | null> {
  if (click.targetType === 'store') {
    const store = getStore(click.targetId)
    if (!store) return null
    const destinations: Partial<Record<PartnerLinkKind, string | null>> = {
      store_page: storeHref(store),
      website: store.url,
      phone: store.phone,
      social: store.instagram ?? store.facebook,
    }
    return {
      name: store.city ? `${store.name} (${store.city})` : store.name,
      destination: destinations[click.linkKind] ?? null,
    }
  }

  const event = await getCommunityEvent(click.targetId)
  if (!event) return null

  const destinations: Partial<Record<PartnerLinkKind, string | null>> = {
    event_page: `/community/events/${event.id}`,
    website: event.contactUrl,
    registration: event.contactUrl,
    phone: event.contactPhone,
    email: event.contactEmail,
  }

  return { name: event.name, destination: destinations[click.linkKind] ?? null }
}

function parseClick(value: unknown): PartnerLinkClick | null {
  if (!value || typeof value !== 'object') return null
  const { targetType, targetId, linkKind, source } = value as Record<string, unknown>

  if (targetType !== 'event' && targetType !== 'store') return null
  if (typeof targetId !== 'string' || targetId.length > 100) return null
  if (!LINK_KINDS.includes(linkKind as PartnerLinkKind)) return null
  if (typeof source !== 'string' || !/^[a-z0-9_]{1,60}$/.test(source)) return null

  return { targetType, targetId, linkKind: linkKind as PartnerLinkKind, source }
}

export async function POST(request: Request) {
  let click: PartnerLinkClick | null = null
  try {
    click = parseClick(JSON.parse(await request.text()))
  } catch {
    click = null
  }
  if (!click) return NextResponse.json({ ok: false }, { status: 400 })

  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const target = await resolveTarget(click)
  if (!target?.destination) return NextResponse.json({ ok: false }, { status: 404 })

  const { error } = await supabase.from('partner_link_clicks').insert({
    user_id: user.id,
    target_type: click.targetType,
    target_id: click.targetId,
    target_name: target.name,
    link_kind: click.linkKind,
    destination: target.destination,
    source: click.source,
  })

  if (error) {
    console.error('Failed to record partner link click', error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }

  try {
    await captureServerEvent({
      distinctId: user.id,
      event: 'partner_link_clicked',
      properties: {
        target_type: click.targetType,
        target_id: click.targetId,
        target_name: target.name,
        link_kind: click.linkKind,
        destination: target.destination,
        source: click.source,
      },
    })
  } catch (analyticsError) {
    console.error('Failed to send partner link click to PostHog', analyticsError)
  }

  return new NextResponse(null, { status: 204 })
}
