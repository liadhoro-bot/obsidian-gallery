'use server'

import { createClient } from '../../../utils/supabase/server'
import { captureServerEvent } from '../../../utils/analytics/server'

export type OnboardingTourStatus = 'completed' | 'skipped'

export async function saveOnboardingTourStatus(status: OnboardingTourStatus) {
  if (status !== 'completed' && status !== 'skipped') return

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return

  await supabase.auth.updateUser({
    data: {
      ...user.user_metadata,
      onboarding_tour: status,
    },
  })

  await captureServerEvent({
    distinctId: user.id,
    event: `onboarding_tour_${status}`,
  })
}
