// Browser storage can be unavailable (private mode, blocked site data), so
// every read and write here fails quietly. The server-side user_metadata flag
// is the source of truth; these keys only smooth over the current visit.

export const ONBOARDING_TOUR_SESSION_KEY = 'og.onboardingTour.session'
// Session storage clears when the app is closed, so "Remind me later" brings
// the tour back on the next visit.
export const REMIND_LATER_SESSION_KEY = 'og.onboardingTour.remindLater'
const DONE_KEY_PREFIX = 'og.onboardingTour.done'

export function readSessionValue(key: string) {
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeSessionValue(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key)
    else window.sessionStorage.setItem(key, value)
  } catch {}
}

function doneKey(userId: string | null) {
  return userId ? `${DONE_KEY_PREFIX}:${userId}` : DONE_KEY_PREFIX
}

// The auth token can carry the old user_metadata for up to an hour after the
// status is saved, so remember locally that this user already finished.
export function markOnboardingTourDone(userId: string | null) {
  try {
    window.localStorage.setItem(doneKey(userId), '1')
  } catch {}
}

export function isOnboardingTourDone(userId: string) {
  try {
    return window.localStorage.getItem(doneKey(userId)) === '1'
  } catch {
    return false
  }
}
