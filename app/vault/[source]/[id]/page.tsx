import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'
import MobileNav from '../../../components/MobileNav'
import DashboardTopBar from '../../../dashboard/dashboard-top-bar'
import PaintHero from './paint-hero'
import PaintTechnicalSpecs from './paint-technical-specs'
import PaintOwnershipCard from './paint-ownership-card'
import PaintRecipesUsed from './paint-recipes-used'
import {
  PaintHeroSkeleton,
  PaintTechnicalSpecsSkeleton,
  PaintOwnershipSkeleton,
  PaintRecipesSkeleton,
} from './paint-skeletons'

type PageProps = {
  params: Promise<{
    source: string
    id: string
  }>
}

export default async function PaintPage({ params }: PageProps) {
  const { source, id } = await params

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (!id || !['catalog', 'custom'].includes(source)) {
    redirect('/vault')
  }

  const paintRef = {
    source: source as 'catalog' | 'custom',
    paintId: id,
    userId: user.id,
  }

  return (
  <main className="min-h-screen bg-[#061012] pb-24 text-slate-100">
    <div className="mx-auto w-full max-w-md px-4">
      <DashboardTopBar />
    </div>

    <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-5">

  <Link
    href="/vault"
    className="text-sm text-cyan-400"
  >
    ← Back to Vault
  </Link>

  <Suspense fallback={<PaintHeroSkeleton />}>
        <PaintHero paintRef={paintRef} />
      </Suspense>

      <Suspense fallback={<PaintTechnicalSpecsSkeleton />}>
        <PaintTechnicalSpecs paintRef={paintRef} />
      </Suspense>

      <Suspense fallback={<PaintOwnershipSkeleton />}>
        <PaintOwnershipCard paintRef={paintRef} />
      </Suspense>

      <Suspense fallback={<PaintRecipesSkeleton />}>
        <PaintRecipesUsed paintRef={paintRef} />
      </Suspense>
    </div>

    <MobileNav />
  </main>
)
}