import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { headers } from 'next/headers'
import {
  FORWARDED_USER_HEADER,
  parseForwardedUser,
} from '../../lib/auth/forwarded-user'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // ignored in server components
          }
        },
      },
    }
  )
}

export async function getSessionUser(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  // The proxy has already verified protected requests with Supabase. Reuse
  // that result rather than making the page perform the same network call.
  const forwardedUser = parseForwardedUser(
    (await headers()).get(FORWARDED_USER_HEADER)
  )
  if (forwardedUser) return forwardedUser

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error) {
    return null
  }

  return user ?? null
}

export async function getSessionAccessToken(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()

  if (error) {
    return null
  }

  return session?.access_token ?? null
}
