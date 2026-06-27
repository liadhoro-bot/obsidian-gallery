import Image from 'next/image'
import { createClient } from '../../../../utils/supabase/server'
import { createServiceRoleClient } from '../../../../utils/supabase/service-role'

type PaintRef = {
  source: 'catalog' | 'custom'
  paintId: string
  userId: string
}

export default async function PaintHero({ paintRef }: { paintRef: PaintRef }) {
  const supabase = await createClient()

  if (paintRef.source === 'catalog') {
    let paint: {
      id: string
      name: string | null
      brand: string | null
      line: string | null
      sku: string | null
      swatch_image_url: string | null
      hex_approx: string | null
    } | null = null

    try {
      const serviceSupabase = createServiceRoleClient()
      const { data, error } = await serviceSupabase
        .from('paint_catalog')
        .select(
          'id, name, brand, line, sku, swatch_image_url, hex_approx, finish, paint_type'
        )
        .eq('id', paintRef.paintId)
        .maybeSingle()

      if (error) {
        console.error('Catalog paint hero failed:', error)
      }

      paint = data
    } catch (error) {
      console.error('Catalog paint hero failed:', error)
    }

    if (!paint) return null

    return (
      <section className="overflow-hidden rounded-2xl bg-slate-900 shadow-xl">
        <div
          className="relative flex h-72 flex-col justify-end p-8"
          style={{ backgroundColor: paint.hex_approx || '#111827' }}
        >
          {paint.swatch_image_url ? (
            <Image
              src={paint.swatch_image_url}
              alt={paint.name || 'Paint swatch'}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 420px"
              className="object-cover opacity-90"
            />
          ) : null}

          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

          <div className="relative z-10">
            <h1 className="text-4xl font-black leading-none text-white">
              {paint.name}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-slate-950/70 px-3 py-1 text-xs font-bold uppercase tracking-widest text-cyan-300">
                {paint.brand}
              </span>

              <span className="text-sm font-semibold text-white/80">
                {paint.line}
              </span>

              {paint.sku ? (
                <span className="text-sm font-semibold text-white/60">
                  {paint.sku}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    )
  }

  const [{ data: paint }, { data: imageAsset }] = await Promise.all([
    supabase
      .from('paints')
      .select('id, name, manufacturer, series, paint_type, color_hex')
      .eq('id', paintRef.paintId)
      .eq('user_id', paintRef.userId)
      .maybeSingle(),

    supabase
      .from('image_assets')
      .select('image_url')
      .eq('entity_type', 'paint')
      .eq('entity_id', paintRef.paintId)
      .eq('user_id', paintRef.userId)
      .eq('is_featured', true)
      .maybeSingle(),
  ])

  if (!paint) return null

  return (
    <section className="overflow-hidden rounded-2xl bg-slate-900 shadow-xl">
      <div
        className="relative flex h-72 flex-col justify-end p-8"
        style={{ backgroundColor: paint.color_hex || '#111827' }}
      >
        {imageAsset?.image_url ? (
          <Image
            src={imageAsset.image_url}
            alt={paint.name || 'Custom paint swatch'}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 420px"
            className="object-cover opacity-90"
          />
        ) : null}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />

        <div className="relative z-10">
          <h1 className="text-4xl font-black leading-none text-white">
            {paint.name}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-950/70 px-3 py-1 text-xs font-bold uppercase tracking-widest text-cyan-300">
              {paint.manufacturer || 'Custom'}
            </span>

            {paint.series ? (
              <span className="text-sm font-semibold text-white/80">
                {paint.series}
              </span>
            ) : null}

            <span className="rounded-md bg-cyan-500/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-cyan-200">
              Editable
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
