import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import {
  isLocalV3PreviewHost,
  isV3PreviewValue,
} from '../../../lib/v3-preview'

export const runtime = 'nodejs'

function getSafeNextPath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    return '/dashboard'
  }

  const nextUrl = new URL(value, 'http://local-preview.test')

  if (nextUrl.pathname === '/dashboard') {
    nextUrl.searchParams.delete('preview')
    return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
  }

  nextUrl.searchParams.set('preview', '1')

  return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
}

export async function POST(request: NextRequest) {
  if (
    process.env.NODE_ENV === 'production' ||
    !isV3PreviewValue(request.nextUrl.searchParams.get('preview')) ||
    !isLocalV3PreviewHost(request.nextUrl.host)
  ) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return NextResponse.json(
      { error: 'Local preview auth is missing Supabase environment variables.' },
      { status: 500 }
    )
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown
    next?: unknown
  } | null
  const email = typeof body?.email === 'string' ? body.email.trim() : ''
  const next = getSafeNextPath(body?.next)

  if (!email || !email.includes('@')) {
    return NextResponse.json(
      { error: 'Enter the email for the account you want to preview.' },
      { status: 400 }
    )
  }

  const adminClient = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

  if (linkError || !linkData.properties?.email_otp) {
    return NextResponse.json(
      { error: 'Could not create a local preview session for that email.' },
      { status: 401 }
    )
  }

  const response = NextResponse.json({ redirectTo: next })
  const sessionClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options)
        })
      },
    },
  })
  const { error: verifyError } = await sessionClient.auth.verifyOtp({
    email,
    token: linkData.properties.email_otp,
    type: 'email',
  })

  if (verifyError) {
    return NextResponse.json(
      { error: 'Could not finish the local preview sign-in.' },
      { status: 401 }
    )
  }

  return response
}
