import Image from 'next/image'
import { createClient } from '../../utils/supabase/server'
import { redirect } from 'next/navigation'
import MobileNav from '../components/MobileNav'
import { togglePaintOwnership } from './actions'

export default async function VaultPage({
  searchParams,
}: {
  searchParams: Promise<{
  q?: string
  brand?: string
  line?: string
  ownership?: string
}>
}) {
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
  let paintsQuery = supabase
    .from('paint_catalog')
    .select(`
      id,
      brand,
      line,
      name,
      sku,
      swatch_image_url,
      hex_approx,
      finish,
      paint_type
    `)
    .order('name', { ascending: true })

  if (q) {
    paintsQuery = paintsQuery.ilike('name', `%${q}%`)
  }

  if (brand) {
    paintsQuery = paintsQuery.eq('brand', brand)
  }

  if (line) {
    paintsQuery = paintsQuery.eq('line', line)
  }

  const { data: paints, error } = await paintsQuery
const { data: ownedPaintRows, error: ownedPaintsError } = await supabase
  .from('user_paint_ownership')
  .select('paint_catalog_id, is_owned')
  .eq('user_id', user.id)
  .eq('is_owned', true)

if (ownedPaintsError) {
  throw new Error(ownedPaintsError.message)
}

const ownedPaintIds = new Set(
  (ownedPaintRows || []).map((row) => row.paint_catalog_id)
)
const visiblePaints =
  ownership === 'owned'
    ? (paints || []).filter((paint) => ownedPaintIds.has(paint.id))
    : ownership === 'not_owned'
      ? (paints || []).filter((paint) => !ownedPaintIds.has(paint.id))
      : paints || []
  const { data: allBrands } = await supabase
    .from('paint_catalog')
    .select('brand')

  const { data: allLines } = await supabase
    .from('paint_catalog')
    .select('line')

  const brandOptions = Array.from(
    new Set((allBrands || []).map((item) => item.brand).filter(Boolean))
  ).sort()

  const lineOptions = Array.from(
    new Set((allLines || []).map((item) => item.line).filter(Boolean))
  ).sort()

  return (
    <main className="min-h-screen bg-neutral-950 p-6 pb-28 text-white">
      <div className="mx-auto max-w-2xl">
        <MobileNav />

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400">
            Catalogue
          </p>

          <h1 className="mt-2 text-3xl font-bold text-white">Paint Vault</h1>

          <p className="mt-3 max-w-2xl text-sm text-neutral-400">
            Browse your full paint catalogue with real swatches, and filter by brand and line.
          </p>
        </section>

        <section className="mt-6">
          <h2 className="text-xl font-semibold text-white">All Paints</h2>

          <form
            method="GET"
            className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-sm"
          >
            <div className="grid gap-3 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm text-neutral-300">
                  Search
                </label>
                <input
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder="Search by paint name"
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-neutral-300">
                  Brand
                </label>
                <select
                  name="brand"
                  defaultValue={brand}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                >
                  <option value="">All</option>
                  {brandOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-neutral-300">
                  Line
                </label>
                <select
                  name="line"
                  defaultValue={line}
                  className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
                >
                  <option value="">All</option>
                  {lineOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
<div>
  <label className="mb-1 block text-sm text-neutral-300">
    Ownership
  </label>
  <select
    name="ownership"
    defaultValue={ownership}
    className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white"
  >
    <option value="">All</option>
    <option value="owned">Owned</option>
    <option value="not_owned">Not owned</option>
  </select>
</div>
              <div className="md:col-span-4 flex gap-2">
                <button
                  type="submit"
                  className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black"
                >
                  Apply
                </button>

                <a
                  href="/vault"
                  className="rounded-xl bg-neutral-800 px-4 py-2 font-medium text-white"
                >
                  Reset
                </a>
              </div>
            </div>
          </form>

          {error ? (
            <pre className="mt-4 whitespace-pre-wrap rounded bg-red-100 p-4 text-sm text-black">
              {JSON.stringify(error, null, 2)}
            </pre>
          ) : visiblePaints.length > 0 ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {visiblePaints.map((paint) => {
  const swatchImage = paint.swatch_image_url
  const hexApprox = paint.hex_approx
  const isOwned = ownedPaintIds.has(paint.id)

                return (
  <form key={paint.id} action={togglePaintOwnership}>
    <input type="hidden" name="paintId" value={paint.id} />

    <button
      type="submit"
      className="w-full text-left rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-sm hover:border-cyan-500"
    >
      <div className="flex items-start gap-4">
        {swatchImage ? (
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-950">
            <Image
              src={swatchImage}
              alt={`${paint.name || 'Paint'} swatch`}
              fill
              className="object-cover"
              sizes="48px"
            />
          </div>
        ) : hexApprox ? (
          <div
            className="h-12 w-12 shrink-0 rounded-2xl border border-neutral-700"
            style={{ backgroundColor: hexApprox }}
            title={hexApprox}
          />
        ) : (
          <div className="h-12 w-12 shrink-0 rounded-2xl border border-dashed border-neutral-700 bg-neutral-950" />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            {paint.brand || 'Unknown brand'}
          </p>

          <h3 className="mt-1 text-lg font-semibold text-white">
            {paint.name || 'Unnamed paint'}
          </h3>

          <p className="mt-1 text-sm text-neutral-400">
            {paint.line || 'No line'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-neutral-950 px-3 py-1 text-neutral-300">
            {paint.paint_type || 'No type'}
          </span>

          <span
            className={`rounded-full px-3 py-1 ${
              isOwned
                ? 'bg-cyan-500 text-black'
                : 'bg-neutral-800 text-neutral-300'
            }`}
          >
            {isOwned ? 'Owned' : 'Not owned'}
          </span>
        </div>

        <span className="truncate text-neutral-500">
          {hexApprox || 'No hex value'}
        </span>
      </div>
    </button>
  </form>
)
})}
            </div>
          ) : (
            <p className="mt-4 text-neutral-400">No paints found.</p>
          )}
        </section>
      </div>
    </main>
  )
}