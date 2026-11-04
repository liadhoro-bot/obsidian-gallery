import assert from 'node:assert/strict'
import test from 'node:test'
import { withoutImagesUsedByGuides } from '../utils/images/guide-image-references'

function fakeSupabase(usedByTable: Record<string, string[]>, seen: string[] = []) {
  return {
    from(table: string) {
      seen.push(table)
      return {
        select: () => ({
          eq: () => ({
            in: async (_column: string, urls: string[]) => ({
              data: (usedByTable[table] ?? []).filter((url) => urls.includes(url)).map((image_url) => ({ image_url })),
              error: null,
            }),
          }),
        }),
      }
    },
  } as never
}

test('a unit photo a guide still shows stays out of the removal list', async () => {
  const images = [
    { id: 'cover', image_url: 'cover.jpg' },
    { id: 'card', image_url: 'card.jpg' },
    { id: 'free', image_url: 'free.jpg' },
    { id: 'no-url', image_url: null },
  ]
  const removable = await withoutImagesUsedByGuides(
    fakeSupabase({ recipes: ['cover.jpg'], recipe_steps: ['card.jpg'] }),
    'user',
    images
  )
  assert.deepEqual(removable.map((image) => image.id), ['free', 'no-url'])
})

test('nothing to check means no queries', async () => {
  const seen: string[] = []
  assert.deepEqual(await withoutImagesUsedByGuides(fakeSupabase({}, seen), 'user', []), [])
  assert.deepEqual(seen, [])
})

test('a query error stops the removal instead of risking a guide image', async () => {
  const failing = {
    from: () => ({
      select: () => ({ eq: () => ({ in: async () => ({ data: null, error: new Error('down') }) }) }),
    }),
  } as never
  await assert.rejects(withoutImagesUsedByGuides(failing, 'user', [{ image_url: 'a.jpg' }]), /down/)
})
