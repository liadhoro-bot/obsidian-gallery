import { NextResponse } from 'next/server'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'

const ISRAELI_MOBILE_PATTERN = /^0\d{8,9}$/

type CreatePaymentPayload = {
  paymentUrl?: string
  error?: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)

  if (!user?.email) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const webhookUrl = process.env.MAKE_CREATE_PAYMENT_WEBHOOK_URL
  const sharedSecret = process.env.MAKE_WEBHOOK_SHARED_SECRET

  if (!webhookUrl) {
    return NextResponse.json(
      { error: 'Payment is not configured yet (missing MAKE_CREATE_PAYMENT_WEBHOOK_URL).' },
      { status: 500 }
    )
  }

  const body = await request.json().catch(() => ({}))
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : ''
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''

  const [firstGuess, ...restGuess] = fullName.split(/\s+/).filter(Boolean)
  const firstName = firstGuess ?? ''
  const lastName = restGuess.join(' ')

  if (firstName.length < 2 || lastName.length < 2) {
    return NextResponse.json(
      { error: 'Enter your first and last name (at least 2 characters each).' },
      { status: 400 }
    )
  }

  if (!ISRAELI_MOBILE_PATTERN.test(phone)) {
    return NextResponse.json(
      { error: 'Enter a valid Israeli mobile number, e.g. 0501234567.' },
      { status: 400 }
    )
  }

  let response: Response
  try {
    response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sharedSecret ? { 'x-webhook-secret': sharedSecret } : {}),
      },
      body: JSON.stringify({
        email: user.email,
        fullName,
        firstName,
        lastName,
        phone,
      }),
    })
  } catch {
    return NextResponse.json(
      { error: 'Could not reach the payment service. Try again in a moment.' },
      { status: 502 }
    )
  }

  if (!response.ok) {
    return NextResponse.json(
      { error: 'The payment service rejected the request. Check the Make scenario run log.' },
      { status: 502 }
    )
  }

  const payload = (await response.json().catch(() => null)) as CreatePaymentPayload | null

  if (!payload?.paymentUrl) {
    return NextResponse.json(
      { error: 'The Make scenario did not return a payment link. Check its webhook response module.' },
      { status: 502 }
    )
  }

  return NextResponse.json({ paymentUrl: payload.paymentUrl })
}
