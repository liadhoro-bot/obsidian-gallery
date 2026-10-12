import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('save controls offer saved-library and project/unit assignment paths', () => {
  const action = read('../app/guides/shared/save-assignment-action.tsx')
  const social = read('../app/guides/shared/guide-social-actions.tsx')
  const hero = read('../app/guides/decks/[id]/deck-hero-actions.tsx')

  assert.match(action, /Add to Saved Guides/)
  assert.match(action, /Assign to Project\/Unit/)
  assert.match(action, /type="checkbox"/)
  assert.match(action, /project\.projectIds|unit\.projectIds/)
  assert.match(action, /aria-expanded=\{expanded\}/)
  assert.match(action, /projectStyles\.dialogPanel/)
  assert.match(social, /<SaveAssignmentAction/)
  assert.match(hero, /<SaveAssignmentAction/)
})

test('project and both unit details surfaces render the shared assignment card', () => {
  const project = read('../app/projects/[id]/project-details-tab.tsx')
  const card = read('../app/guides/shared/assigned-content-card.tsx')
  const currentUnit = read('../app/units/[id]/unit-v3-preview.tsx')
  const legacyUnit = read('../app/units/[id]/unit-detail-client.tsx')

  assert.match(project, /<AssignedContentCard targetType="project"/)
  assert.match(card, /projectStyles\.dialogPanel/)
  assert.match(card, /projectStyles\.paintPickerRow/)
  assert.match(card, />Guides</)
  assert.doesNotMatch(card, />Guides & Decks</)
  assert.match(card, /setError\(null\)/)
  assert.match(card, /aria-label=\{expanded \? 'Hide assigned guides' : 'Show assigned guides'\}/)
  assert.match(card, /expanded \? 'Hide' : 'Show'/)
  assert.match(card, /guidesStyles\.guidesSilver/)
  assert.match(card, /data-v3-guides-indicator="guide-card"/)
  assert.match(card, /grid-cols-\[76px_minmax\(0,1fr\)\]/)
  assert.match(card, /data-v3-guides-indicator="list-card-actions"/)
  assert.match(card, /<ViewCardsLink/)
  assert.match(card, /<GuideSocialActions/)
  assert.match(currentUnit, /<AssignedContentCard targetType="unit"/)
  assert.match(legacyUnit, /<AssignedContentCard targetType="unit"/)
})

test('content assignments schema supports guides and decks on projects and units', () => {
  const migration = read('../supabase/migrations/20261007103000_add_content_assignments.sql')

  assert.match(migration, /target_type in \('project', 'unit'\)/)
  assert.match(migration, /content_type in \('guide', 'deck'\)/)
  assert.match(migration, /enable row level security/)
  assert.match(migration, /Users manage their own content assignments/)
})
