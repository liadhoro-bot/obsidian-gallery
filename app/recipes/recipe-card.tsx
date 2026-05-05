import Image from 'next/image'
import Link from 'next/link'
import { saveRecipe, unsaveRecipe } from './actions'

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
  recipe: Recipe
  mode: 'public' | 'mine' | 'saved'
  isSaved?: boolean
}

export default function RecipeCard({ recipe, mode, isSaved }: Props) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.04] shadow-lg">
      <Link href={`/recipes/${recipe.id}`}>
        <div className="relative aspect-square bg-white/5">
          {recipe.image_url ? (
            <Image
              src={recipe.image_url}
              alt={recipe.name || 'Recipe image'}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-white/35">
              No image
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col space-y-2 p-3">
        <Link href={`/recipes/${recipe.id}`}>
          <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-5 text-white">
            {recipe.name || 'Untitled Recipe'}
          </h3>
        </Link>

        <p className="line-clamp-1 text-xs text-white/55">
          {mode === 'mine'
            ? 'by You'
            : mode === 'saved'
              ? 'Saved recipe'
              : 'Public recipe'}
        </p>

        {mode === 'public' ? (
  <form action={isSaved ? unsaveRecipe : saveRecipe} className="mt-auto">
    <input type="hidden" name="recipeId" value={recipe.id} />

    <button
      type="submit"
      className="group flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-3 py-2 text-xs font-bold tracking-wider text-cyan-300 transition hover:bg-cyan-400/20"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-3.5 w-3.5 fill-current opacity-80 transition group-hover:opacity-100"
        aria-hidden="true"
      >
        <path d="M6 3.5C6 2.67 6.67 2 7.5 2h9c.83 0 1.5.67 1.5 1.5V21l-6-3.5L6 21V3.5Z" />
      </svg>

      {isSaved ? 'SAVED' : 'SAVE'}
    </button>
  </form>
) : (
  <div className="mt-auto inline-flex rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold text-cyan-300">
    {mode === 'mine' ? 'MINE' : 'SAVED'}
  </div>
)}
      </div>
    </div>
  )
}