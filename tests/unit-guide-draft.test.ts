import assert from 'node:assert/strict'
import test from 'node:test'
import { buildUnitGuideDraft, groupUnitSourceFolders, type UnitGuidePaint, type UnitGuideSource } from '../app/guides/shared/unit-guide-draft'

const paint = (id: string, source: UnitGuidePaint['source'] = 'catalog'): UnitGuidePaint => ({
  id, source, name: `Paint ${id}`, brand: 'Brand', line: null, hex: '#123456', swatchImageUrl: null, owned: false,
})

const emptyUnit: UnitGuideSource = { name: 'Ultramarine', notes: null, images: [], palette: [], stages: [], sessionNotes: [] }

test('a unit with nothing in it still gets a cover with its name', () => {
  const draft = buildUnitGuideDraft(emptyUnit)
  assert.equal(draft.title, 'Ultramarine')
  assert.equal(draft.coverImage, null)
  assert.deepEqual(draft.cards.map((card) => card.template), ['cover'])
  assert.equal(draft.cards[0].title, 'Ultramarine')
})

test('the featured photo becomes the cover and every photo becomes a big image card', () => {
  const draft = buildUnitGuideDraft({
    ...emptyUnit,
    images: [
      { url: 'https://cdn/a.jpg', isFeatured: false, altText: 'Ultramarine' },
      { url: 'https://cdn/b.jpg', isFeatured: true, altText: 'Finished squad' },
    ],
  })
  assert.equal(draft.coverImage, 'https://cdn/b.jpg')
  assert.equal(draft.cards[0].image, 'https://cdn/b.jpg')
  const images = draft.cards.filter((card) => card.template === 'image')
  // The hero closes the guide, whatever its place in the gallery.
  assert.deepEqual(images.map((card) => card.image), ['https://cdn/a.jpg', 'https://cdn/b.jpg'])
  assert.equal(draft.cards.at(-1)?.title, 'Hero Shot')
  assert.equal(images[0].body, 'From the Ultramarine gallery.')
  assert.equal(images[1].body, 'Finished squad')
})

test('with no featured photo the first one is the cover', () => {
  const draft = buildUnitGuideDraft({
    ...emptyUnit,
    images: [{ url: 'https://cdn/a.jpg', isFeatured: false, altText: null }, { url: 'https://cdn/b.jpg', isFeatured: false, altText: null }],
  })
  assert.equal(draft.coverImage, 'https://cdn/a.jpg')
})

test('palette and stage paints land once each on one paints card, in the ids the save expects', () => {
  const draft = buildUnitGuideDraft({
    ...emptyUnit,
    palette: [paint('a'), paint('b', 'custom')],
    stages: [{ key: 'base', label: 'Base', notes: null, paints: [paint('a'), paint('c')], guideTitles: [] }],
  })
  const paintCards = draft.cards.filter((card) => card.template === 'paints')
  assert.equal(paintCards.length, 1)
  assert.deepEqual(paintCards[0].paints?.map((item) => item.id), ['catalog:a', 'custom:b', 'catalog:c'])
})

test('no paints means no paints card', () => {
  assert.equal(buildUnitGuideDraft(emptyUnit).cards.some((card) => card.template === 'paints'), false)
})

test('unit notes and session notes each become a step card', () => {
  const draft = buildUnitGuideDraft({
    ...emptyUnit,
    notes: '  Keep the blues cold.  ',
    sessionNotes: [
      { startedAt: '2026-11-03T10:00:00Z', notes: 'First coat down.' },
      { startedAt: '2026-11-04T10:00:00Z', notes: '   ' },
    ],
  })
  const steps = draft.cards.filter((card) => card.template === 'step')
  assert.deepEqual(steps.map((card) => [card.title, card.body]), [
    ['Notes', 'Keep the blues cold.'],
    ['Session Notes, 3 Nov 2026', 'First coat down.'],
  ])
})

test('only stages with something in them become step cards, each followed by its photos', () => {
  const draft = buildUnitGuideDraft({
    ...emptyUnit,
    images: [
      { url: 'https://cdn/gallery.jpg', isFeatured: true, altText: null },
      { url: 'https://cdn/base-1.jpg', isFeatured: false, altText: 'stage:base' },
      { url: 'https://cdn/base-2.jpg', isFeatured: false, altText: 'stage:base' },
      { url: 'https://cdn/old.jpg', isFeatured: false, altText: 'stage:removed' },
    ],
    stages: [
      { key: 'prep', label: 'Prep', notes: '  ', paints: [], guideTitles: [] },
      { key: 'base', label: 'Base Coat', notes: null, paints: [], guideTitles: [] },
      { key: 'detail', label: 'Details', notes: null, paints: [], guideTitles: ['Silver Armour'] },
      { key: 'edge', label: 'Edges', notes: ' Thin lines only. ', paints: [], guideTitles: ['Silver Armour'] },
    ],
  })
  assert.deepEqual(draft.cards.map((card) => card.title), [
    'Ultramarine',
    'Base Coat',
    'Base Coat Photo 1',
    'Base Coat Photo 2',
    'Details',
    'Edges',
    'Photo 1',
    'Hero Shot',
  ])
  assert.equal(draft.cards.find((card) => card.title === 'Edges')?.body, 'Thin lines only.\nGuide used: Silver Armour.')
  assert.equal(draft.cards.find((card) => card.title === 'Details')?.body, 'Guide used: Silver Armour.')
  // A photo tagged for a stage that's gone is still a photo, without the raw tag.
  const leftover = draft.cards.find((card) => card.title === 'Photo 1')
  assert.equal(leftover?.image, 'https://cdn/old.jpg')
  assert.equal(leftover?.body, 'From the Ultramarine gallery.')
  assert.equal(draft.cards.at(-1)?.image, 'https://cdn/gallery.jpg')
})

test('a hero tagged for a stage still closes the guide and is not repeated in the stage', () => {
  const draft = buildUnitGuideDraft({
    ...emptyUnit,
    images: [{ url: 'https://cdn/base.jpg', isFeatured: true, altText: 'stage:base' }],
    stages: [{ key: 'base', label: 'Base', notes: null, paints: [], guideTitles: [] }],
  })
  assert.deepEqual(draft.cards.map((card) => card.title), ['Ultramarine', 'Hero Shot'])
})

test('up to four stage paints stay on the step card', () => {
  const draft = buildUnitGuideDraft({
    ...emptyUnit,
    stages: [{ key: 'base', label: 'Base', notes: null, paints: ['a', 'b', 'c', 'd'].map((id) => paint(id)), guideTitles: [] }],
  })
  assert.equal(draft.cards.find((card) => card.title === 'Base')?.paints?.length, 4)
  assert.equal(draft.cards.some((card) => card.title === 'Paints for Base'), false)
})

test('more than four stage paints move to a Paints card right after the step card', () => {
  const draft = buildUnitGuideDraft({
    ...emptyUnit,
    images: [
      { url: 'https://cdn/hero.jpg', isFeatured: true, altText: null },
      { url: 'https://cdn/base.jpg', isFeatured: false, altText: 'stage:base' },
    ],
    stages: [{ key: 'base', label: 'Base', notes: 'Thin coats.', paints: ['a', 'b', 'c', 'd', 'e'].map((id) => paint(id)), guideTitles: [] }],
  })
  assert.deepEqual(draft.cards.map((card) => card.title), ['Ultramarine', 'Paint List', 'Base', 'Paints for Base', 'Base Photo', 'Hero Shot'])
  const step = draft.cards.find((card) => card.title === 'Base')
  assert.deepEqual(step?.paints, [])
  assert.equal(step?.body, 'Thin coats.')
  const stagePaints = draft.cards.find((card) => card.title === 'Paints for Base')
  assert.equal(stagePaints?.template, 'paints')
  assert.equal(stagePaints?.paints?.length, 5)
})

test('notes alone are enough for a stage to get a step card', () => {
  const draft = buildUnitGuideDraft({
    ...emptyUnit,
    stages: [{ key: 'prep', label: 'Prep', notes: 'Scrub the mould lines.', paints: [], guideTitles: [] }],
  })
  assert.equal(draft.cards.find((card) => card.title === 'Prep')?.body, 'Scrub the mould lines.')
})

test('units fall into project folders, standalone last, and folders borrow a thumbnail', () => {
  const folders = groupUnitSourceFolders({
    units: [
      { id: 'u1', name: 'Zed', project_id: 'p2' },
      { id: 'u2', name: 'Alpha', project_id: 'p2' },
      { id: 'u3', name: null, project_id: null },
      { id: 'u4', name: 'Linked', project_id: null },
      { id: 'u5', name: 'Orphan', project_id: 'deleted' },
    ],
    projects: [{ id: 'p1', name: 'Tyranids' }, { id: 'p2', name: 'Orks' }, { id: 'p3', name: 'Empty' }],
    links: [{ unit_id: 'u4', project_id: 'p1' }],
    unitImages: new Map([['u1', 'zed.jpg']]),
    projectImages: new Map([['p1', 'tyranids.jpg']]),
  })
  assert.deepEqual(folders.map((folder) => folder.name), ['Orks', 'Tyranids', 'Standalone units'])
  assert.deepEqual(folders[0].units.map((unit) => unit.name), ['Alpha', 'Zed'])
  assert.equal(folders[0].image, 'zed.jpg')
  assert.equal(folders[1].image, 'tyranids.jpg')
  assert.deepEqual(folders[2].units.map((unit) => unit.name), ['Orphan', 'Untitled Unit'])
  assert.equal(folders[2].image, null)
})
