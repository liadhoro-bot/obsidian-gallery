import { supabase } from '../../lib/supabase'
import MobileNav from '../components/MobileNav'
import { revalidatePath } from 'next/cache'

async function addPaint(formData: FormData) {
  'use server'

  const name = formData.get('name')?.toString().trim()
  const manufacturer = formData.get('manufacturer')?.toString().trim() || null
  const series = formData.get('series')?.toString().trim() || null
  const paintType = formData.get('paintType')?.toString().trim() || null
  const colorHexRaw = formData.get('colorHex')?.toString().trim() || ''
  const colorHex =
    colorHexRaw && colorHexRaw.startsWith('#')
      ? colorHexRaw
      : colorHexRaw
      ? `#${colorHexRaw}`
      : null

  if (!name) return

  const { error } = await supabase.from('paints').insert([
    {
      name,
      manufacturer,
      series,
      paint_type: paintType,
      color_hex: colorHex,
    },
  ])

  if (error) {
    console.error('Error adding paint:', error)
    throw new Error(JSON.stringify(error))
  }

  revalidatePath('/vault')
}

export default async function VaultPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    manufacturer?: string
    series?: string
  }>
}) {
 const {
  q = '',
  manufacturer = '',
  series = '',
} = await searchParams
let paintsQuery = supabase
  .from('paints')
  .select('*')
  .order('name', { ascending: true })

if (q) {
  paintsQuery = paintsQuery.ilike('name', `%${q}%`)
}

if (manufacturer) {
  paintsQuery = paintsQuery.eq('manufacturer', manufacturer)
}

if (series) {
  paintsQuery = paintsQuery.eq('series', series)
}

const { data: paints, error } = await paintsQuery
const { data: allManufacturers } = await supabase
  .from('paints')
  .select('manufacturer')

const { data: allSeries } = await supabase
  .from('paints')
  .select('series')

const manufacturerOptions = Array.from(
  new Set(
    (allManufacturers || [])
      .map((item) => item.manufacturer)
      .filter(Boolean)
  )
).sort()

const seriesOptions = Array.from(
  new Set(
    (allSeries || [])
      .map((item) => item.series)
      .filter(Boolean)
  )
).sort()

  return (
    <main className="min-h-screen bg-black p-6 pb-28 text-white">
      <div className="mx-auto max-w-2xl">
            <MobileNav />
        <a href="/" className="text-cyan-400">
          ← Back to Projects
        </a>

        <h1 className="mt-4 text-3xl font-bold">Paint Vault</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Manage your paint collection
        </p>

        <section className="mt-6 rounded border border-neutral-700 p-4">
          <h2 className="text-xl font-semibold">Add Paint</h2>

          <form action={addPaint} className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-neutral-300">
                Paint Name
              </label>
              <input
                name="name"
                type="text"
                required
                placeholder="e.g. Zandri Dust"
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Manufacturer
              </label>
              <input
                name="manufacturer"
                type="text"
                placeholder="e.g. Citadel"
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Series
              </label>
              <input
                name="series"
                type="text"
                placeholder="e.g. Base"
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Type
              </label>
              <input
                name="paintType"
                type="text"
                placeholder="e.g. Acrylic"
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Color Hex
              </label>
              <input
                name="colorHex"
                type="text"
                placeholder="#C9A66B"
                className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="rounded bg-cyan-500 px-4 py-2 font-medium text-black"
              >
                Add Paint
              </button>
            </div>
          </form>
        </section>

        <section className="mt-6">
          <h2 className="text-xl font-semibold">Your Paints</h2>
          <form method="GET" className="mt-4 grid gap-3 md:grid-cols-4">
  <div className="md:col-span-2">
    <label className="mb-1 block text-sm text-neutral-300">
      Search
    </label>
    <input
      type="text"
      name="q"
      defaultValue={q}
      placeholder="Search by paint name"
      className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
    />
  </div>

  <div>
    <label className="mb-1 block text-sm text-neutral-300">
      Manufacturer
    </label>
    <select
      name="manufacturer"
      defaultValue={manufacturer}
      className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
    >
      <option value="">All</option>
      {manufacturerOptions.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </div>

  <div>
    <label className="mb-1 block text-sm text-neutral-300">
      Series
    </label>
    <select
      name="series"
      defaultValue={series}
      className="w-full rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-white"
    >
      <option value="">All</option>
      {seriesOptions.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  </div>

  <div className="md:col-span-4 flex gap-2">
    <button
      type="submit"
      className="rounded bg-cyan-500 px-4 py-2 font-medium text-black"
    >
      Apply
    </button>

    <a
      href="/vault"
      className="rounded bg-neutral-800 px-4 py-2 font-medium text-white"
    >
      Reset
    </a>
  </div>
</form>

          {error ? (
            <pre className="mt-4 whitespace-pre-wrap rounded bg-red-100 p-4 text-sm text-black">
              {JSON.stringify(error, null, 2)}
            </pre>
          ) : paints && paints.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {paints.map((paint) => (
                <div
                  key={paint.id}
                  className="rounded border border-neutral-700 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="h-6 w-6 rounded border border-neutral-600"
                      style={{
                        backgroundColor: paint.color_hex || '#000000',
                      }}
                    />
                    <div>
                      <h3 className="text-lg font-semibold">{paint.name}</h3>
                      <p className="text-sm text-neutral-400">
                        {paint.manufacturer || 'Unknown brand'}
                        {paint.series ? ` • ${paint.series}` : ''}
                      </p>
                    </div>
                  </div>

                  <p className="mt-3 text-sm text-neutral-500">
                    {paint.paint_type || 'No type'}
                  </p>

                  <p className="mt-1 text-xs text-neutral-600">
                    {paint.color_hex || 'No hex value'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-neutral-400">No paints yet.</p>
          )}
        </section>
      </div>
    </main>
  )
}