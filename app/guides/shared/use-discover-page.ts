'use client'

import { useEffect, useRef, useState } from 'react'
import type { DiscoverPage } from '../discover-data'
import { discoverQueryString, type DiscoverQuery } from './discover-query'

export function useDiscoverPage(enabled: boolean, query: DiscoverQuery, initial?: DiscoverPage, initialQuery?: DiscoverQuery) {
  const [page, setPage] = useState<DiscoverPage>(initial ?? { guides: [], hasMore: false })
  const [request, setRequest] = useState<{ key: string; busy: boolean; error: string | null }>({ key: '', busy: false, error: null })
  const [retry, setRetry] = useState(0)
  const key = discoverQueryString({ ...query, offset: 0 })
  const busy = request.key === key && request.busy
  const error = request.key === key ? request.error : null
  const currentKey = useRef(key)
  currentKey.current = key
  const loadedKey = useRef(initial ? discoverQueryString({ ...initialQuery!, offset: 0 }) : null)
  const sequence = useRef(0)

  useEffect(() => {
    if (!enabled || (loadedKey.current === key && !retry)) return
    const generation = ++sequence.current
    const controller = new AbortController()
    setRequest({ key, busy: true, error: null })
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/guides/discover?${key}`, { signal: controller.signal })
        if (!response.ok) throw new Error('Could not load guides. Please try again.')
        const next: DiscoverPage = await response.json()
        if (generation !== sequence.current) return
        setPage(next)
        loadedKey.current = key
      } catch (caught) {
        if (!controller.signal.aborted && generation === sequence.current) setRequest({ key, busy: false, error: caught instanceof Error ? caught.message : 'Could not load guides.' })
      } finally {
        if (!controller.signal.aborted && generation === sequence.current) setRequest(previous => ({ ...previous, busy: false }))
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
      if (sequence.current === generation) sequence.current++
    }
  }, [enabled, key, retry])

  async function loadMore() {
    if (busy || !page.hasMore || loadedKey.current !== key) return
    const generation = ++sequence.current
    setRequest({ key, busy: true, error: null })
    try {
      const response = await fetch(`/api/guides/discover?${key.replace(/offset=\d+/, `offset=${page.guides.length}`)}`)
      if (!response.ok) throw new Error('Could not load more guides. Please try again.')
      const next: DiscoverPage = await response.json()
      if (generation !== sequence.current || currentKey.current !== key) return
      setPage(previous => ({ hasMore: next.hasMore, guides: [...previous.guides, ...next.guides.filter(guide => !previous.guides.some(existing => existing.id === guide.id))] }))
    } catch (caught) {
      if (generation === sequence.current) setRequest({ key, busy: false, error: caught instanceof Error ? caught.message : 'Could not load more guides.' })
    } finally {
      if (generation === sequence.current) setRequest(previous => ({ ...previous, busy: false }))
    }
  }
  return { ...page, busy, error, loadMore, retry: () => { loadedKey.current = null; setRetry(value => value + 1) } }
}
