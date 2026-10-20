import { normalizeGuideTags } from './guide-tags'

// public.tag_directory: one canonical tag, the spellings that fold into it,
// and its Browse Tags section. A null category means "not sorted yet".
export type TagCategory = 'game' | 'faction' | 'subject' | 'skill' | 'technique' | 'brand'

export type TagDirectoryEntry = {
  name: string
  category: TagCategory | null
  aliases: string[]
  sortOrder: number
}

// Section order on Browse Tags. `tab` is the short label on the category
// switcher; `title` heads the section.
export const TAG_CATEGORIES: { id: TagCategory; tab: string; title: string }[] = [
  { id: 'game', tab: 'Game', title: 'Games & Worlds' },
  { id: 'faction', tab: 'Faction', title: 'Factions' },
  { id: 'subject', tab: 'Subject', title: 'Subjects' },
  { id: 'skill', tab: 'Skill', title: 'Skill Level' },
  { id: 'technique', tab: 'Technique', title: 'Techniques' },
  { id: 'brand', tab: 'Brand', title: 'Paint Brands' },
]

export function isTagCategory(value: unknown): value is TagCategory {
  return TAG_CATEGORIES.some((category) => category.id === value)
}

// lower-cased name or alias -> directory entry.
export function buildTagLookup(directory: TagDirectoryEntry[]) {
  const lookup = new Map<string, TagDirectoryEntry>()
  for (const entry of directory) {
    for (const spelling of [entry.name, ...entry.aliases]) {
      const key = spelling.trim().toLocaleLowerCase()
      if (key && !lookup.has(key)) lookup.set(key, entry)
    }
  }
  return lookup
}

export function canonicalTag(tag: string, lookup: Map<string, TagDirectoryEntry>) {
  return lookup.get(tag.trim().toLocaleLowerCase())?.name ?? tag
}

// Folds aliases into their canonical names, then trims, dedupes and caps the
// list the same way a saved guide's tags always are.
export function canonicalGuideTags(tags: unknown, lookup: Map<string, TagDirectoryEntry>) {
  const list = Array.isArray(tags) ? tags.filter((tag): tag is string => typeof tag === 'string') : []
  return normalizeGuideTags(list.map((tag) => canonicalTag(tag, lookup)))
}

// Browse Tags filtering: within a section any selected tag matches; across
// sections all must. `guideTags` holds a guide's canonical tags (plus its
// difficulty, so Skill Level tags match it).
export function matchesTagFilters(
  guideTags: Set<string>,
  selected: string[],
  lookup: Map<string, TagDirectoryEntry>
) {
  const groups = new Map<string, string[]>()
  for (const tag of selected) {
    const section = lookup.get(tag.toLocaleLowerCase())?.category ?? 'other'
    groups.set(section, [...(groups.get(section) ?? []), tag])
  }
  return [...groups.values()].every((group) => group.some((tag) => guideTags.has(tag)))
}
