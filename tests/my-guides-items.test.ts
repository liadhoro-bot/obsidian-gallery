import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMyGuidesItems } from '../app/guides/shared/my-guides-items'

const guide = (id: string, createdAt: string, extra: { mirrorsDeckId?: string; likeCount?: number } = {}) =>
  ({ id, title: id, createdAt, likeCount: extra.likeCount ?? 0, saveCount: 0, mirrorsDeckId: extra.mirrorsDeckId })
const deck = (id: string, createdAt: string, likeCount = 0) => ({ id, title: id, createdAt, likeCount, saveCount: 0 })

test('every deck is listed once and untouched auto-guides of listed decks are dropped', () => {
  const items = buildMyGuidesItems(
    [guide('composed', '2026-10-03'), guide('auto-a', '2026-10-02', { mirrorsDeckId: 'a' }), guide('auto-missing', '2026-10-01', { mirrorsDeckId: 'not-listed' })],
    [deck('a', '2026-10-04'), deck('b', '2026-10-05')],
    'new-old'
  )
  assert.deepEqual(items.map(item => item.key), ['deck:b', 'deck:a', 'guide:composed', 'guide:auto-missing'])
})

test('guides and decks sort together', () => {
  const items = buildMyGuidesItems([guide('g', '2026-10-01', { likeCount: 2 })], [deck('d', '2026-10-02', 5)], 'popularity')
  assert.deepEqual(items.map(item => item.key), ['deck:d', 'guide:g'])
  assert.deepEqual(buildMyGuidesItems([guide('b', '1')], [deck('a', '2')], 'name-asc').map(item => item.key), ['deck:a', 'guide:b'])
})
