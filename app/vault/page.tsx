import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { redirect } from 'next/navigation'
import { createClient, getSessionUser } from '../../utils/supabase/server'
import DashboardTopBar from '../dashboard/dashboard-top-bar'
import { TopBarSkeleton } from '../dashboard/dashboard-skeletons'
import VaultFilters from './vault-filters'
import VaultGrid from './vault-grid'
import VaultSegmentedTabs from './vault-segmented-tabs'
import {
  VaultFiltersSkeleton,
  VaultGridSkeleton,
} from './vault-skeletons'
import { createPerfTimer } from '../../utils/perf/server'
import { getDashboardProfile } from '../dashboard/dashboard-data'
import VaultDiscoveryEmptyState from './vault-discovery-empty-state'

const CustomPaintForm = dynamic(() => import('./custom-paint-form'), {
  loading: () => (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 animate-pulse">
      <div className="h-5 w-40 rounded bg-white/10" />
      <div className="mt-4 h-12 rounded-2xl bg-white/10" />
      <div className="mt-3 h-32 rounded-2xl bg-white/5" />
    </div>
  ),
})

type VaultTab = 'find' | 'collection' | 'custom'

type PageProps = {
  searchParams: Promise<{
    tab?: string
    q?: string
    brand?: string
    line?: string
    ownership?: string
    limit?: string
    matchHex?: string
  }>
}

function resolveVaultTab(tab?: string): VaultTab {
  if (tab === 'collection') return 'collection'
  if (tab === 'custom') return 'custom'
  return 'find'
}

export default async function VaultPage({ searchParams }: PageProps) {
  const perf = createPerfTimer('/vault')
  const supabase = await createClient()

  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) {
    redirect('/login')
  }

  const resolvedSearchParams = await searchParams
  perf.mark('search params')

  const requestedTab = resolveVaultTab(resolvedSearchParams.tab)
  const activeTab = resolvedSearchParams.tab ? requestedTab : 'find'

  const profilePromise = (async () => ({
    data: await getDashboardProfile(user.id),
  }))()

  const q = resolvedSearchParams.q?.trim() || ''
  const brand = resolvedSearchParams.brand || ''
  const line = resolvedSearchParams.line || ''
  const matchHex =
    activeTab === 'find' ? resolvedSearchParams.matchHex?.trim() || '' : ''
  const ownership =
    activeTab === 'collection'
      ? 'owned'
      : resolvedSearchParams.ownership || 'all'
  const shouldShowDiscoveryPrompt =
    activeTab === 'find' &&
    !q &&
    !brand &&
    !line &&
    !matchHex &&
    ownership === 'all'

  const limit = Math.max(24, Number(resolvedSearchParams.limit || 24))
  perf.total()

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <Suspense fallback={<TopBarSkeleton />}>
          <DashboardTopBar userId={user.id} profilePromise={profilePromise} />
        </Suspense>

        <section>
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-400">
            Inventory Management
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-tight text-white">
            Paints
          </h1>

          <p className="mt-4 text-sm font-medium text-neutral-200">
            Your personal paint inventory
          </p>
          <p className="mt-2 text-base leading-7 text-neutral-400">
            Keep track of every paint you own or want, and the custom mixes
            you&apos;ve created. Manage your collection, avoid buying duplicates,
            export with ease, and seamlessly connect to your guides and themes.
          </p>
        </section>

        <VaultSegmentedTabs
          activeTab={activeTab}
          q={q}
          brand={brand}
          line={line}
          ownership={ownership}
        />

        {activeTab !== 'custom' ? (
          <Suspense fallback={<VaultFiltersSkeleton />}>
            <VaultFilters
              q={q}
              brand={brand}
              line={line}
              ownership={ownership}
              matchHex={matchHex}
              tab={activeTab === 'collection' ? 'collection' : 'find'}
              userId={user.id}
            />
          </Suspense>
        ) : null}

        {activeTab === 'custom' ? (
          <CustomPaintForm mode="create" />
        ) : shouldShowDiscoveryPrompt ? (
          <VaultDiscoveryEmptyState />
        ) : (
          <Suspense
            key={`${activeTab}-${q}-${brand}-${line}-${ownership}-${matchHex}-${limit}`}
            fallback={<VaultGridSkeleton />}
          >
            <VaultGrid
              q={q}
              brand={brand}
              line={line}
              ownership={ownership}
              matchHex={matchHex}
              limit={limit}
              tab={activeTab === 'collection' ? 'collection' : 'find'}
              userId={user.id}
            />
          </Suspense>
        )}
      </div>
    </main>
  )
}

