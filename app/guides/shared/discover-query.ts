export const DISCOVER_PAGE_SIZE = 9
export const DISCOVER_SORTS = ['new-old', 'old-new', 'name-asc', 'name-desc', 'popularity'] as const
export type DiscoverSort = typeof DISCOVER_SORTS[number]
export type DiscoverQuery = { search: string; sort: DiscoverSort; tags: string[]; offset: number }

export function parseDiscoverQuery(params: URLSearchParams): DiscoverQuery {
  const rawSort = params.get('sort')
  const offset = Number(params.get('offset') ?? 0)
  return {
    search: (params.get('q') ?? '').trim().slice(0, 200),
    sort: DISCOVER_SORTS.includes(rawSort as DiscoverSort) ? rawSort as DiscoverSort : 'new-old',
    tags: [...new Set(params.getAll('tag').map(tag => tag.trim()).filter(Boolean))].slice(0, 40),
    offset: Number.isSafeInteger(offset) && offset >= 0 ? Math.min(offset, 100000) : 0,
  }
}

export function discoverQueryString(query: DiscoverQuery) {
  const params = new URLSearchParams({ q: query.search, sort: query.sort, offset: String(query.offset) })
  for (const tag of query.tags) params.append('tag', tag)
  return params.toString()
}
