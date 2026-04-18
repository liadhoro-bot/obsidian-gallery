import Image from 'next/image'
import { createClient } from '../../utils/supabase/server'
import { togglePaintOwnership } from './actions'

type VaultGridProps = {
  q: string
  brand: string
  line: string
  ownership: string
}

type VaultPaint = {
  id: string
  brand: string | null
  line: string | null
  name: string | null
  sku: string | null
  swatch_image_url: string | null
  hex_approx: string | null
  finish: string | null
  paint_type: string | null
}

export default async function VaultGrid({
  q,
  brand,
  line,
  ownership,
}: VaultGridProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  let paintsQuery = supabase
    .from('paint_catalog')
    .select(
      `
      id,
      brand,
      line,
      name,
      sku,
      swatch_image_url,
      hex_approx,
      finish,
      paint_type
    `
    )
    .order('brand', { ascending: true })
    .order('line', { ascending: true })
    .order('name', { ascending: true })

  if (q) {
    paintsQuery = paintsQuery.or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
  }

  if (brand) {
    paintsQuery = paintsQuery.eq('brand', brand)
  }

  if (line) {
    paintsQuery = paintsQuery.eq('line', line)
  }

  const [{ data: paints, error }, { data: ownedRows, error: ownedError }] =
    await Promise.all([
      paintsQuery,
      supabase
        .from('user_paint_ownership')
        .select('paint_catalog_id')
        .eq('user_id', user.id)
        .eq('is_owned', true),
    ])

  if (error) {
    throw new Error(error.message)
  }

  if (ownedError) {
    throw new Error(ownedError.message)
  }

  const ownedSet = new Set(
    (ownedRows || []).map((row) => row.paint_catalog_id)
  )

  const allPaints = (paints || []) as VaultPaint[]

  const visiblePaints =
    ownership === 'owned'
      ? allPaints.filter((paint) => ownedSet.has(paint.id))
      : ownership === 'not_owned'
        ? allPaints.filter((paint) => !ownedSet.has(paint.id))
        : allPaints

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Paint Library</h2>
          <p className="text-sm text-neutral-400">
            Showing {visiblePaints.length} paint{visiblePaints.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {visiblePaints.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visiblePaints.map((paint) => {
            const isOwned = ownedSet.has(paint.id)

            return (
              <form key={paint.id} action={togglePaintOwnership}>
                <input type="hidden" name="paintId" value={paint.id} />

                <button
                  type="submit"
                  className="flex h-full w-full flex-col rounded-3xl border border-neutral-800 bg-neutral-900 p-4 text-left shadow-sm transition hover:border-cyan-500"
                >
                  <div className="flex items-start gap-4">
                    {paint.swatch_image_url ? (
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-950">
                        <Image
                          src={paint.swatch_image_url}
                          alt={`${paint.name || 'Paint'} swatch`}
                          fill
                          className="object-cover"
                          sizes="56px"
                        />
                      </div>
                    ) : paint.hex_approx ? (
                      <div
                        className="h-14 w-14 shrink-0 rounded-2xl border border-neutral-700"
                        style={{ backgroundColor: paint.hex_approx }}
                      />
                    ) : (
                      <div className="h-14 w-14 shrink-0 rounded-2xl border border-dashed border-neutral-700 bg-neutral-950" />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                            {paint.brand || 'Unknown brand'}
                          </p>

                          <h3 className="mt-1 truncate text-lg font-semibold text-white">
                            {paint.name || 'Unnamed paint'}
                          </h3>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                            isOwned
                              ? 'bg-cyan-500 text-black'
                              : 'bg-neutral-800 text-neutral-300'
                          }`}
                        >
                          {isOwned ? 'Owned' : 'Not owned'}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-neutral-400">
                        {paint.line || 'No line'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {paint.paint_type ? (
                      <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs text-neutral-300">
                        {paint.paint_type}
                      </span>
                    ) : null}

                    {paint.sku ? (
                      <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs text-neutral-300">
                        SKU {paint.sku}
                      </span>
                    ) : null}

                    {paint.hex_approx ? (
                      <span className="rounded-full bg-neutral-950 px-3 py-1 text-xs text-neutral-300">
                        {paint.hex_approx}
                      </span>
                    ) : null}
                  </div>
                </button>
              </form>
            )
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-900 p-8 text-center">
          <p className="text-lg font-semibold text-white">No paints found</p>
          <p className="mt-2 text-sm text-neutral-400">
            Try changing the filters or resetting the search.
          </p>
        </div>
      )}
    </section>
  )
}