'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import { createClient } from '../../utils/supabase/client'

export default function PostHogUserIdentifier() {
  useEffect(() => {
    const supabase = createClient()

    async function identifyUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        posthog.identify(user.id, {
          email: user.email,
        })
      }
    }

    identifyUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        posthog.reset()
        return
      }

      if (session?.user) {
        posthog.identify(session.user.id, {
          email: session.user.email,
        })
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return null
}