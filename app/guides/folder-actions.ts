'use server'

// Guides page folders (My Guides + Saved). Rows are private to their owner
// through RLS; every write here runs as the signed-in viewer.

import { createClient, getSessionUser } from '../../utils/supabase/server'
import type { GuideFolderScope, GuideFoldersSnapshot } from './shared/guide-folder-types'

const ITEM_KEY = /^(guide|deck):[0-9a-f-]{36}$/

function isScope(scope: string): scope is GuideFolderScope {
  return scope === 'mine' || scope === 'saved'
}

function cleanName(name: string) {
  return name.trim().slice(0, 60)
}

async function viewer() {
  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  if (!user) throw new Error('Sign in to use folders.')
  return { supabase, user }
}

export async function loadGuideFolders(): Promise<Record<GuideFolderScope, GuideFoldersSnapshot>> {
  const empty: Record<GuideFolderScope, GuideFoldersSnapshot> = {
    mine: { folders: [], assignments: {} },
    saved: { folders: [], assignments: {} },
  }
  const { supabase, user } = await viewer()
  const [foldersResult, itemsResult] = await Promise.all([
    supabase
      .from('guide_folders')
      .select('id, scope, name')
      .eq('user_id', user.id)
      .order('position')
      .order('created_at'),
    supabase.from('guide_folder_items').select('scope, item_key, folder_id').eq('user_id', user.id),
  ])
  // Before the migration runs the tables are missing: show no folders rather
  // than failing the whole page.
  if (foldersResult.error || itemsResult.error) {
    console.error('[guide folders] load failed', foldersResult.error ?? itemsResult.error)
    return empty
  }
  for (const row of foldersResult.data ?? []) {
    if (isScope(row.scope)) empty[row.scope].folders.push({ id: row.id, name: row.name })
  }
  for (const row of itemsResult.data ?? []) {
    if (isScope(row.scope)) empty[row.scope].assignments[row.item_key] = row.folder_id
  }
  return empty
}

export async function createGuideFolder(scope: string, name: string) {
  if (!isScope(scope)) throw new Error('Unknown folder scope.')
  const trimmed = cleanName(name)
  if (!trimmed) throw new Error('Give the folder a name.')
  const { supabase, user } = await viewer()
  const { data, error } = await supabase
    .from('guide_folders')
    .insert({ user_id: user.id, scope, name: trimmed, position: Math.floor(Date.now() / 1000) })
    .select('id, name')
    .single()
  if (error) throw new Error(error.message)
  return data as { id: string; name: string }
}

export async function renameGuideFolder(folderId: string, name: string) {
  const trimmed = cleanName(name)
  if (!trimmed) throw new Error('Give the folder a name.')
  const { supabase, user } = await viewer()
  const { error } = await supabase
    .from('guide_folders')
    .update({ name: trimmed })
    .eq('id', folderId)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
}

// Deletes the folder only. Its filing rows cascade away, so its guides go
// back to "Not in a folder"; the guides themselves are never touched.
export async function deleteGuideFolder(folderId: string) {
  const { supabase, user } = await viewer()
  const { error } = await supabase
    .from('guide_folders')
    .delete()
    .eq('id', folderId)
    .eq('user_id', user.id)
  if (error) throw new Error(error.message)
}

// folderId null takes the guide out of its folder.
export async function moveGuideToFolder(scope: string, itemKey: string, folderId: string | null) {
  if (!isScope(scope)) throw new Error('Unknown folder scope.')
  if (!ITEM_KEY.test(itemKey)) throw new Error('Unknown guide.')
  const { supabase, user } = await viewer()
  const { error } = folderId
    ? await supabase
        .from('guide_folder_items')
        .upsert({ user_id: user.id, scope, item_key: itemKey, folder_id: folderId }, { onConflict: 'user_id,scope,item_key' })
    : await supabase
        .from('guide_folder_items')
        .delete()
        .eq('user_id', user.id)
        .eq('scope', scope)
        .eq('item_key', itemKey)
  if (error) throw new Error(error.message)
}
