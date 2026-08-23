'use client'

import { useState } from 'react'
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
        onClick={() => {
          if (guides.length) setActiveGuideIndex(0)
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
            setActiveGuideIndex((current) =>
              current === null ? 0 : Math.min(guides.length - 1, current + 1)
            )
          }
          onPrevious={() =>
            setActiveGuideIndex((current) =>
              current === null ? 0 : Math.max(0, current - 1)
            )
          }
          totalGuides={guides.length}
        />
      ) : null}
    </>
  )
}
