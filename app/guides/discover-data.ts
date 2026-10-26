import { createClient } from '../../utils/supabase/server'
import { getSupabaseImageUrl } from '../../utils/images/supabase-image'
import { getGuideDeckThumbnail, type GuidesV3GuideFile } from './guides-v3-data'
import { loadTagDirectory } from './tag-directory-data'
import { buildTagLookup } from './shared/tag-directory'
import type { DiscoverQuery } from './shared/discover-query'

export type DiscoverPage = { guides: GuidesV3GuideFile[]; hasMore: boolean }
export type DiscoverFacetCounts = { counts: Record<string, number>; total: number }
type Summary = {
  id: string; owner_id: string; title: string; subtitle: string; thumbnail_url: string | null;
  difficulty: string; tags: string[]; creator_username: string | null; creator_avatar: string | null;
  social_recipe_id: string; like_count: number; save_count: number; created_at: string;
  viewer_has_liked: boolean; viewer_has_saved: boolean;
}

async function tagGroups(tags: string[]) {
  if (!tags.length) return []
  const lookup = buildTagLookup(await loadTagDirectory())
  const groups = new Map<string, string[]>()
  for (const tag of tags) {
    const entry = lookup.get(tag.toLocaleLowerCase())
    const category = entry?.category ?? 'other'
    groups.set(category, [...(groups.get(category) ?? []), (entry?.name ?? tag).toLocaleLowerCase()])
  }
  return [...groups.values()]
}

export async function getDiscoverPage(userId: string, query: DiscoverQuery): Promise<DiscoverPage> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('discover_guides_page', {
    p_search: query.search, p_sort: query.sort, p_offset: query.offset, p_groups: await tagGroups(query.tags),
  })
  if (error) throw new Error(`Could not load Discover: ${error.message}`)
  // Listing summaries deliberately contain no cards, paint links or member decks.
  return {
    hasMore: Boolean(data.hasMore),
    guides: (data.guides as Summary[]).map(row => ({
      id: row.id, title: row.title, subtitle: row.subtitle, image: getGuideDeckThumbnail(row.thumbnail_url),
      level: row.difficulty, difficulty: row.difficulty, tags: row.tags, createdAt: row.created_at,
      deckId: row.social_recipe_id, deckIds: [], decks: 0, cards: 0, ownedPercent: 0, palette: [],
      isOwner: row.owner_id === userId, visibility: 'public',
      likeCount: Number(row.like_count), saveCount: Number(row.save_count),
      viewerHasLiked: row.viewer_has_liked, viewerHasSaved: row.viewer_has_saved,
      creator: row.creator_username ? {
        username: row.creator_username,
        avatar: getSupabaseImageUrl(row.creator_avatar, { width: 64, height: 64, quality: 60, resize: 'cover' }),
        href: `/guides/creators/${row.owner_id}?preview=1`,
      } : undefined,
    })),
  }
}

export async function getDiscoverFacets(query: DiscoverQuery): Promise<DiscoverFacetCounts> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('discover_guide_facets', {
    p_search: query.search, p_groups: await tagGroups(query.tags),
  })
  if (error) throw new Error(`Could not load guide tags: ${error.message}`)
  return data as DiscoverFacetCounts
}
