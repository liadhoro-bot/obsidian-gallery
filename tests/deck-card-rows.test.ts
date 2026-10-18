import assert from 'node:assert/strict'
import test from 'node:test'
import { deckCardPaintRows, deckCardStepFields } from '../app/guides/deck-card-rows'

test('a direct card edit becomes the step columns the deck save writes', () => {
  assert.deepEqual(deckCardStepFields({
    id: 'step-1', template: 'theme-alt', title: '  Base coat  ', body: 'Thin it down',
    image: 'https://cdn.example/photo.jpg', imageFocalX: 46.87, imageFocalY: 120,
    paintAlignment: 'right', paintVerticalAlignment: 'bottom', subtitle: '  Preparation ',
  }, 2), {
    title: 'Base coat',
    // Type B is stored without card_template and restored from its metadata.
    card_template: null,
    instructions: 'OG_DECK_CARD_META:{"template":"theme-alt","paintAlignment":"right","paintVerticalAlignment":"bottom"}\n\nThin it down',
    image_url: 'https://cdn.example/photo.jpg',
    youtube_url: null,
    image_focal_x: 47,
    image_focal_y: 100,
    subtitle: 'Preparation',
  })
})

test('empty text falls back, unsafe images drop and only video cards keep a YouTube link', () => {
  const step = deckCardStepFields({ template: 'step', title: ' ', body: '', image: 'blob:http://localhost/abc', videoUrl: 'https://youtu.be/x', subtitle: 'Ignored' }, 0)
  assert.equal(step.title, 'Card 1')
  assert.equal(step.card_template, 'step')
  assert.equal(step.instructions, 'No instructions yet.')
  assert.equal(step.image_url, null)
  assert.equal(step.youtube_url, null)
  assert.equal(step.subtitle, null)

  const video = deckCardStepFields({ template: 'video', title: 'Watch', body: 'Caption', image: null, videoUrl: 'youtu.be/abc123' }, 4)
  assert.equal(video.card_template, 'video')
  assert.equal(video.youtube_url, 'https://youtu.be/abc123')
  assert.equal(video.instructions, 'OG_DECK_CARD_META:{"template":"video","youtubeUrl":"https://youtu.be/abc123"}\n\nCaption')

  assert.equal(deckCardStepFields({ template: 'not-a-type', title: 'T', body: 'B', image: null }, 0).card_template, 'step')
})

test('paint links keep the card order, skip empty slots and map catalog and custom paints', () => {
  assert.deepEqual(deckCardPaintRows('step-1', 'owner', [
    { id: 'catalog:p1', ratio_text: ' 2:1 ' },
    { id: 'paint:123:1', ratio_text: '1:1' },
    { id: 'custom:c9', ratio_text: '' },
    { id: 'bare-catalog-id' },
  ]), [
    { recipe_step_id: 'step-1', user_id: 'owner', paint_source: 'catalog', paint_catalog_id: 'p1', custom_paint_id: null, paint_order: 1, ratio_text: '2:1' },
    { recipe_step_id: 'step-1', user_id: 'owner', paint_source: 'custom', paint_catalog_id: null, custom_paint_id: 'c9', paint_order: 3, ratio_text: null },
    { recipe_step_id: 'step-1', user_id: 'owner', paint_source: 'catalog', paint_catalog_id: 'bare-catalog-id', custom_paint_id: null, paint_order: 4, ratio_text: null },
  ])
  assert.deepEqual(deckCardPaintRows('step-1', 'owner', undefined), [])
})
