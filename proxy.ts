import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  V3_PREVIEW_COOKIE,
  V3_PREVIEW_COOKIE_MAX_AGE,
  canUseV3PreviewCookie,
  canUseV3PreviewParam,
  isLocalV3PreviewHost,
  isV3DeploymentHost,
} from './lib/v3-preview'

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const hasInspectionPreviewCookie =
    request.cookies.get(V3_PREVIEW_COOKIE)?.value === '1'
  const hasInspectionPreviewParam = canUseV3PreviewParam(
    request.nextUrl.host,
    request.nextUrl.searchParams.get('preview')
  )
  const hasInspectionPreviewHost = isV3DeploymentHost(request.nextUrl.host)
  const canPersistInspectionPreview = canUseV3PreviewCookie(
    request.nextUrl.host
  )
  const isInspectionPreview =
    hasInspectionPreviewParam ||
    (canPersistInspectionPreview && hasInspectionPreviewCookie) ||
    hasInspectionPreviewHost
  const shouldClearInspectionPreviewCookie =
    hasInspectionPreviewCookie && !canPersistInspectionPreview

  const isGoldenDashboardFixture =
    pathname === '/dashboard' &&
    request.nextUrl.searchParams.get('golden') === 'dashboard-active-units'

  const isInspectionPreviewRoute =
    pathname === '/onboarding' ||
    pathname === '/projects' ||
    pathname.startsWith('/projects/') ||
    pathname === '/paints' ||
    pathname === '/guides' ||
    pathname === '/community' ||
    pathname === '/settings' ||
    pathname.startsWith('/units/')

  const finalizeResponse = (response: NextResponse) => {
    if (
      isInspectionPreviewRoute &&
      (hasInspectionPreviewParam || hasInspectionPreviewHost) &&
      canPersistInspectionPreview &&
      !hasInspectionPreviewCookie
    ) {
      response.cookies.set(V3_PREVIEW_COOKIE, '1', {
        maxAge: V3_PREVIEW_COOKIE_MAX_AGE,
        path: '/',
        sameSite: 'lax',
      })
    }

    if (shouldClearInspectionPreviewCookie) {
      response.cookies.set(V3_PREVIEW_COOKIE, '', {
        maxAge: 0,
        path: '/',
        sameSite: 'lax',
      })
    }

    return response
  }

  if (
    isGoldenDashboardFixture &&
    isLocalV3PreviewHost(request.nextUrl.host)
  ) {
    return finalizeResponse(
      NextResponse.next({
        request,
      })
    )
  }

  const isPublicRoute =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/offline' ||
    pathname === '/onboarding' ||
    pathname === '/support' ||
    pathname === '/settings/terms' ||
    pathname === '/contests/dice-roll' ||
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

  const shouldRequireAuthenticatedPreview =
    isInspectionPreview && isInspectionPreviewRoute && pathname !== '/onboarding'
  const shouldCheckSession =
    !isPublicRoute || pathname === '/onboarding' || shouldRequireAuthenticatedPreview

  if (!shouldCheckSession) {
    return finalizeResponse(
      NextResponse.next({
        request,
      })
    )
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
    data: { user: verifiedUser },
  } = await supabase.auth.getUser()
  const activeUser = verifiedUser ?? null

  if (!activeUser) {
    if (!isPublicRoute || shouldRequireAuthenticatedPreview) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
      if (
        hasInspectionPreviewParam ||
        (canPersistInspectionPreview && hasInspectionPreviewCookie)
      ) {
        loginUrl.searchParams.set('preview', '1')
      }
      return finalizeResponse(NextResponse.redirect(loginUrl))
    }

    return finalizeResponse(response)
  }

  const [profileResult, termsAcceptanceResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('terms_accepted_at')
      .eq('id', activeUser.id)
      .maybeSingle(),
    supabase
      .from('user_terms_acceptances')
      .select('accepted_at')
      .eq('user_id', activeUser.id)
      .order('accepted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const hasAcceptedTerms = Boolean(
    profileResult.data?.terms_accepted_at ||
      termsAcceptanceResult.data?.accepted_at
  )

  if (!hasAcceptedTerms && (!isPublicRoute || shouldRequireAuthenticatedPreview)) {
    return finalizeResponse(
      NextResponse.redirect(new URL('/onboarding', request.url))
    )
  }

  return finalizeResponse(response)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)',
  ],
}
