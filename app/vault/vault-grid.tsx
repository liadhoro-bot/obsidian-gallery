import Image from 'next/image'
import { createClient } from '../../utils/supabase/server'
import { togglePaintOwnership, togglePaintWishlist } from './actions'
import Link from 'next/link'

type VaultGridProps = {
  q: string
  brand: string
  line: string
  ownership: string
}

type VaultPaint = {
  id: string
  source: 'catalog' | 'custom'
  brand: string | null
  line: string | null
  name: string | null
  sku: string | null
  swatch_image_url: string | null
  hex_approx: string | null
  paint_type: string | null
  is_owned: boolean
  is_wishlist: boolean
}
function getBrandAbbreviation(brand?: string | null) {
  const normalized = (brand || '').toLowerCase()

  if (normalized.includes('vallejo')) return 'VAL'
  if (normalized.includes('warhammer')) return 'WHC'
  if (normalized.includes('citadel')) return 'WHC'
  if (normalized.includes('army painter')) return 'TAP'
  if (normalized.includes('custom')) return 'CUS'

  return (brand || 'UNK').slice(0, 3).toUpperCase()
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

  if (!user) return null

  const [{ data: catalogRows }, { data: customRows }, { data: ownershipRows }] =
    await Promise.all([
      supabase
        .from('paint_catalog')
        .select(`
          id,
          brand,
          line,
          name,
          sku,
          swatch_image_url,
          hex_approx,
          paint_type
        `)
        .eq('is_active', true),

      supabase
        .from('paints')
        .select(`
          id,
          name,
          manufacturer,
          series,
          paint_type,
          color_hex
        `)
        .eq('user_id', user.id),

      supabase
        .from('user_paint_ownership')
        .select('paint_catalog_id, is_owned, is_wishlist')
        .eq('user_id', user.id),
    ])

  const ownedSet = new Set(
    (ownershipRows || [])
      .filter((row) => row.is_owned)
      .map((row) => row.paint_catalog_id)
  )
const wishlistSet = new Set(
  (ownershipRows || [])
    .filter((row) => row.is_wishlist)
    .map((row) => row.paint_catalog_id)
)
  const catalogPaints: VaultPaint[] =
  catalogRows?.map((paint) => ({
    id: paint.id,
    source: 'catalog',
    brand: paint.brand,
    line: paint.line,
    name: paint.name,
    sku: paint.sku,
    swatch_image_url: paint.swatch_image_url,
    hex_approx: paint.hex_approx,
    paint_type: paint.paint_type,
    is_owned: ownedSet.has(paint.id),
    is_wishlist: wishlistSet.has(paint.id),
  })) || []

  const customPaints: VaultPaint[] =
  customRows?.map((paint) => ({
    id: paint.id,
    source: 'custom',
    brand: paint.manufacturer,
    line: paint.series,
    name: paint.name,
    sku: null,
    swatch_image_url: null,
    hex_approx: paint.color_hex,
    paint_type: paint.paint_type,
    is_owned: true,
    is_wishlist: false,
  })) || []

  const visiblePaints = [...catalogPaints, ...customPaints]
    .filter((paint) => {
      const matchesSearch =
        !q ||
        paint.name?.toLowerCase().includes(q.toLowerCase()) ||
        paint.sku?.toLowerCase().includes(q.toLowerCase())

      const matchesBrand = !brand || paint.brand === brand
      const matchesLine = !line || paint.line === line

      const matchesOwnership =
        ownership === 'owned'
          ? paint.is_owned
          : ownership === 'not_owned'
            ? !paint.is_owned
            : true

      return matchesSearch && matchesBrand && matchesLine && matchesOwnership
    })
    .sort((a, b) => {
      return (
        (a.brand || '').localeCompare(b.brand || '') ||
        (a.line || '').localeCompare(b.line || '') ||
        (a.name || '').localeCompare(b.name || '')
      )
    })

  if (visiblePaints.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-neutral-800 bg-neutral-900 p-8 text-center">
        <p className="text-lg font-semibold text-white">No paints found</p>
        <p className="mt-2 text-sm text-neutral-400">
          Try changing the filters or resetting the search.
        </p>
      </div>
    )
  }

  return (
  <section className="grid grid-cols-3 gap-x-4 gap-y-7">
    {visiblePaints.map((paint) => {
      const href =
  paint.source === 'custom'
    ? `/vault/custom/${paint.id}`
    : `/vault/catalog/${paint.id}`

      return (
        <article key={`${paint.source}-${paint.id}`} className="min-w-0">
          <Link href={href} className="group block w-full text-left">
            <PaintSwatch paint={paint} />
          </Link>

          <div className="mt-2 grid grid-cols-2 gap-1">
            {paint.source === 'catalog' ? (
              <form action={togglePaintOwnership} className="min-w-0">
                <input type="hidden" name="paintId" value={paint.id} />

                <button
                  type="submit"
                  className={`flex h-5 w-full items-center justify-center rounded-full border px-1 text-[7px] font-black uppercase leading-none tracking-tight ${
                    paint.is_owned
                      ? 'border-cyan-500/30 bg-cyan-500/15 text-cyan-300'
                      : 'border-neutral-700 bg-neutral-800 text-neutral-500'
                  }`}
                >
                  Owned
                </button>
              </form>
            ) : (
              <span className="flex h-5 w-full items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/15 px-1 text-[7px] font-black uppercase leading-none tracking-tight text-cyan-300">
                Owned
              </span>
            )}

            {paint.source === 'catalog' ? (
              <form action={togglePaintWishlist} className="min-w-0">
                <input type="hidden" name="paintId" value={paint.id} />

                <button
                  type="submit"
                  className={`flex h-5 w-full items-center justify-center rounded-full border px-1 text-[7px] font-black uppercase leading-none tracking-tight ${
                    paint.is_wishlist
                      ? 'border-orange-500/20 bg-orange-500/10 text-orange-300'
                      : 'border-neutral-700 bg-neutral-800 text-neutral-500'
                  }`}
                >
                  Wishlist
                </button>
              </form>
            ) : (
              <span className="flex h-5 w-full items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 px-1 text-[7px] font-black uppercase leading-none tracking-tight text-neutral-500">
                Wishlist
              </span>
            )}
          </div>
        </article>
      )
    })}
  </section>
)
}

function PaintSwatch({ paint }: { paint: VaultPaint }) {
  return (
    <>
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-[0_0_0_4px_rgba(23,23,23,0.65)] transition group-hover:border-cyan-500">
        {paint.swatch_image_url ? (
          <Image
            src={paint.swatch_image_url}
            alt={`${paint.name || 'Paint'} swatch`}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 33vw, 220px"
          />
        ) : paint.hex_approx ? (
          <div
            className="h-full w-full"
            style={{ backgroundColor: paint.hex_approx }}
          />
        ) : (
          <div className="h-full w-full bg-neutral-900" />
        )}
      </div>

      <h3 className="mt-3 truncate text-xs font-black uppercase leading-tight tracking-wide text-white">
        {paint.name || 'Unnamed paint'}
      </h3>

      <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-[0.08em] text-neutral-500">
  <span className="text-cyan-300">
    {getBrandAbbreviation(paint.brand)}
  </span>
  <span className="text-neutral-600"> · </span>
  <span>{paint.line || 'No line'}</span>
</p>
    </>
  )
}