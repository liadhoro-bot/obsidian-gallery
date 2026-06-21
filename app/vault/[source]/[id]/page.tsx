import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'
import BackButton from '../../../components/back-button'
import DashboardTopBar from '../../../dashboard/dashboard-top-bar'
import PaintHero from './paint-hero'
import PaintTechnicalSpecs from './paint-technical-specs'
import PaintOwnershipCard from './paint-ownership-card'
import PaintConversionChartCard from './paint-conversion-chart-card'
import PaintUsedIn from './paint-recipes-used'
import CustomPaintForm from '../../custom-paint-form'
import { deleteCustomPaintAction } from '../../custom-paint-actions'
import DeleteConfirmationCard from '../../../components/delete-confirmation-card'
import {
  PaintHeroSkeleton,
  PaintEditorSkeleton,
  PaintTechnicalSpecsSkeleton,
  PaintOwnershipSkeleton,
  PaintConversionChartSkeleton,
  PaintRecipesSkeleton,
} from './paint-skeletons'
import { createPerfTimer } from '../../../../utils/perf/server'

type PageProps = {
  params: Promise<{
    source: string
    id: string
  }>
}

async function CustomPaintEditor({
  paintId,
  userId,
}: {
  paintId: string
  userId: string
}) {
  const supabase = await createClient()

  const [{ data: paint, error }, { data: imageAsset }] = await Promise.all([
    supabase
      .from('paints')
      .select('id, name, manufacturer, series, color_hex')
      .eq('id', paintId)
      .eq('user_id', userId)
      .single(),

    supabase
      .from('image_assets')
      .select('image_url')
      .eq('entity_type', 'paint')
      .eq('entity_id', paintId)
      .eq('user_id', userId)
      .eq('is_featured', true)
      .maybeSingle(),
  ])

  if (error || !paint) {
    redirect('/vault?tab=collection')
  }

  return (
    <CustomPaintForm
      mode="edit"
      paint={{
        ...paint,
        image_url: imageAsset?.image_url || null,
      }}
    />
  )
}

export default async function PaintPage({ params }: PageProps) {
  const perf = createPerfTimer('/vault/[source]/[id]')
  const { source, id } = await params

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  perf.mark('auth/session fetch')

  if (!user) {
    redirect('/login')
  }

  if (!id || !['catalog', 'custom'].includes(source)) {
    redirect('/vault')
  }
  perf.total()

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
        <div className="relative">
          <div className="absolute left-4 top-4 z-20">
            <BackButton fallbackHref="/vault" />
          </div>

          <Suspense fallback={<PaintHeroSkeleton />}>
            <PaintHero paintRef={paintRef} />
          </Suspense>
        </div>

        {source === 'custom' ? (
          <Suspense fallback={<PaintEditorSkeleton />}>
            <CustomPaintEditor paintId={id} userId={user.id} />
          </Suspense>
        ) : (
          <>
            <Suspense fallback={<PaintTechnicalSpecsSkeleton />}>
              <PaintTechnicalSpecs paintRef={paintRef} />
            </Suspense>

            <Suspense fallback={<PaintOwnershipSkeleton />}>
              <PaintOwnershipCard paintRef={paintRef} />
            </Suspense>

            <Suspense fallback={<PaintConversionChartSkeleton />}>
              <PaintConversionChartCard paintRef={paintRef} />
            </Suspense>
          </>
        )}

        <Suspense fallback={<PaintRecipesSkeleton />}>
          <PaintUsedIn paintRef={paintRef} />
        </Suspense>

        {source === 'custom' ? (
          <DeleteConfirmationCard
            itemId={id}
            itemIdFieldName="paintId"
            title="Delete Custom Paint"
            buttonLabel="Delete Custom Paint"
            initialDescription="Permanently delete this custom paint from your vault."
            confirmDescription="If you delete this custom paint, it will be removed from your vault and any recipe paint links that use it. This action cannot be undone."
            deleteAction={deleteCustomPaintAction}
          />
        ) : null}
      </div>
    </main>
  )
}

