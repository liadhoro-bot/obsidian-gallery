import { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import {
  V3_PREVIEW_COOKIE,
  V3_PREVIEW_COOKIE_MAX_AGE,
  canUseV3PreviewCookie,
  canUseV3PreviewParam,
  isLocalV3PreviewHost,
  isV3DeploymentHost,
} from './lib/v3-preview'
import {
  getCachedAccessState,
  getCachedSubscriptionStatus,
  hasAppAccess,
  isSubscriptionGateEnabled,
} from './lib/subscription/subscription-guard'
import { isPricingV2Active } from './lib/subscription/pricing'
import {
  FORWARDED_USER_HEADER,
  serializeForwardedUser,
} from './lib/auth/forwarded-user'

const TERMS_VERSION = '2026-05-13'
const TERMS_ACCEPTANCE_COOKIE = 'og_terms_acceptance'

type TermsAuthMetadata = {
  terms_accepted_at?: string | null
}

function hasAcceptedTermsCookie(
  cookieValue: string | undefined,
  userId: string
) {
  if (!cookieValue) {
    return false
  }

  const [acceptedUserId, termsVersion, acceptedAt] = cookieValue.split('|')

  return Boolean(
    acceptedUserId === userId &&
      termsVersion === TERMS_VERSION &&
      acceptedAt &&
      !Number.isNaN(new Date(acceptedAt).getTime())
  )
}

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const forwardedRequestHeaders = new Headers(request.headers)
  // Never trust a value supplied by the browser. Only this proxy may attach
  // the verified identity consumed by Server Components and route handlers.
  forwardedRequestHeaders.delete(FORWARDED_USER_HEADER)
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
        request: { headers: forwardedRequestHeaders },
      })
    )
  }

  const isPublicRoute =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/offline' ||
    pathname === '/onboarding' ||
    pathname === '/subscribe' ||
    pathname === '/payment-success' ||
    pathname === '/trial' ||
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
    pathname === '/api/onboarding/terms-diagnostics' ||
    pathname === '/api/vault/paint-equivalencies' ||
    pathname === '/api/youtube-oembed' ||
    pathname.startsWith('/api/subscription/') ||
    pathname.startsWith('/api/trial/') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/legal') ||
    pathname.includes('.')

  const shouldRequireAuthenticatedPreview =
    isInspectionPreview && isInspectionPreviewRoute && pathname !== '/onboarding'
  const shouldCheckSession =
    !isPublicRoute ||
    pathname === '/onboarding' ||
    pathname === '/subscribe' ||
    pathname === '/trial' ||
    shouldRequireAuthenticatedPreview

  if (!shouldCheckSession) {
    return finalizeResponse(
      NextResponse.next({
        request: { headers: forwardedRequestHeaders },
      })
    )
  }

  let response = NextResponse.next({
    request: { headers: forwardedRequestHeaders },
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
            request: { headers: forwardedRequestHeaders },
          })

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getClaims() verifies the JWT locally against the project's cached
  // asymmetric signing keys (ES256) instead of a Supabase Auth round-trip on
  // every navigation and prefetch. The JWT carries no created_at, so pages
  // that need it fetch it themselves.
  const { data: claimsData } = await supabase.auth.getClaims()
  const claims = claimsData?.claims
  const activeUser: User | null = claims?.sub
    ? ({
        id: claims.sub,
        email: claims.email,
        created_at: '',
        user_metadata: claims.user_metadata ?? {},
        app_metadata: claims.app_metadata ?? {},
        aud: 'authenticated',
      } as User)
    : null

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

  forwardedRequestHeaders.set(
    FORWARDED_USER_HEADER,
    serializeForwardedUser(activeUser)
  )
  const refreshedCookies = response.cookies.getAll()
  response = NextResponse.next({
    request: { headers: forwardedRequestHeaders },
  })
  refreshedCookies.forEach(({ name, value, ...options }) => {
    response.cookies.set(name, value, options)
  })

  const hasTrustedTermsSignal = Boolean(
    (activeUser.user_metadata as TermsAuthMetadata | null)?.terms_accepted_at ||
      hasAcceptedTermsCookie(
        request.cookies.get(TERMS_ACCEPTANCE_COOKIE)?.value,
        activeUser.id
      )
  )
  const profileResult = hasTrustedTermsSignal
    ? null
    : await supabase
        .from('profiles')
        .select('terms_accepted_at')
        .eq('id', activeUser.id)
        .maybeSingle()
  const hasAcceptedTerms =
    hasTrustedTermsSignal || Boolean(profileResult?.data?.terms_accepted_at)

  if (!hasAcceptedTerms && (!isPublicRoute || shouldRequireAuthenticatedPreview)) {
    return finalizeResponse(
      NextResponse.redirect(new URL('/onboarding', request.url))
    )
  }

  // Payment gate: runs after the terms check so a brand-new user finishes
  // onboarding basics first, then gets sent to pay. Disabled by default
  // (SUBSCRIPTION_REQUIRED unset/false) so this has zero effect until you
  // flip it on in Vercel's environment variables once Make/Grow are wired
  // up and tested. /subscribe, /payment-success and /api/subscription/*
  // are all in isPublicRoute above, so they never get caught by this check.
  //
  // After the pricing v2 cutover the gate is trial-aware instead: paid and
  // bypass users pass, users without a trial go to /trial, and users whose
  // trial has ended go to /subscribe. /trial and /api/trial/* are public too.
  if (isSubscriptionGateEnabled() && !isPublicRoute && isPricingV2Active()) {
    const access = await getCachedAccessState(activeUser)

    if (!hasAppAccess(access)) {
      const gateUrl = new URL(
        access.status === 'trial_available' ? '/trial' : '/subscribe',
        request.url
      )
      gateUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
      return finalizeResponse(NextResponse.redirect(gateUrl))
    }
  } else if (isSubscriptionGateEnabled() && !isPublicRoute) {
    const subscription = await getCachedSubscriptionStatus(activeUser.email)

    if (!subscription.isActive) {
      const subscribeUrl = new URL('/subscribe', request.url)
      subscribeUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
      return finalizeResponse(NextResponse.redirect(subscribeUrl))
    }
  }

  return finalizeResponse(response)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)',
  ],
}
