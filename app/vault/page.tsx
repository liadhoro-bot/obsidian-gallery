import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import MobileNav from '../components/MobileNav'
import DashboardTopBar from '../dashboard/dashboard-top-bar'
import VaultFilters from './vault-filters'
import VaultGrid from './vault-grid'
import VaultSegmentedTabs from './vault-segmented-tabs'
import CustomColorForm from './custom-color-form'
import {
  VaultFiltersSkeleton,
  VaultGridSkeleton,
} from './vault-skeletons'

type VaultTab = 'find' | 'collection' | 'custom'

type PageProps = {
  searchParams: Promise<{
    tab?: string
    q?: string
    brand?: string
    line?: string
    ownership?: string
    limit?: string
  }>
}

function resolveVaultTab(tab?: string): VaultTab {
  if (tab === 'collection') return 'collection'
  if (tab === 'custom') return 'custom'
  return 'find'
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

  const activeTab = resolveVaultTab(resolvedSearchParams.tab)

  const q = resolvedSearchParams.q?.trim() || ''
  const brand = resolvedSearchParams.brand || ''
  const line = resolvedSearchParams.line || ''
  const ownership =
    activeTab === 'collection'
      ? 'owned'
      : resolvedSearchParams.ownership || 'all'

  const limit = Math.max(24, Number(resolvedSearchParams.limit || 24))

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <Suspense fallback={null}>
          <DashboardTopBar />
        </Suspense>

        <section>
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-400">
            Inventory Management
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-tight text-white">
            The Paint Vault
          </h1>

          <p className="mt-4 text-base leading-7 text-neutral-400">
            Your curated collection of premium pigments and mediums. Organised
            for high-speed reference and palette synchronization.
          </p>
        </section>

        <VaultSegmentedTabs
          activeTab={activeTab}
          q={q}
          brand={brand}
          line={line}
          ownership={ownership}
        />

        {activeTab !== 'custom' && (
          <Suspense fallback={<VaultFiltersSkeleton />}>
            <VaultFilters
  q={q}
  brand={brand}
  line={line}
  ownership={ownership}
  tab={activeTab === 'collection' ? 'collection' : 'find'}
/>
          </Suspense>
        )}

        {activeTab === 'custom' ? (
          <CustomColorForm />
        ) : (
          <Suspense
            key={`${activeTab}-${q}-${brand}-${line}-${ownership}-${limit}`}
            fallback={<VaultGridSkeleton />}
          >
            <VaultGrid
  q={q}
  brand={brand}
  line={line}
  ownership={ownership}
  limit={limit}
  tab={activeTab === 'collection' ? 'collection' : 'find'}
/>
          </Suspense>
        )}
      </div>

      <MobileNav />
    </main>
  )
}