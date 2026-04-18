import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '../../utils/supabase/server'
import MobileNav from '../components/MobileNav'
import DashboardTopBar from '../dashboard/dashboard-top-bar'
import RecipesPageClient from './recipes-page-client'
import RecipesStats from './recipes-stats'
import RecipesFilters from './recipes-filters'
import RecipesList from './recipes-list'
import {
  RecipesStatsSkeleton,
  RecipesFiltersSkeleton,
  RecipesListSkeleton,
} from './recipes-skeletons'

type PageProps = {
  searchParams: Promise<{
    q?: string
  }>
}

export async function createRecipe(formData: FormData) {
  'use server'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const name = formData.get('name')?.toString().trim()
  const description = formData.get('description')?.toString().trim() || null

  if (!name) {
    throw new Error('Recipe name is required')
  }

  const { error } = await supabase.from('recipes').insert({
    name,
    description,
    user_id: user.id,
  })

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/recipes')
}

export default async function RecipesPage({ searchParams }: PageProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const resolvedSearchParams = await searchParams
  const q = resolvedSearchParams.q?.trim() || ''

  return (
    <main className="min-h-screen bg-neutral-950 p-6 pb-28 text-white">
      <div className="mx-auto max-w-5xl">
        <MobileNav />

        <Suspense fallback={null}>
          <DashboardTopBar />
        </Suspense>

        <div className="mt-6">
          <RecipesPageClient createRecipeAction={createRecipe} />
        </div>

        <div className="mt-6">
          <Suspense fallback={<RecipesStatsSkeleton />}>
            <RecipesStats />
          </Suspense>
        </div>

        <div className="mt-6">
          <Suspense fallback={<RecipesFiltersSkeleton />}>
            <RecipesFilters q={q} />
          </Suspense>
        </div>

        <div className="mt-6">
          <Suspense key={q} fallback={<RecipesListSkeleton />}>
            <RecipesList q={q} />
          </Suspense>
        </div>
      </div>
    </main>
  )
}