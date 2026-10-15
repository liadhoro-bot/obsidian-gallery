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
  const coverRecipeId = typeof doc.coverRecipeId === 'string' && doc.coverRecipeId ? doc.coverRecipeId : null
  if (description.length > 2000) throw new Error(`${doc.name}: description is over 2000 characters`)
  if (coverRecipeId) {
    const guide = await checked(db.from('recipes').select('user_id, is_public, name').eq('id', coverRecipeId).maybeSingle())
    if (!guide || guide.user_id !== ownerId || !guide.is_public) throw new Error(`${doc.name}: cover is not one of their public guides`)
  }
  rows.push({ contest_id: contest.id, owner_user_id: ownerId, description: description || null, cover_recipe_id: coverRecipeId, updated_at: new Date().toISOString() })
  console.log(`${doc.name}: ${description ? `${description.length} chars` : 'no description'}, ${coverRecipeId ? 'cover picked' : 'automatic cover'}`)
}

if (!apply) {
  console.log(`Dry run: ${rows.length} creators checked. Pass --apply to write.`)
} else {
  await checked(db.from('contest_creator_profiles').upsert(rows, { onConflict: 'contest_id,owner_user_id' }))
  const stored = await checked(db.from('contest_creator_profiles').select('owner_user_id, description, cover_recipe_id').eq('contest_id', contest.id))
  for (const row of rows) {
    const match = stored.find((s) => s.owner_user_id === row.owner_user_id)
    if (!match || match.description !== row.description || match.cover_recipe_id !== row.cover_recipe_id) throw new Error(`Read-back mismatch for ${row.owner_user_id}`)
  }
  console.log(`Wrote and verified ${rows.length} creator profiles.`)
}
