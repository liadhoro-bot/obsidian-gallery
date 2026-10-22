// Copies creator descriptions and entry covers from the "Hobby Guide Creator
// Profiles" canvas into contest_creator_profiles for the Top Hobby Guides contest.
// Input: a folder of the canvas's `creators` documents (one JSON file each, named
// <owner user id>.json). Dry run by default; pass --apply to write.
// Usage: node --env-file=.env.local scripts/sync-creator-profiles.mjs <folder> [--apply]
import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const folder = process.argv[2]
const apply = process.argv.includes('--apply')
if (!folder) throw new Error('Pass the folder of exported creator documents.')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
async function checked(query) { const { data, error } = await query; if (error) throw error; return data }

const contest = await checked(db.from('contests').select('id').eq('slug', 'best-painting-guide').single())
const rows = []
for (const file of readdirSync(folder).filter((name) => name.endsWith('.json'))) {
  const ownerId = basename(file, '.json')
  const raw = JSON.parse(readFileSync(join(folder, file), 'utf8'))
  const doc = raw.data ?? raw
  const description = typeof doc.description === 'string' ? doc.description.trim() : ''
  // Covers are chosen per published guide; a guide choice (or "Automatic" in
  // the guide picker) replaces any older per-deck cover.
  const coverGuideId = typeof doc.coverGuideId === 'string' && doc.coverGuideId ? doc.coverGuideId : null
  const coverRecipeId = 'coverGuideId' in doc ? null
    : typeof doc.coverRecipeId === 'string' && doc.coverRecipeId ? doc.coverRecipeId : null
  if (description.length > 2000) throw new Error(`${doc.name}: description is over 2000 characters`)
  if (coverGuideId) {
    const guide = await checked(db.from('guides').select('user_id, visibility').eq('id', coverGuideId).maybeSingle())
    if (!guide || guide.user_id !== ownerId || guide.visibility !== 'public') throw new Error(`${doc.name}: cover is not one of their published guides`)
  }
  if (coverRecipeId) {
    const deck = await checked(db.from('recipes').select('user_id, is_public').eq('id', coverRecipeId).maybeSingle())
    if (!deck || deck.user_id !== ownerId || !deck.is_public) throw new Error(`${doc.name}: cover is not one of their public decks`)
  }
  rows.push({ contest_id: contest.id, owner_user_id: ownerId, description: description || null, cover_guide_id: coverGuideId, cover_recipe_id: coverRecipeId, updated_at: new Date().toISOString() })
  console.log(`${doc.name}: ${description ? `${description.length} chars` : 'no description'}, ${coverGuideId ? 'cover guide picked' : coverRecipeId ? 'older deck cover' : 'automatic cover'}`)
}

if (!apply) {
  console.log(`Dry run: ${rows.length} creators checked. Pass --apply to write.`)
} else {
  await checked(db.from('contest_creator_profiles').upsert(rows, { onConflict: 'contest_id,owner_user_id' }))
  const stored = await checked(db.from('contest_creator_profiles').select('owner_user_id, description, cover_guide_id, cover_recipe_id').eq('contest_id', contest.id))
  for (const row of rows) {
    const match = stored.find((s) => s.owner_user_id === row.owner_user_id)
    if (!match || match.description !== row.description || match.cover_guide_id !== row.cover_guide_id || match.cover_recipe_id !== row.cover_recipe_id) throw new Error(`Read-back mismatch for ${row.owner_user_id}`)
  }
  console.log(`Wrote and verified ${rows.length} creator profiles.`)
}
