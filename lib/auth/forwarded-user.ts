import type { User } from '@supabase/supabase-js'

export const FORWARDED_USER_HEADER = 'x-og-verified-user'

type ForwardedUser = Pick<User, 'id' | 'email' | 'created_at' | 'user_metadata'>

export function serializeForwardedUser(user: User) {
  return encodeURIComponent(JSON.stringify({
    id: user.id,
    email: user.email,
    created_at: user.created_at,
    user_metadata: {
      full_name: user.user_metadata?.full_name,
      terms_accepted_at: user.user_metadata?.terms_accepted_at,
    },
  } satisfies ForwardedUser))
}

export function parseForwardedUser(value: string | null): User | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<ForwardedUser>
    if (typeof parsed.id !== 'string' || !parsed.id) return null

    return {
      id: parsed.id,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
      created_at: typeof parsed.created_at === 'string' ? parsed.created_at : '',
      user_metadata:
        parsed.user_metadata && typeof parsed.user_metadata === 'object'
          ? parsed.user_metadata
          : {},
      app_metadata: {},
      aud: 'authenticated',
    } as User
  } catch {
    return null
  }
}
