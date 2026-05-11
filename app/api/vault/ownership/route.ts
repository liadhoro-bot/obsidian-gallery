import { NextResponse } from 'next/server'
import { createClient } from '../../../../utils/supabase/server'
import { updatePaintOwnership } from '../../../../utils/paint-ownership/update-paint-ownership'

export async function POST(req: Request) {
  const body = await req.json()

  const paintId = String(body.paintId || '')
  const action = String(body.action || '') as
    | 'owned'
    | 'wishlist'
    | 'increment'
    | 'decrement'

  const currentValue =
    body.currentValue === undefined
      ? undefined
      : Boolean(body.currentValue)

  const currentUnits =
    body.currentUnits === undefined
      ? undefined
      : Number(body.currentUnits)

  if (!paintId) {
    return NextResponse.json(
      { error: 'Missing paint id' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    )
  }

  try {
    const result = await updatePaintOwnership({
      userId: user.id,
      paintCatalogId: paintId,
      action,
      currentValue,
      currentUnits,
    })

    return NextResponse.json({
      ok: true,
      ownership: result,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      },
      { status: 500 }
    )
  }
}