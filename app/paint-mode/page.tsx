import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import { createPerfTimer } from '../../utils/perf/server'
import { hasV3PreviewSession } from '../../lib/v3-preview-server'
import { isLocalV3PreviewHost } from '../../lib/v3-preview'
import { createPaintModeFixture } from './paint-mode-fixture'
import PaintModeScreen from './paint-mode-screen'

export const metadata: Metadata = {
  title: 'Paint Mode',
}

type PageProps = {
  searchParams: Promise<{
    unit?: string
    return?: string
    golden?: string
    guide?: string
    preview?: string
  }>
}

const fixtureNames = ['paint-mode-empty', 'paint-mode-active'] as const

// Only same-site paths; anything else falls back to the dashboard.
function safeReturnPath(value: string | undefined) {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null
}

export default async function PaintModePage({ searchParams }: PageProps) {
  const perf = createPerfTimer('/paint-mode')
  const params = await searchParams
  const isPreview = await hasV3PreviewSession(params.preview)
  const returnParam = safeReturnPath(params.return)
  const returnHref = returnParam ?? (isPreview ? '/dashboard?preview=1' : '/dashboard')
  const basePath = isPreview ? '/paint-mode?preview=1' : '/paint-mode'

  const headerStore = await headers()
  const fixtureName = fixtureNames.find((name) => name === params.golden)
  if (fixtureName && isLocalV3PreviewHost(headerStore.get('host'))) {
    // Signed in: the sample unit carries one of your real guides (?guide=<id>
    // picks it), so Open Guide and the swatches show real cards and hues.
    const supabase = await createClient()
    const user = await getSessionUser(supabase)
    const { loadFixtureGuideDeck } = await import('./paint-mode-fixture-data')
    const fixtureDeck = user ? await loadFixtureGuideDeck(user.id, params.guide ?? null) : null
    perf.total()
    return (
      <PaintModeScreen
        initialModel={createPaintModeFixture(fixtureName, fixtureDeck)}
        fixtureDeck={fixtureDeck}
        mode="fixture"
        returnHref={returnHref}
        returnParam={returnParam}
        renderedAt={Date.now()}
        basePath={`${basePath}${basePath.includes('?') ? '&' : '?'}golden=${fixtureName}`}
      />
    )
  }

  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) {
    const nextPath = `/paint-mode${isPreview ? '?preview=1' : ''}`
    redirect(`/login?next=${encodeURIComponent(nextPath)}${isPreview ? '&preview=1' : ''}`)
  }

  const { getPaintModeViewModel } = await import('./paint-mode-data')
  const model = await perf.measure('paint mode data', () =>
    getPaintModeViewModel(user.id, params.unit ?? null)
  )
  perf.total()

  return (
    <PaintModeScreen
      initialModel={model}
      mode="live"
      returnHref={returnHref}
      returnParam={returnParam}
      renderedAt={Date.now()}
      basePath={basePath}
    />
  )
}
