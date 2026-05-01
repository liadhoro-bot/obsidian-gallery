'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host =
      process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com'

    if (!key) return

    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
      capture_pageleave: true,
    })
  }, [])

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}