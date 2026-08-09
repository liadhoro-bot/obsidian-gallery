'use client'

import { useEffect } from 'react'

type V3PerfIndicatorProps = {
  surface: string
  detail?: string
}

function getMarkName(surface: string, detail?: string) {
  return detail
    ? `v3-${surface}-${detail}-hydrated`
    : `v3-${surface}-hydrated`
}

function markV3Surface(surface: string, detail: string | undefined, markName: string) {
  if (typeof window === 'undefined') return

  try {
    performance.mark(markName)
    performance.mark('v3-surface-hydrated')
    window.dispatchEvent(
      new CustomEvent('v3:surface-hydrated', {
        detail: {
          detail,
          markName,
          surface,
          timestamp: performance.now(),
        },
      })
    )
  } catch {
    // Perf markers should never interfere with the app experience.
  }
}

export default function V3PerfIndicator({
  detail,
  surface,
}: V3PerfIndicatorProps) {
  const markName = getMarkName(surface, detail)

  useEffect(() => {
    markV3Surface(surface, detail, markName)
  }, [detail, markName, surface])

  return (
    <span
      hidden
      data-v3-perf-indicator={surface}
      data-v3-perf-detail={detail ?? ''}
      data-v3-perf-mark={markName}
    />
  )
}
