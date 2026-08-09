import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  V3_PREVIEW_COOKIE,
  V3_PREVIEW_COOKIE_MAX_AGE,
  isV3DeploymentHost,
  isV3PreviewValue,
} from './lib/v3-preview'

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const hasInspectionPreviewCookie =
    request.cookies.get(V3_PREVIEW_COOKIE)?.value === '1'
  const hasInspectionPreviewParam = isV3PreviewValue(
    request.nextUrl.searchParams.get('preview')
  )
  const hasInspectionPreviewHost = isV3DeploymentHost(request.nextUrl.host)
  const isInspectionPreview =
    hasInspectionPreviewParam ||
    hasInspectionPreviewCookie ||
    hasInspectionPreviewHost

  const isGoldenDashboardFixture =
    process.env.NODE_ENV !== 'production' &&
    pathname === '/dashboard' &&
    request.nextUrl.searchParams.get('golden') === 'dashboard-active-units'

  if (isGoldenDashboardFixture) {
    return NextResponse.next({
      request,
    })
  }

  const isInspectionPreviewRoute =
    pathname === '/onboarding' ||
    pathname === '/projects' ||
    pathname.startsWith('/projects/') ||
    pathname === '/paints' ||
    pathname === '/guides' ||
    pathname === '/community' ||
    pathname === '/settings' ||
    pathname.startsWith('/units/')

  if (isInspectionPreview && isInspectionPreviewRoute) {
    const response = NextResponse.next({
      request,
    })

    if (
      (hasInspectionPreviewParam || hasInspectionPreviewHost) &&
      !hasInspectionPreviewCookie
    ) {
      response.cookies.set(V3_PREVIEW_COOKIE, '1', {
        maxAge: V3_PREVIEW_COOKIE_MAX_AGE,
        path: '/',
        sameSite: 'lax',
      })
    }

    return response
  }

  const isPublicRoute =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/offline' ||
    pathname === '/onboarding' ||
    pathname === '/support' ||
    pathname === '/settings/terms' ||
    pathname === '/guides' ||
    pathname.startsWith('/guides/') ||
    pathname === '/recipes' ||
    pathname.startsWith('/recipes/') ||
    pathname === '/paints' ||
    pathname.startsWith('/paints/') ||
    pathname === '/themes' ||
    pathname.startsWith('/themes/') ||
    pathname === '/api/vault/paint-equivalencies' ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/legal') ||
    pathname.includes('.')

  const shouldCheckSession = !isPublicRoute || pathname === '/onboarding'

  if (!shouldCheckSession) {
    return NextResponse.next({
      request,
    })
  }

  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )

          response = NextResponse.next({
            request,
          })

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user ?? null

  if (!user) {
    if (!isPublicRoute) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
      if (isInspectionPreview) {
        loginUrl.searchParams.set('preview', '1')
      }
      return NextResponse.redirect(loginUrl)
    }

    return response
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('terms_accepted_at')
    .eq('id', user.id)
    .maybeSingle()

  const hasAcceptedTerms = Boolean(profile?.terms_accepted_at)

  if (!hasAcceptedTerms && !isPublicRoute) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)',
  ],
}
