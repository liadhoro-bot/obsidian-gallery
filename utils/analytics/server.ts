import { PostHog } from 'posthog-node'

let posthogClient: PostHog | null = null

function getPostHogClient() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com'

  if (!key) return null
  if (process.env.NODE_ENV !== 'production') return null

  if (!posthogClient) {
    posthogClient = new PostHog(key, {
      host,
      flushAt: 1,
      flushInterval: 0,
    })
  }

  return posthogClient
}

export async function captureServerEvent({
  distinctId,
  event,
  properties = {},
}: {
  distinctId: string
  event: string
  properties?: Record<string, unknown>
}) {
  const client = getPostHogClient()

  if (!client) return

  client.capture({
    distinctId,
    event,
    properties,
  })

  await client.shutdown()
  posthogClient = null
}