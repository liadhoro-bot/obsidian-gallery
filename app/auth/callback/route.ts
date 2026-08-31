import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import {
  ensureV3PreviewPath,
  isV3DeploymentHost,
  isV3PreviewValue,
} from '../../../lib/v3-preview'
import {
  getDashboardOnboardingRequirement,
  getOnboardingRedirectPath,
} from '../../../lib/onboarding/dashboard-entry-guard'
import { createClient } from '../../../utils/supabase/server'

const emailOtpTypes = new Set<EmailOtpType>([
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

function getOtpType(value: string | null): EmailOtpType {
  if (value && emailOtpTypes.has(value as EmailOtpType)) {
    return value as EmailOtpType
  }

  return 'email'
}

function getSafeReason(value: string | null) {
  if (!value) {
    return null
  }

  const normalized = value.replace(/\s+/g, ' ')

  if (/pkce code verifier not found/i.test(normalized)) {
    return 'That Google sign-in was opened from a different browser or stale tab. Start a fresh sign-in from this tab.'
  }

  return normalized.slice(0, 180)
}

function isDashboardNextWithoutPreview(value: string) {
  try {
    const nextUrl = new URL(value, 'https://obsidian-gallery-v3.vercel.app')
    return (
      nextUrl.pathname === '/dashboard' &&
      !isV3PreviewValue(nextUrl.searchParams.get('preview'))
    )
  } catch {
    return value === '/dashboard' || value.startsWith('/dashboard?')
  }
}

function getDashboardLaunchPath(value: string) {
  try {
    const nextUrl = new URL(value, 'https://obsidian-gallery-v3.vercel.app')

    if (nextUrl.pathname !== '/dashboard') {
      return null
    }

    nextUrl.searchParams.delete('preview')
    return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
  } catch {
    return value === '/dashboard' || value.startsWith('/dashboard?')
      ? '/dashboard'
      : null
  }
}

function getRequestedPreviewPath(value: string) {
  try {
    const nextUrl = new URL(value, 'https://obsidian-gallery-v3.vercel.app')

    if (!isV3PreviewValue(nextUrl.searchParams.get('preview'))) {
      return null
    }

    return ensureV3PreviewPath(value)
  } catch {
    return null
  }
}

function shouldForceV3PreviewPath(requestUrl: URL, next: string) {
  if (isV3PreviewValue(requestUrl.searchParams.get('preview'))) {
    return true
  }

  if (!isV3DeploymentHost(requestUrl.host)) {
    return false
  }

  return !isDashboardNextWithoutPreview(next)
}

function getCallbackNextPath(requestUrl: URL, requestedNext: string) {
  const requestedPreviewPath = getRequestedPreviewPath(requestedNext)

  if (requestedPreviewPath) {
    return requestedPreviewPath
  }

  const dashboardLaunchPath = getDashboardLaunchPath(requestedNext)

  if (dashboardLaunchPath) {
    return dashboardLaunchPath
  }

  return shouldForceV3PreviewPath(requestUrl, requestedNext)
    ? ensureV3PreviewPath(requestedNext)
    : requestedNext
}

function isDashboardDestination(value: string) {
  try {
    return new URL(value, 'https://obsidian-gallery-v3.vercel.app').pathname === '/dashboard'
  } catch {
    return value === '/dashboard' || value.startsWith('/dashboard?')
  }
}

function getLoginErrorUrl(requestUrl: URL, reason: string | null, next: string) {
  const loginUrl = new URL('/login', requestUrl.origin)
  const loginNext = getCallbackNextPath(requestUrl, next)

  loginUrl.searchParams.set('error', 'auth-callback')

  if (loginNext !== '/dashboard') {
    loginUrl.searchParams.set('next', loginNext)
  }

  try {
    const nextUrl = new URL(loginNext, requestUrl.origin)

    if (isV3PreviewValue(nextUrl.searchParams.get('preview'))) {
      loginUrl.searchParams.set('preview', '1')
    }
  } catch {
    // Keep the generic login fallback if the next value cannot be parsed.
  }

  if (reason) {
    loginUrl.searchParams.set('reason', reason)
  }

  return loginUrl
}

export async function GET(request: NextRequest) {
  const requestUrl = request.nextUrl.clone()
  const requestedNext = safeNextPath(requestUrl.searchParams.get('next'))
  const next = getCallbackNextPath(requestUrl, requestedNext)
  const providerError =
    requestUrl.searchParams.get('error_description') ??
    requestUrl.searchParams.get('error_code') ??
    requestUrl.searchParams.get('error')

  if (providerError) {
    return NextResponse.redirect(
      getLoginErrorUrl(requestUrl, getSafeReason(providerError), next)
    )
  }

  const code = requestUrl.searchParams.get('code')
  const tokenHash =
    requestUrl.searchParams.get('token_hash') ??
    requestUrl.searchParams.get('token_hash_email') ??
    requestUrl.searchParams.get('token')

  if (!code && !tokenHash) {
    return NextResponse.redirect(
      getLoginErrorUrl(
        requestUrl,
        'No auth code or token was returned.',
        next
      )
    )
  }

  const supabase = await createClient()
  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash!,
        type: getOtpType(requestUrl.searchParams.get('type')),
      })

  if (result.error) {
    return NextResponse.redirect(
      getLoginErrorUrl(requestUrl, getSafeReason(result.error.message), next)
    )
  }

  if (isDashboardDestination(next)) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const onboarding = await getDashboardOnboardingRequirement(
        user.id,
        user.user_metadata
      )

      if (onboarding.needsOnboarding && onboarding.reason) {
        return NextResponse.redirect(
          new URL(
            getOnboardingRedirectPath({
              preview: isV3PreviewValue(new URL(next, requestUrl.origin).searchParams.get('preview')),
              reason: onboarding.reason,
            }),
            requestUrl.origin
          )
        )
      }
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin))
}
