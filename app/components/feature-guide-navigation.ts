import type { FeatureGuideEntry } from './feature-guide-types'

function getFeatureGuideTarget(uid: string) {
  if (typeof document === 'undefined') return null

  return document.querySelector<HTMLElement>(
    `[data-feature-guide-target="${uid}"]`
  )
}

export function isFeatureGuideTargetVisible(uid: string) {
  const target = getFeatureGuideTarget(uid)
  if (!target) return false

  if (target.closest('[hidden], [aria-hidden="true"]')) return false

  const rect = target.getBoundingClientRect()
  const style = window.getComputedStyle(target)

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  )
}

export function findVisibleFeatureGuideIndex(
  guides: FeatureGuideEntry[],
  currentIndex: number | null,
  direction: 1 | -1
) {
  if (!guides.length) return null

  const startIndex = currentIndex ?? (direction === 1 ? -1 : guides.length)

  for (
    let index = startIndex + direction;
    index >= 0 && index < guides.length;
    index += direction
  ) {
    if (isFeatureGuideTargetVisible(guides[index].uid)) {
      return index
    }
  }

  return currentIndex
}
