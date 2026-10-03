// Null means the legacy/default subtitle. An explicit empty string means
// the owner cleared the field and must remain empty through save and reload.
export function normalizeThemeSubtitle(template: string, subtitle?: string | null) {
  if (template !== 'theme' && template !== 'theme-alt') return null
  return subtitle == null ? null : subtitle.trim().slice(0, 60)
}

export function themeSubtitleText(subtitle?: string | null) {
  return subtitle == null ? 'Color Reference' : subtitle.trim()
}

export function hasUnuploadedImage(images: Array<string | null | undefined>) {
  return images.some(image => image?.startsWith('blob:') || image?.startsWith('data:'))
}
