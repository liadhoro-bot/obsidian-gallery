export const V3_PREVIEW_COOKIE = 'obsidian_v3_preview'
export const V3_PREVIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 14

export function isV3PreviewValue(value: string | null | undefined) {
  return value === '1' || value === 'true'
}

export function getV3PreviewCookie() {
  return `${V3_PREVIEW_COOKIE}=1; Path=/; Max-Age=${V3_PREVIEW_COOKIE_MAX_AGE}; SameSite=Lax`
}

export function hasV3PreviewDocumentCookie(cookieValue: string) {
  return cookieValue
    .split(';')
    .some((entry) => entry.trim() === `${V3_PREVIEW_COOKIE}=1`)
}
