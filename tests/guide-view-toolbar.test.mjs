import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('card viewer toolbar uses glass social and share actions without info or edit links', () => {
  const guidePage = readFileSync(new URL('../app/guides/[id]/page.tsx', import.meta.url), 'utf8')
  const deckPage = readFileSync(new URL('../app/guides/decks/[id]/page.tsx', import.meta.url), 'utf8')

  const guideViewer = guidePage.match(/heroActions=\{<>([\s\S]*?)<\/>\} \/>/)?.[1] ?? ''
  const deckToolbarStart = deckPage.indexOf('const heroActions = (')
  const deckToolbar = deckPage.slice(
    deckToolbarStart,
    deckPage.indexOf('  return (', deckToolbarStart)
  )

  assert.match(guideViewer, /<DeckHeroActions/)
  assert.match(guideViewer, /<DeckShareMenu/)
  assert.doesNotMatch(guideViewer, />Info</)
  assert.doesNotMatch(guideViewer, />Edit</)
  assert.match(deckToolbar, /<DeckHeroActions/)
  assert.match(deckToolbar, /<DeckShareMenu/)
  assert.doesNotMatch(deckToolbar, />Edit</)
})
