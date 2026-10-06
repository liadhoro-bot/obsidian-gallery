'use client'
import { useEffect, useState } from 'react'
export function useEditorTab<T extends string>(fallback: T, tabs: readonly T[]) {
  const [tab, setTab] = useState<T>(fallback)
  useEffect(() => {
    const restore = () => {
      const saved = new URLSearchParams(window.location.search).get('editorTab') as T
      setTab(tabs.includes(saved) ? saved : fallback)
    }
    restore()
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [fallback, tabs])
  return [tab, (value: T) => {
    const url = new URL(window.location.href)
    url.searchParams.set('editorTab', value)
    window.history.replaceState(window.history.state, '', url)
    setTab(value)
  }] as const
}
