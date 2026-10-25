import test from 'node:test'
import assert from 'node:assert/strict'
import { allowsGuideShareLink, GUIDE_STATUSES, guideVisibilityOf, statusFromVisibility, visibilityFromStatus } from '../app/guides/shared/guide-visibility'

test('all editor statuses round-trip without unlisted becoming draft', () => {
  for (const status of GUIDE_STATUSES) {
    const visibility = visibilityFromStatus(status)
    assert.equal(guideVisibilityOf(visibility), visibility)
    assert.equal(statusFromVisibility(visibility), status)
  }
})

test('only explicitly public or unlisted guides allow anonymous links', () => {
  for (const value of ['public', 'unlisted']) assert.equal(allowsGuideShareLink(value), true)
  for (const value of ['draft', 'private', undefined, null, '', 'Public', 'unknown']) {
    assert.equal(allowsGuideShareLink(value), false)
  }
})
