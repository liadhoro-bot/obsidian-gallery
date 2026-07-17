'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import ThemeCard from './theme-card'
import ThemeForm from './theme-form'

type ThemePaint = {
  id: string
  sort_order: number | null
  paint_catalog_id?: string | null
  custom_paint_id?: string | null
  catalog_paint:
    | {
        swatch_image_url: string | null
        hex_approx: string | null
      }
    | {
        swatch_image_url: string | null
        hex_approx: string | null
      }[]
    | null
  custom_paint:
    | {
        color_hex: string | null
      }
    | {
        color_hex: string | null
      }[]
    | null
}

type Theme = {
  id: string
  user_id: string | null
  name: string
  description: string | null
  image_url: string | null
  is_public: boolean | null
  tags?: string[] | null
  theme_paints?: ThemePaint[] | null
}

type PaintOption = {
  id: string
  source: 'catalog' | 'custom'
  name: string
  brand: string | null
  line: string | null
  sku?: string | null
  swatch_image_url: string | null
  hex: string | null
}

type Tab = 'find' | 'mine' | 'create'

type Props = {
  activeTab: Tab
  currentUserId: string
  publicThemes: Theme[]
  myAndSavedThemes: Theme[]
  savedThemeIds: string[]
  paintOptions: PaintOption[]
  initialSearch: string
  selectForProject?: string | null
  attachThemeToProjectAction?: (formData: FormData) => Promise<void>
}

const tabs: { key: Tab; label: string }[] = [
  { key: 'mine', label: 'My Themes' },
  { key: 'find', label: 'Find Theme' },
  { key: 'create', label: 'Create Theme' },
]

function themeMatchesSearch(theme: Theme, query: string) {
  if (!query) return true

  const haystack = [theme.name, ...(theme.tags || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

export default function ThemesPageClient({
  activeTab,
  currentUserId,
  publicThemes,
  myAndSavedThemes,
  savedThemeIds,
  paintOptions,
  initialSearch,
  selectForProject = null,
  attachThemeToProjectAction,
}: Props) {
  const searchParams = useSearchParams()
  const [findSearch, setFindSearch] = useState(initialSearch)

  const requestedTab = searchParams.get('tab')
  const currentTab =
    requestedTab === 'mine' ||
    requestedTab === 'find' ||
    requestedTab === 'create'
      ? requestedTab
      : activeTab

  const buildHref = useCallback((tab: Tab, search: string) => {
    const params = new URLSearchParams()
    params.set('tab', tab)

    const trimmedSearch = search.trim()
    if (tab === 'find' && trimmedSearch) {
      params.set('q', trimmedSearch)
    }
    if (selectForProject) {
      params.set('selectForProject', selectForProject)
    }

    return `/themes?${params.toString()}`
  }, [selectForProject])

  const syncUrl = useCallback((tab: Tab, search: string) => {
    window.history.replaceState(null, '', buildHref(tab, search))
  }, [buildHref])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      syncUrl(currentTab, findSearch)
    }, 180)

    return () => window.clearTimeout(timeout)
  }, [currentTab, findSearch, syncUrl])

  const savedThemeSet = useMemo(() => new Set(savedThemeIds), [savedThemeIds])
  const filteredPublicThemes = useMemo(
    () =>
      publicThemes.filter((theme) =>
        themeMatchesSearch(theme, findSearch.trim().toLowerCase())
      ),
    [findSearch, publicThemes]
  )
  const filteredMyAndSavedThemes = useMemo(
    () =>
      myAndSavedThemes.filter((theme) =>
        themeMatchesSearch(theme, findSearch.trim().toLowerCase())
      ),
    [findSearch, myAndSavedThemes]
  )

  function setTab(tab: Tab) {
    if (tab === currentTab) {
      return
    }
    syncUrl(tab, findSearch)
  }

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setTab(tab.key)}
            className={tabClass(currentTab === tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {currentTab !== 'create' ? (
        <div className="flex items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
          <input
            type="search"
            value={findSearch}
            onChange={(event) => setFindSearch(event.target.value)}
            placeholder="Search themes by name or tags..."
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/40"
          />
        </div>
      ) : null}

      <div hidden={currentTab !== 'find'} aria-hidden={currentTab !== 'find'}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {filteredPublicThemes.length > 0 ? (
              filteredPublicThemes.map((theme) => (
                <ThemeCard
                  key={theme.id}
                  theme={theme}
                  currentUserId={currentUserId}
                  isSaved={savedThemeSet.has(theme.id)}
                  selectForProject={selectForProject}
                  attachThemeToProjectAction={attachThemeToProjectAction}
                />
              ))
            ) : (
              <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
                {findSearch.trim()
                  ? 'No themes match that search.'
                  : 'No public themes yet.'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div hidden={currentTab !== 'mine'} aria-hidden={currentTab !== 'mine'}>
        <div className="grid grid-cols-2 gap-3">
          {filteredMyAndSavedThemes.length > 0 ? (
            filteredMyAndSavedThemes.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                currentUserId={currentUserId}
                isSaved={savedThemeSet.has(theme.id)}
                selectForProject={selectForProject}
                attachThemeToProjectAction={attachThemeToProjectAction}
              />
            ))
          ) : (
            <div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
              {findSearch.trim()
                ? 'No themes match that search.'
                : 'You have not created or saved any themes yet.'}
            </div>
          )}
        </div>
      </div>

      <div hidden={currentTab !== 'create'} aria-hidden={currentTab !== 'create'}>
        <ThemeForm paints={paintOptions} />
      </div>
    </section>
  )
}

function tabClass(active: boolean) {
  return [
    'rounded-lg px-2 py-3 text-center text-xs font-semibold transition',
    active
      ? 'border border-cyan-400/60 bg-cyan-400/15 text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.25)]'
      : 'text-white/60',
  ].join(' ')
}
