import Image from 'next/image'
import { createClient } from '../../../../utils/supabase/server'

type PaintRef = {
  source: 'catalog' | 'custom'
  paintId: string
  userId: string
}

export default async function PaintHero({ paintRef }: { paintRef: PaintRef }) {
  const supabase = await createClient()

  if (paintRef.source === 'catalog') {
    const { data: paint } = await supabase
      .from('paint_catalog')
      .select('id, name, brand, line, sku, swatch_image_url, hex_approx')
      .eq('id', paintRef.paintId)
      .maybeSingle()

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
              alt={paint.name}
              fill
              className="object-cover opacity-90"
            />
          ) : null}

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

  const { data: paint } = await supabase
    .from('paints')
    .select('id, name, manufacturer, series, paint_type, color_hex')
    .eq('id', paintRef.paintId)
    .eq('user_id', paintRef.userId)
    .maybeSingle()

  if (!paint) return null

  return (
    <section className="overflow-hidden rounded-2xl bg-slate-900 shadow-xl">
      <div
        className="flex h-72 flex-col justify-end p-8"
        style={{ backgroundColor: paint.color_hex || '#111827' }}
      >
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
    </section>
  )
}