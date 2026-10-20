import { cache } from 'react'
import { createClient } from '../../utils/supabase/server'
import { isTagCategory, type TagDirectoryEntry } from './shared/tag-directory'

type TagDirectoryRow = {
  name: string
  category: string | null
  aliases: string[] | null
  sort_order: number | null
}

// The whole directory is a few dozen rows, so it's read in one go. A missing
// table (migration not applied) degrades to an empty directory: tags then
// show as-is under "Other".
export const loadTagDirectory = cache(async (): Promise<TagDirectoryEntry[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tag_directory')
    .select('name, category, aliases, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .returns<TagDirectoryRow[]>()

  if (error) {
    console.error('Failed to load tag directory', error.message)
    return []
  }

  return (data ?? []).map((row) => ({
    name: row.name,
    category: isTagCategory(row.category) ? row.category : null,
    aliases: row.aliases ?? [],
    sortOrder: row.sort_order ?? 100,
  }))
})
