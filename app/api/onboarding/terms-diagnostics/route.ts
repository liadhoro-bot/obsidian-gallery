import { NextResponse } from 'next/server'
import { captureServerEvent } from '../../../../utils/analytics/server'
import { createClient } from '../../../../utils/supabase/server'

type TermsDiagnosticPayload = {
  diagnosticId?: string
  event?: string
  message?: string
  details?: Record<string, unknown>
}

export async function POST(request: Request) {
  let payload: TermsDiagnosticPayload = {}

  try {
    payload = (await request.json()) as TermsDiagnosticPayload
  } catch {
    payload = {}
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const diagnosticId = payload.diagnosticId || `terms-client-${Date.now()}`

  console.info('[terms-acceptance-client]', diagnosticId, {
    event: payload.event ?? 'unknown',
    message: payload.message ?? null,
    details: payload.details ?? null,
    userId: user?.id ?? null,
  })

  if (user) {
    try {
      await captureServerEvent({
        distinctId: user.id,
        event: 'terms_acceptance_client_diagnostic',
        properties: {
          diagnostic_id: diagnosticId,
          client_event: payload.event ?? 'unknown',
          message: payload.message ?? null,
          details: payload.details ?? null,
        },
      })
    } catch (analyticsError) {
      console.error(
        '[terms-acceptance-client]',
        diagnosticId,
        'analytics.capture',
        analyticsError
      )
    }
  }

  return NextResponse.json({ ok: true, diagnosticId })
}
