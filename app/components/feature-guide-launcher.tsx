'use client'

import { useState } from 'react'
import { findVisibleFeatureGuideIndex } from './feature-guide-navigation'
import FeatureGuideTour from './feature-guide-tour'
import type { FeatureGuideEntry } from './feature-guide-types'

export default function FeatureGuideLauncher({
  buttonClassName,
  guides,
  label,
}: {
  buttonClassName?: string
  guides: FeatureGuideEntry[]
  label: string
}) {
  const [activeGuideIndex, setActiveGuideIndex] = useState<number | null>(null)
  const activeGuide =
    activeGuideIndex === null ? null : guides[activeGuideIndex] ?? null

  return (
    <>
      <button
        type="button"
        aria-expanded={activeGuide !== null}
        aria-label={label}
        className={buttonClassName}
        data-feature-guide-launcher-button="true"
        onClick={() => {
          if (guides.length) {
            setActiveGuideIndex(
              findVisibleFeatureGuideIndex(guides, null, 1) ?? 0
            )
          }
        }}
      >
        ?
      </button>

      {activeGuide ? (
        <FeatureGuideTour
          activeIndex={activeGuideIndex ?? 0}
          guide={activeGuide}
          onClose={() => setActiveGuideIndex(null)}
          onNext={() =>
            setActiveGuideIndex((current) => {
              return findVisibleFeatureGuideIndex(guides, current, 1) ?? current ?? 0
            })
          }
          onPrevious={() =>
            setActiveGuideIndex((current) => {
              return findVisibleFeatureGuideIndex(guides, current, -1) ?? current ?? 0
            })
          }
          totalGuides={guides.length}
        />
      ) : null}
    </>
  )
}
