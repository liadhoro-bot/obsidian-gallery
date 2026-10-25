'use client'

import { useCallback, useEffect, useState } from 'react'
import { BrowseTagsPanel, buildBrowseTagSections } from './browse-tags-panel'
import { buildTagLookup, type TagDirectoryEntry } from './tag-directory'
import type { DiscoverFacetCounts } from '../discover-data'
import { discoverQueryString } from './discover-query'

export default function DiscoverTagsPanel({ search, applied, onApply }: {
  search: string; applied: string[]; onApply: (tags: string[]) => void
}) {
  const [metadata, setMetadata] = useState<{ key: string; directory: TagDirectoryEntry[]; facets: DiscoverFacetCounts } | null>(null)
  const [error, setError] = useState(false)
  const key = discoverQueryString({ search, tags: applied, sort: 'new-old', offset: 0 })
  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/guides/discover?mode=metadata&${key}`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Tags unavailable'); return response.json() })
      .then(data => setMetadata({ ...data, key })).catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [key])
  const resolveCounts = useCallback(async (tags: string[]) => {
    const response = await fetch(`/api/guides/discover?mode=facets&${discoverQueryString({ search, tags, sort: 'new-old', offset: 0 })}`)
    if (!response.ok) throw new Error('Could not load tag counts')
    return response.json() as Promise<DiscoverFacetCounts>
  }, [search])
  if (error) return <p role="alert">Could not load tags. Close Tags and try again.</p>
  if (!metadata || metadata.key !== key) return <p role="status">Loading tags…</p>
  const usage = new Map(metadata.directory.map(entry => [entry.name, metadata.facets.counts[entry.name.toLocaleLowerCase()] ?? 0]))
  for (const [tag, count] of Object.entries(metadata.facets.counts)) if (!metadata.directory.some(entry => entry.name.toLocaleLowerCase() === tag)) usage.set(tag, count)
  return <BrowseTagsPanel key={key} sections={buildBrowseTagSections(metadata.directory, usage)} applied={applied}
    guideTags={[]} lookup={buildTagLookup(metadata.directory)} onApply={onApply}
    initialCounts={metadata.facets} resolveCounts={resolveCounts} />
}
