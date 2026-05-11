'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import { createClient } from '../../utils/supabase/client'

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

    const supabase = createClient()

    async function identifyUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const email = user.email?.toLowerCase()

        posthog.identify(user.id, {
          email,
          is_internal: getIsInternalUser(email),
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
        const email = session.user.email?.toLowerCase()

        posthog.identify(session.user.id, {
          email,
          is_internal: getIsInternalUser(email),
        })
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return null
}