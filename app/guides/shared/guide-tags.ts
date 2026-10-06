export const MAX_GUIDE_TAGS = 12
export const MAX_GUIDE_TAG_LENGTH = 32

export function normalizeGuideTag(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, MAX_GUIDE_TAG_LENGTH)
}

export function normalizeGuideTags(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  const unique = new Map<string, string>()
  for (const value of values) {
    if (typeof value !== 'string') continue
    const tag = normalizeGuideTag(value)
    if (tag && !unique.has(tag.toLocaleLowerCase())) unique.set(tag.toLocaleLowerCase(), tag)
    if (unique.size === MAX_GUIDE_TAGS) break
  }
  return [...unique.values()]
}
