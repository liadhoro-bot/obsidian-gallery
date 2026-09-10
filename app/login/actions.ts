'use server'

import { redirect } from 'next/navigation'
import { isV3PreviewValue } from '../../lib/v3-preview'
import { createClient } from '../../utils/supabase/server'
import { captureServerEvent } from '../../utils/analytics/server'

function safeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    return '/dashboard'
  }

  return value
}

export async function signOutFromLogin(formData: FormData) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  await supabase.auth.signOut()

  if (user) {
    await captureServerEvent({
      distinctId: user.id,
      event: 'user_signed_out',
      properties: {
        source: 'login_page',
      },
    })
  }

  const params = new URLSearchParams()
  const nextPath = safeNextPath(formData.get('next'))
  const preview = formData.get('preview')

  if (nextPath !== '/dashboard') {
    params.set('next', nextPath)
  }

  if (isV3PreviewValue(typeof preview === 'string' ? preview : undefined)) {
    params.set('preview', '1')
  }

  const query = params.toString()

  redirect(query ? `/login?${query}` : '/login')
}
