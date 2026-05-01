'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'

export function PHProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host =
      process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com'

    console.log('PH key exists:', Boolean(key))
    console.log('PH host:', host)

    if (!key) return

    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
      capture_pageleave: true,
      debug: true,
      loaded: (ph) => {
        console.log('PH loaded')
        console.log('PH config host:', ph.config.api_host)

        ph.capture('manual_provider_test_event', {
          page: window.location.pathname,
          timestamp: new Date().toISOString(),
        })
      },
    })
  }, [])

  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}