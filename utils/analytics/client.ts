type PostHogClient = typeof import('posthog-js').default

let posthogPromise: Promise<PostHogClient | null> | null = null

function canUsePostHog() {
  return Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY) &&
    process.env.NODE_ENV === 'production'
}

export function getPostHogClient() {
  if (!canUsePostHog()) {
    return Promise.resolve(null)
  }

  posthogPromise ??= import('posthog-js').then(({ default: posthog }) => {
    const loadedPosthog = posthog as PostHogClient & { __loaded?: boolean }

    if (!loadedPosthog.__loaded) {
      loadedPosthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '', {
        api_host:
          process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
        capture_pageview: true,
        capture_pageleave: true,
      })
    }

    return posthog
  })

  return posthogPromise
}

export async function capturePostHog(
  event: string,
  properties?: Record<string, unknown>
) {
  const posthog = await getPostHogClient()
  posthog?.capture(event, properties)
}

export async function identifyPostHog(
  distinctId: string,
  properties?: Record<string, unknown>
) {
  const posthog = await getPostHogClient()
  posthog?.identify(distinctId, properties)
}

export async function resetPostHog() {
  const posthog = await getPostHogClient()
  posthog?.reset()
}
