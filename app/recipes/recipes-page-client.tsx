'use client'

import { useMemo, useState } from 'react'
import RecipeCard from './recipe-card'
import RecipeSearchBar from './recipe-search-bar'
import CreateRecipeForm from './create-recipe-form'

type Recipe = {
  id: string
  name: string | null
  description: string | null
  image_url: string | null
  is_public: boolean | null
  created_at: string | null
  user_id: string | null
}

type Props = {
  publicRecipes: Recipe[]
  myRecipes: Recipe[]
  savedRecipes: Recipe[]
  savedRecipeIds: string[]
}

type Tab = 'find' | 'mine' | 'custom'

export default function RecipesPageClient({
  publicRecipes,
  myRecipes,
  savedRecipes,
  savedRecipeIds,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('find')
  const [findSearch, setFindSearch] = useState('')
  const [mySearch, setMySearch] = useState('')

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

  const filteredPublicRecipes = publicRecipes.filter((recipe) =>
    recipe.name?.toLowerCase().includes(findSearch.toLowerCase())
  )

  const filteredMyLibrary = myLibrary.filter((recipe) =>
    recipe.name?.toLowerCase().includes(mySearch.toLowerCase())
  )

    return (
    <section className="space-y-5">
      <section className="space-y-4">
        <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-400">
          Paint Scheme Management
        </p>

        <h1 className="text-4xl font-black tracking-tight text-white">
          The Recipe Library
        </h1>

        <p className="text-base leading-7 text-neutral-400">
          Browse public painting recipes, save your favorites, and build custom
          step-by-step schemes for your miniatures.
        </p>
      </section>

      {/* ✅ TABS */}
      <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-1">
        <button
          onClick={() => setActiveTab('find')}
          className={tabClass(activeTab === 'find')}
        >
          Find Recipe
        </button>

        <button
          onClick={() => setActiveTab('mine')}
          className={tabClass(activeTab === 'mine')}
        >
          My Recipes
        </button>

        <button
          onClick={() => setActiveTab('custom')}
          className={tabClass(activeTab === 'custom')}
        >
          Custom Recipe
        </button>
      </div>

      {activeTab === 'find' && (
        <div className="space-y-5">
          <RecipeSearchBar
            value={findSearch}
            onChange={setFindSearch}
            placeholder="Search recipes by name..."
          />

          <h2 className="text-sm font-bold tracking-[0.24em] text-white/80">
            DISCOVER PUBLIC RECIPES
          </h2>

          <div className="grid grid-cols-2 gap-3">
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
      )}

      {activeTab === 'mine' && (
        <div className="space-y-5">
          <RecipeSearchBar
            value={mySearch}
            onChange={setMySearch}
            placeholder="Search my recipes..."
          />

          <h2 className="text-sm font-bold tracking-[0.24em] text-white/80">
            MY LIBRARY
          </h2>

          <div className="grid grid-cols-2 gap-3">
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
      )}

      {activeTab === 'custom' && <CreateRecipeForm />}
    </section>
  )
}

function tabClass(active: boolean) {
  return [
    'rounded-lg px-2 py-3 text-xs font-semibold transition',
    active
      ? 'border border-cyan-400/60 bg-cyan-400/15 text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.25)]'
      : 'text-white/60',
  ].join(' ')
}