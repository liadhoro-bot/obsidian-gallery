import Link from 'next/link'

type Props = {
  q: string
}

export default async function RecipesFilters({ q }: Props) {
  return (
    <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Filters</h2>
          <p className="text-sm text-neutral-400">
            Search recipes by name or description.
          </p>
        </div>

        <Link
          href="/recipes"
          className="rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm font-medium text-white hover:border-neutral-500"
        >
          Reset
        </Link>
      </div>

      <form method="GET" className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search recipes"
          className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none placeholder:text-neutral-500"
        />

        <button
          type="submit"
          className="rounded-xl bg-cyan-500 px-4 py-2 font-medium text-black hover:bg-cyan-400"
        >
          Apply
        </button>
      </form>
    </section>
  )
}