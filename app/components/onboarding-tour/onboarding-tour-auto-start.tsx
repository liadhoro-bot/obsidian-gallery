'use client'

import { useEffect } from 'react'
import { startOnboardingTour } from './tour-events'
import {
  isOnboardingTourDone,
  ONBOARDING_TOUR_SESSION_KEY,
  readSessionValue,
  REMIND_LATER_SESSION_KEY,
  writeSessionValue,
} from './tour-storage'

// Accounts that existed before the tour shipped never see it pop up on their
// own; they can still open it from any page's ? tour.
const AUTO_START_FOR_ACCOUNTS_CREATED_SINCE = '2026-10-13T00:00:00Z'

export default function OnboardingTourAutoStart({
  createdAt,
  status,
  testRun = false,
  userId,
}: {
  createdAt: string | undefined
  status: unknown
  testRun?: boolean
  userId: string
}) {
  useEffect(() => {
    if (testRun) {
      // Replay the first-sign-in flow from scratch, whatever this account's state.
      writeSessionValue(REMIND_LATER_SESSION_KEY, null)
      writeSessionValue(ONBOARDING_TOUR_SESSION_KEY, null)
      const timer = window.setTimeout(
        () => startOnboardingTour({ automatic: true, test: true, userId }),
        600
      )
      return () => window.clearTimeout(timer)
    }

    if (status === 'completed' || status === 'skipped') return
    if (!createdAt || createdAt < AUTO_START_FOR_ACCOUNTS_CREATED_SINCE) return
    if (isOnboardingTourDone(userId)) return
    if (readSessionValue(REMIND_LATER_SESSION_KEY)) return
    if (readSessionValue(ONBOARDING_TOUR_SESSION_KEY)) return

    // Let the tour host mount and the dashboard paint before opening.
    const timer = window.setTimeout(
      () => startOnboardingTour({ automatic: true, userId }),
      600
    )
    return () => window.clearTimeout(timer)
  }, [createdAt, status, testRun, userId])

  return null
}
