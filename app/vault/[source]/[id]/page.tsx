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

type CustomPaintRow = {
  id: string
  name: string | null
  manufacturer: string | null
  series: string | null
  description?: string | null
  color_hex: string | null
}

type CustomPaintMixPaintRow = {
  id: string
  paint_order: number
  ratio_text: string | null
  paint_source: 'catalog' | 'custom' | null
  catalog_paint:
    | {
        id: string
        brand: string | null
        line: string | null
        name: string | null
        sku: string | null
        hex_approx: string | null
        swatch_image_url: string | null
        paint_type: string | null
      }
    | {
        id: string
        brand: string | null
        line: string | null
        name: string | null
        sku: string | null
        hex_approx: string | null
        swatch_image_url: string | null
        paint_type: string | null
      }[]
    | null
  custom_paint:
    | {
        id: string
        name: string | null
        manufacturer: string | null
        series: string | null
        color_hex: string | null
        paint_type: string | null
      }
    | {
        id: string
        name: string | null
        manufacturer: string | null
        series: string | null
        color_hex: string | null
        paint_type: string | null
      }[]
    | null
}

function isMissingCustomPaintMigrationError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const candidate = error as { code?: string; message?: string }
  const message = candidate.message || ''

  return (
    candidate.code === 'PGRST204' ||
    message.includes("Could not find the 'description' column") ||
    message.includes('custom_paint_mix_paints') ||
    message.includes('schema cache')
  )
}

async function loadCustomPaint(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paintId: string,
  userId: string
) {
  const result = await supabase
    .from('paints')
    .select('id, name, manufacturer, series, description, color_hex')
    .eq('id', paintId)
    .eq('user_id', userId)
    .single()

  if (!isMissingCustomPaintMigrationError(result.error)) {
    return result
  }

  return supabase
    .from('paints')
    .select('id, name, manufacturer, series, color_hex')
    .eq('id', paintId)
    .eq('user_id', userId)
    .single()
}

async function loadCustomPaintMixPaints(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paintId: string,
  userId: string
) {
  const result = await supabase
    .from('custom_paint_mix_paints')
    .select(`
      id,
      paint_order,
      ratio_text,
      paint_source,
      catalog_paint:catalog_paint_id (
        id,
        brand,
        line,
        name,
        sku,
        hex_approx,
        swatch_image_url,
        paint_type
      ),
      custom_paint:source_custom_paint_id (
        id,
        name,
        manufacturer,
        series,
        color_hex,
        paint_type
      )
    `)
    .eq('custom_paint_id', paintId)
    .eq('user_id', userId)
    .order('paint_order', { ascending: true })

  if (isMissingCustomPaintMigrationError(result.error)) {
    return { data: [] as CustomPaintMixPaintRow[], error: null }
  }

  return {
    data: (result.data || []) as CustomPaintMixPaintRow[],
    error: result.error,
  }
}

async function CustomPaintEditor({
  paintId,
  userId,
}: {
  paintId: string
  userId: string
}) {
  const supabase = await createClient()

  const [
    { data: paint, error },
    { data: imageAsset },
    { data: mixPaintRows },
  ] = await Promise.all([
    loadCustomPaint(supabase, paintId, userId),

    supabase
      .from('image_assets')
      .select('image_url')
      .eq('entity_type', 'paint')
      .eq('entity_id', paintId)
      .eq('user_id', userId)
      .eq('is_featured', true)
      .maybeSingle(),

    loadCustomPaintMixPaints(supabase, paintId, userId),
  ])

  if (error || !paint) {
    redirect('/vault?tab=collection')
  }

  return (
    <CustomPaintForm
      mode="edit"
      paint={{
        ...paint,
        description: (paint as CustomPaintRow).description || null,
        image_url: imageAsset?.image_url || null,
        mix_paints:
          mixPaintRows?.map((link) => {
            const catalogPaint = Array.isArray(link.catalog_paint)
              ? link.catalog_paint[0]
              : link.catalog_paint
            const customPaint = Array.isArray(link.custom_paint)
              ? link.custom_paint[0]
              : link.custom_paint

            return {
              id: link.id,
              paint_order: link.paint_order,
              ratio_text: link.ratio_text,
              paint_source: link.paint_source,
              paint:
                link.paint_source === 'custom' && customPaint
                  ? {
                      id: customPaint.id,
                      source: 'custom' as const,
                      name: customPaint.name,
                      brand: customPaint.manufacturer,
                      line: customPaint.series,
                      sku: null,
                      swatch_image_url: null,
                      hex: customPaint.color_hex,
                      hex_approx: customPaint.color_hex,
                      paint_type: customPaint.paint_type,
                      is_owned: true,
                      is_wishlist: false,
                    }
                  : catalogPaint
                    ? {
                        id: catalogPaint.id,
                        source: 'catalog' as const,
                        name: catalogPaint.name,
                        brand: catalogPaint.brand,
                        line: catalogPaint.line,
                        sku: catalogPaint.sku,
                        swatch_image_url: catalogPaint.swatch_image_url,
                        hex: catalogPaint.hex_approx,
                        hex_approx: catalogPaint.hex_approx,
                        paint_type: catalogPaint.paint_type,
                        is_owned: false,
                        is_wishlist: false,
                      }
                    : null,
            }
          }) || [],
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
        <DashboardTopBar userId={user.id} />
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
            initialDescription="Permanently delete this custom paint from your paints."
            confirmDescription="If you delete this custom paint, it will be removed from your paints and any guide paint links that use it. This action cannot be undone."
            deleteAction={deleteCustomPaintAction}
          />
        ) : null}
      </div>
    </main>
  )
}

