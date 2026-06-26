import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '../../utils/supabase/server'
import DashboardTopBar from '../dashboard/dashboard-top-bar'
import VaultFilters from './vault-filters'
import VaultGrid from './vault-grid'
import VaultSegmentedTabs from './vault-segmented-tabs'
import CustomPaintForm from './custom-paint-form'
import {
  VaultFiltersSkeleton,
  VaultGridSkeleton,
} from './vault-skeletons'
import { createPerfTimer } from '../../utils/perf/server'

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

async function userHasOwnedPaints(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
) {
  const [{ data: ownedCatalogPaint }, { data: customPaint }] = await Promise.all([
    supabase
      .from('user_paint_ownership')
      .select('paint_catalog_id')
      .eq('user_id', userId)
      .eq('is_owned', true)
      .limit(1)
      .maybeSingle(),

    supabase
      .from('paints')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle(),
  ])

  return Boolean(ownedCatalogPaint || customPaint)
}

export default async function VaultPage({ searchParams }: PageProps) {
  const perf = createPerfTimer('/vault')
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  perf.mark('auth/session fetch')

  if (!user) {
    redirect('/login')
  }

  const resolvedSearchParams = await searchParams
  perf.mark('search params')

  const requestedTab = resolveVaultTab(resolvedSearchParams.tab)
  const activeTab = resolvedSearchParams.tab
    ? requestedTab
    : (await userHasOwnedPaints(supabase, user.id))
      ? 'collection'
      : 'find'

  const profilePromise = (async () =>
    supabase
      .from('profiles')
      .select('avatar_url, level, username')
      .eq('id', user.id)
      .single())()

  const q = resolvedSearchParams.q?.trim() || ''
  const brand = resolvedSearchParams.brand || ''
  const line = resolvedSearchParams.line || ''
  const matchHex =
    activeTab === 'find' ? resolvedSearchParams.matchHex?.trim() || '' : ''
  const ownership =
    activeTab === 'collection'
      ? 'owned'
      : resolvedSearchParams.ownership || 'all'

  const limit = Math.max(24, Number(resolvedSearchParams.limit || 24))
  perf.total()

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <Suspense fallback={null}>
          <DashboardTopBar userId={user.id} profilePromise={profilePromise} />
        </Suspense>

        <section>
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-400">
            Inventory Management
          </p>

          <h1 className="mt-4 text-4xl font-black tracking-tight text-white">
            The Paint Vault
          </h1>

          <p className="mt-4 text-sm font-medium text-neutral-200">
            Your personal paint inventory
          </p>
          <p className="mt-2 text-base leading-7 text-neutral-400">
            Keep track of every paint you own or want, and the custom mixes
            you&apos;ve created. Manage your collection, avoid buying duplicates,
            export with ease, and seamlessly connect to your recipes and themes.
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

