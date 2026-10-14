import { readSessionValue, writeSessionValue } from './tour-storage'

export const START_ONBOARDING_TOUR_EVENT = 'og:onboarding-tour:start'

export type StartOnboardingTourDetail = {
  /** True when the tour opened itself for a first-time user. */
  automatic?: boolean
  /** A repeatable rehearsal from /dashboard?tour=test that never saves a status. */
  test?: boolean
  userId?: string
}

// The tour host loads lazily, so a start requested before it is listening
// waits in session storage until the host mounts and picks it up. (A module
// variable is not enough: the page and the lazy host can each get their own
// copy of this module.)
const PENDING_START_KEY = 'og.onboardingTour.pendingStart'

export function peekPendingOnboardingTourStart(): StartOnboardingTourDetail | null {
  const saved = readSessionValue(PENDING_START_KEY)
  if (!saved) return null
  try {
    return JSON.parse(saved) as StartOnboardingTourDetail
  } catch {
    return null
  }
}

export function clearPendingOnboardingTourStart() {
  writeSessionValue(PENDING_START_KEY, null)
}

export function startOnboardingTour(detail: StartOnboardingTourDetail = {}) {
  writeSessionValue(PENDING_START_KEY, JSON.stringify(detail))
  window.dispatchEvent(
    new CustomEvent<StartOnboardingTourDetail>(START_ONBOARDING_TOUR_EVENT, {
      detail,
    })
  )
}
