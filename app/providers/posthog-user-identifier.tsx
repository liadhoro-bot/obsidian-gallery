'use client'

import { useEffect } from 'react'
import { identifyPostHog, resetPostHog } from '../../utils/analytics/client'

const INTERNAL_EMAILS = [
  'liadhoro@gmail.com',
]

function getIsInternalUser(email: string | undefined) {
  if (!email) return false

  return INTERNAL_EMAILS.includes(email.toLowerCase())
}

export default function PostHogUserIdentifier() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return

    let isMounted = true

    async function identifyUser() {
      const { createClient } = await import('../../utils/supabase/client')
      if (!isMounted) return

      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const email = user.email?.toLowerCase()

        identifyPostHog(user.id, {
          email,
          is_internal: getIsInternalUser(email),
        })
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
          resetPostHog()
          return
        }

        if (session?.user) {
          const email = session.user.email?.toLowerCase()

          identifyPostHog(session.user.id, {
            email,
            is_internal: getIsInternalUser(email),
          })
        }
      })

      return subscription
    }

    const subscriptionPromise = identifyUser()

    return () => {
      isMounted = false
      subscriptionPromise.then((subscription) => subscription?.unsubscribe())
    }
  }, [])

  return null
}
