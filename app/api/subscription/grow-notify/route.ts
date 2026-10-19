import { NextResponse } from 'next/server'
import { recordMonthlyPayment } from '../../../../lib/subscription/billing'

// Called by the Make scenario "OG - Monthly Payment Notify" after it has
// approved a Grow transaction. Grow fires a notification on the first
// charge and on every monthly re-charge of the direct debit.

function asText(value: unknown) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text ? text : null
}

export async function POST(request: Request) {
  const sharedSecret = process.env.MAKE_WEBHOOK_SHARED_SECRET
  if (!sharedSecret || request.headers.get('x-webhook-secret') !== sharedSecret) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const transactionId = asText(body.transactionId)
  // cField1 carries the signed-in email from create-payment; payerEmail is
  // whatever the customer typed on Grow's page, so it is only a fallback.
  const email = asText(body.cField1) ?? asText(body.payerEmail)

  if (!transactionId || !email) {
    return NextResponse.json(
      { error: 'Missing transactionId or email.' },
      { status: 400 }
    )
  }

  const sum = Number.parseFloat(String(body.sum ?? ''))

  try {
    const result = await recordMonthlyPayment({
      transactionId,
      transactionToken: asText(body.transactionToken),
      asmachta: asText(body.asmachta),
      email,
      fullName: asText(body.fullName),
      phone: asText(body.payerPhone),
      sum: Number.isFinite(sum) ? sum : null,
      raw: body,
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[grow-notify] failed', error)
    // A non-2xx makes the Make run fail visibly so it can be replayed.
    return NextResponse.json({ error: 'Could not record payment.' }, { status: 500 })
  }
}
