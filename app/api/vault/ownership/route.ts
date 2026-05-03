import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'

export async function POST(req: Request) {
  const body = await req.json()

  const paintId = String(body.paintId || '')
  const action = String(body.action || '')
  const currentValue = Boolean(body.currentValue)

  if (!paintId) {
    return NextResponse.json({ error: 'Missing paint id' }, { status: 400 })
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const updates: {
    user_id: string
    paint_catalog_id: string
    is_owned?: boolean
    is_wishlist?: boolean
    units_owned?: number
  } = {
    user_id: user.id,
    paint_catalog_id: paintId,
  }

  if (action === 'owned') {
    const nextOwned = !currentValue
    updates.is_owned = nextOwned
    updates.units_owned = nextOwned ? 1 : 0
  }

  if (action === 'wishlist') {
    updates.is_wishlist = !currentValue
  }

  const { error } = await supabase
    .from('user_paint_ownership')
    .upsert(updates, {
      onConflict: 'user_id,paint_catalog_id',
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}