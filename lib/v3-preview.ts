export const V3_PREVIEW_COOKIE = 'obsidian_v3_preview'
export const V3_PREVIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 14

export function isV3PreviewValue(value: string | null | undefined) {
  return value === '1' || value === 'true'
}

export function isV3DeploymentHost(host: string | null | undefined) {
  const hostname = host?.split(':')[0]?.toLowerCase()

  if (!hostname) {
    return false
  }

  return (
    hostname === 'obsidian-gallery-v3.vercel.app' ||
    (hostname.startsWith('obsidian-gallery-v3-') &&
      hostname.endsWith('.vercel.app'))
  )
}

export function isLocalV3PreviewHost(host: string | null | undefined) {
  const hostname = host?.split(':')[0]?.toLowerCase()

  if (!hostname) {
    return false
  }

  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  )
}

export function canUseV3PreviewCookie(host: string | null | undefined) {
  return isV3DeploymentHost(host) || isLocalV3PreviewHost(host)
}

export function canUseV3PreviewParam(
  host: string | null | undefined,
  value: string | null | undefined
) {
  return isV3PreviewValue(value) && canUseV3PreviewCookie(host)
}

export function ensureV3PreviewPath(value: string | null | undefined) {
  const fallback = '/dashboard?preview=1'

  if (!value?.startsWith('/')) {
    return fallback
  }

  const url = new URL(value, 'https://obsidian-gallery-v3.vercel.app')
  url.searchParams.set('preview', '1')

  return `${url.pathname}${url.search}${url.hash}`
}

export function getV3PreviewCookie() {
  return `${V3_PREVIEW_COOKIE}=1; Path=/; Max-Age=${V3_PREVIEW_COOKIE_MAX_AGE}; SameSite=Lax`
}

export function hasV3PreviewDocumentCookie(cookieValue: string) {
  return cookieValue
    .split(';')
    .some((entry) => entry.trim() === `${V3_PREVIEW_COOKIE}=1`)
}

export function hasV3PreviewDocumentSession(
  cookieValue: string,
  host: string | null | undefined
) {
  return canUseV3PreviewCookie(host) && hasV3PreviewDocumentCookie(cookieValue)
}
