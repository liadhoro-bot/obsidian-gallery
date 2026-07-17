'use client'

import dynamic from 'next/dynamic'
import {
  startTransition,
  useDeferredValue,
  useMemo,
  useState,
} from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import RecipeCard from './recipe-card'
import RecipeSearchBar from './recipe-search-bar'

const CreateRecipeForm = dynamic(() => import('./create-recipe-form'))

type Recipe = {
  id: string
  name: string | null
  description: string | null
  image_url: string | null
  is_public: boolean | null
  created_at: string | null
  user_id: string | null
}

type Tab = 'find' | 'mine' | 'custom'

type Props = {
  activeTab: Tab
  publicRecipes: Recipe[]
  myRecipes: Recipe[]
  savedRecipes: Recipe[]
  savedRecipeIds: string[]
}

export default function RecipesPageClient({
  activeTab,
  publicRecipes,
  myRecipes,
  savedRecipes,
  savedRecipeIds,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [findSearch, setFindSearch] = useState('')
  const [mySearch, setMySearch] = useState('')
  const deferredFindSearch = useDeferredValue(findSearch)
  const deferredMySearch = useDeferredValue(mySearch)
  const requestedTab = searchParams.get('tab')
  const currentTab: Tab =
    requestedTab === 'find' ||
    requestedTab === 'mine' ||
    requestedTab === 'custom'
      ? requestedTab
      : activeTab

  const savedSet = useMemo(() => new Set(savedRecipeIds), [savedRecipeIds])

  const myLibrary = useMemo(() => {
    const map = new Map<string, Recipe & { libraryType: 'mine' | 'saved' }>()

    for (const recipe of myRecipes) {
      map.set(recipe.id, { ...recipe, libraryType: 'mine' })
    }

    for (const recipe of savedRecipes) {
      if (!map.has(recipe.id)) {
        map.set(recipe.id, { ...recipe, libraryType: 'saved' })
      }
    }

    return Array.from(map.values())
  }, [myRecipes, savedRecipes])

  const filteredPublicRecipes = useMemo(() => {
    const search = deferredFindSearch.toLowerCase()

    return publicRecipes.filter((recipe) =>
      recipe.name?.toLowerCase().includes(search)
    )
  }, [deferredFindSearch, publicRecipes])

  const filteredMyLibrary = useMemo(() => {
    const search = deferredMySearch.toLowerCase()

    return myLibrary.filter((recipe) =>
      recipe.name?.toLowerCase().includes(search)
    )
  }, [deferredMySearch, myLibrary])

  function setTab(tab: Tab) {
    if (tab === currentTab) {
      return
    }

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set('tab', tab)

    startTransition(() => {
      router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false })
    })
  }

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-1">
        <button
          type="button"
          onClick={() => setTab('mine')}
          className={tabClass(currentTab === 'mine')}
        >
          My Guides
        </button>

        <button
          type="button"
          onClick={() => setTab('find')}
          className={tabClass(currentTab === 'find')}
        >
          Find Guide
        </button>

        <button
          type="button"
          onClick={() => setTab('custom')}
          className={tabClass(currentTab === 'custom')}
        >
          Create Guide
        </button>
      </div>

      {currentTab === 'find' ? (
        <div className="space-y-5">
          <RecipeSearchBar
            value={findSearch}
            onChange={setFindSearch}
            placeholder="Search guides by name..."
          />

          <h2 className="text-sm font-bold tracking-[0.24em] text-white/80">
            DISCOVER PUBLIC GUIDES
          </h2>

          <div
            className="grid grid-cols-2 gap-3"
            style={{ contentVisibility: 'auto', containIntrinsicSize: '1200px' }}
          >
            {filteredPublicRecipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                mode="public"
                isSaved={savedSet.has(recipe.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {currentTab === 'mine' ? (
        <div className="space-y-5">
          <RecipeSearchBar
            value={mySearch}
            onChange={setMySearch}
            placeholder="Search my guides..."
          />

          <h2 className="text-sm font-bold tracking-[0.24em] text-white/80">
            MY LIBRARY
          </h2>

          <div
            className="grid grid-cols-2 gap-3"
            style={{ contentVisibility: 'auto', containIntrinsicSize: '1200px' }}
          >
            {filteredMyLibrary.map((recipe) => (
              <RecipeCard
                key={`${recipe.libraryType}-${recipe.id}`}
                recipe={recipe}
                mode={recipe.libraryType}
                isSaved={recipe.libraryType === 'saved'}
              />
            ))}
          </div>
        </div>
      ) : null}

      {currentTab === 'custom' ? <CreateRecipeForm /> : null}
    </section>
  )
}

function tabClass(active: boolean) {
  return [
    'rounded-lg px-2 py-3 text-center text-xs font-semibold transition',
    'focus:outline-none focus:ring-2 focus:ring-cyan-300/60',
    active
      ? 'border border-cyan-400/60 bg-cyan-400/15 text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.25)]'
      : 'text-white/60',
  ].join(' ')
}
