import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import MobileNav from '../components/MobileNav'
import DashboardTopBar from '../dashboard/dashboard-top-bar'
import VaultFilters from './vault-filters'
import VaultStats from './vault-stats'
import VaultGrid from './vault-grid'
import {
  VaultFiltersSkeleton,
  VaultStatsSkeleton,
  VaultGridSkeleton,
} from './vault-skeletons'

type PageProps = {
  searchParams: Promise<{
    q?: string
    brand?: string
    line?: string
    ownership?: string
  }>
}

export default async function VaultPage({ searchParams }: PageProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const resolvedSearchParams = await searchParams

  const q = resolvedSearchParams.q?.trim() || ''
  const brand = resolvedSearchParams.brand || ''
  const line = resolvedSearchParams.line || ''
  const ownership = resolvedSearchParams.ownership || ''

  return (
    <main className="min-h-screen bg-neutral-950 p-6 pb-28 text-white">
      <div className="mx-auto max-w-5xl">
        <MobileNav />

        <Suspense fallback={null}>
          <DashboardTopBar />
        </Suspense>

        <div className="mt-6">
          <Suspense fallback={<VaultStatsSkeleton />}>
            <VaultStats />
          </Suspense>
        </div>

        <div className="mt-6">
          <Suspense fallback={<VaultFiltersSkeleton />}>
            <VaultFilters
              q={q}
              brand={brand}
              line={line}
              ownership={ownership}
            />
          </Suspense>
        </div>

        <div className="mt-6">
          <Suspense
            key={`${q}-${brand}-${line}-${ownership}`}
            fallback={<VaultGridSkeleton />}
          >
            <VaultGrid
              q={q}
              brand={brand}
              line={line}
              ownership={ownership}
            />
          </Suspense>
        </div>
      </div>
    </main>
  )
}