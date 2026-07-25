import { NextResponse } from 'next/server'
import { createClient } from '../../../utils/supabase/server'

const emailOtpTypes = new Set([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
])

function safeNextPath(value: string | null) {
  if (!value?.startsWith('/')) {
    return '/dashboard'
  }

  return value
}

function getErrorRedirect(origin: string, next: string) {
  const loginUrl = new URL('/login', origin)
  loginUrl.searchParams.set('error', 'auth-callback')

  if (next !== '/dashboard') {
    loginUrl.searchParams.set('next', next)
  }

  return loginUrl
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)

  const code = searchParams.get('code')
  const tokenHash =
    searchParams.get('token_hash') ??
    searchParams.get('token_hash_email') ??
    searchParams.get('token')
  const rawType = searchParams.get('type') ?? 'email'
  const type = emailOtpTypes.has(rawType) ? rawType : 'email'
  const next = safeNextPath(searchParams.get('next'))
  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  if (tokenHash) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(getErrorRedirect(origin, next))
}
