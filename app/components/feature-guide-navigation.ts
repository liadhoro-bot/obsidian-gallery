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

export function getVisibleFeatureGuideIndexes(guides: FeatureGuideEntry[]) {
  return guides.reduce<number[]>((visibleIndexes, guide, index) => {
    if (isFeatureGuideTargetVisible(guide.uid)) {
      visibleIndexes.push(index)
    }

    return visibleIndexes
  }, [])
}

export function getFeatureGuideCounter(
  guides: FeatureGuideEntry[],
  activeIndex: number | null
) {
  const visibleIndexes = getVisibleFeatureGuideIndexes(guides)

  if (!visibleIndexes.length) {
    return {
      displayIndex: activeIndex === null ? 1 : activeIndex + 1,
      totalGuides: guides.length,
    }
  }

  const visiblePosition =
    activeIndex === null ? -1 : visibleIndexes.indexOf(activeIndex)

  return {
    displayIndex:
      visiblePosition === -1
        ? Math.min(visibleIndexes.length, Math.max(1, (activeIndex ?? 0) + 1))
        : visiblePosition + 1,
    totalGuides: visibleIndexes.length,
  }
}
