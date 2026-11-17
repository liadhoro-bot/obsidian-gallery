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
import { isPublicNewsPath } from './lib/news/public-path'
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

  // Pages a signed-out visitor may open (and the only pages whose Server
  // Actions run without a session). Share links (/s/) are the public way
  // into content; everything else needs a signed-in account.
  const isSignedOutPage =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/offline' ||
    pathname === '/onboarding' ||
    pathname === '/payment-success' ||
    pathname === '/support' ||
    pathname === '/settings/terms' ||
    pathname === '/contests/dice-roll'
  // Server Actions can be POSTed to any path, not just the page that renders
  // them. Only the signed-out pages above may run them without a session, so a share
  // page or API path can't be used to reach the rest of the app's actions.
  const isServerActionRequest =
    request.method === 'POST' && request.headers.has('next-action')
  const isStaticAsset =
    /\.(?:ico|png|jpe?g|gif|webp|avif|svg|js|css|map|json|webmanifest|txt|xml|pdf|woff2?|ttf|otf|mp4|webm)$/i.test(
      pathname
    )

  const isContestCreatorPage = /^\/contests\/[^/]+\/creators\/[0-9a-f-]{36}\/?$/i.test(pathname)
  const isPublicRoute = isServerActionRequest
    ? isSignedOutPage
    : isSignedOutPage ||
    pathname.startsWith('/s/') ||
    // News is free to read and shareable. It runs no Server Actions.
    isPublicNewsPath(pathname) ||
    // Contest creator pages are shareable like /s/ links: visitors get a
    // read-only page with a login dialog. Voting (a Server Action) still
    // needs a session, since only the pages above run actions signed out.
    isContestCreatorPage ||
    pathname === '/api/onboarding/terms-diagnostics' ||
    pathname === '/api/vault/paint-equivalencies' ||
    pathname === '/api/youtube-oembed' ||
    // The news scheduler has no session; the route checks its own secret.
    pathname === '/api/news/ingest' ||
    // Renders cards the caller already has on screen (public share pages
    // included) to PDF/PNG; it reads no data of its own.
    pathname === '/api/export/cards' ||
    // Serves allow-listed public storage swatches only. Must stay public:
    // next/image fetches it without the visitor's cookies.
    pathname === '/api/paints/v3-swatch' ||
    pathname.startsWith('/api/subscription/') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/legal') ||
    // Real file extensions only. A bare "contains a dot" check made any
    // dynamic route public when its param had a dot in it.
    isStaticAsset

  const shouldRequireAuthenticatedPreview =
    isInspectionPreview && isInspectionPreviewRoute && pathname !== '/onboarding'
  const shouldCheckSession =
    !isPublicRoute ||
    pathname === '/onboarding' ||
    // Signed-in voters need a refreshed session here: the page's vote is a
    // Server Action, and a session the page refreshed but couldn't save
    // would leave that POST signed out.
    isContestCreatorPage ||
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

  // Signed-in users finish onboarding before a creator page too, since
  // voting from it requires accepted terms.
  if (!hasAcceptedTerms && (!isPublicRoute || shouldRequireAuthenticatedPreview || isContestCreatorPage)) {
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
