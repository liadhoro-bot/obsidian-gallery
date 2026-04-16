import { createClient } from '../../utils/supabase/server'
import { redirect } from 'next/navigation'
import MobileNav from '../components/MobileNav'

export default async function DashboardPage() {
      const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }
    const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

const { data: units } = await supabase
  .from('units')
  .select('*')
  .eq('user_id', user.id)
  .eq('is_active', true)

    const { data: recipes } = await supabase
    .from('recipes')
    .select('*')
    .eq('user_id', user.id)

    const { data: paints } = await supabase
    .from('user_paint_ownership')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_owned', true)

  const featuredUnits =
    units?.filter((unit) => unit.is_featured) || []

const featuredUnitsWithProject = await Promise.all(featuredUnits.map(async (unit) => {
    const matchingProject = projects?.find(
      (project) => project.id === unit.project_id
    )
const { data: images } = await supabase
  .from('image_assets')
  .select('*')
  .eq('entity_type', 'unit')
  .eq('entity_id', unit.id)
  .eq('user_id', user.id)
  .order('created_at', { ascending: true })

const primaryImage =
  images?.find((image) => image.is_featured) || images?.[0] || null
return {
  ...unit,
  projectName: matchingProject?.name || 'Unknown project',
  primaryImage,
}
  }))

  return (
    <main className="min-h-screen bg-neutral-950 p-6 pb-28 text-white">
      <div className="mx-auto max-w-3xl">
        <MobileNav />

        <header className="mb-6">
          <p className="text-sm uppercase tracking-[0.2em] text-cyan-400">
            Obsidian Gallery
          </p>
          <h1 className="mt-2 text-3xl font-bold">Studio Dashboard</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            Track armies, manage paints, and keep your featured miniatures in view.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-sm">
            <p className="text-sm text-neutral-400">Projects</p>
            <p className="mt-2 text-2xl font-bold">{projects?.length || 0}</p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-sm">
            <p className="text-sm text-neutral-400">Units</p>
            <p className="mt-2 text-2xl font-bold">{units?.length || 0}</p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-sm">
            <p className="text-sm text-neutral-400">Recipes</p>
            <p className="mt-2 text-2xl font-bold">{recipes?.length || 0}</p>
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-sm">
            <p className="text-sm text-neutral-400">Paints</p>
            <p className="mt-2 text-2xl font-bold">{paints?.length || 0}</p>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-wider text-cyan-400">
                Studio Focus
              </p>
              <h2 className="mt-1 text-xl font-semibold">Featured Units</h2>
            </div>

            <a
              href="/"
              className="rounded-lg bg-neutral-800 px-3 py-2 text-sm text-white"
            >
              Open Projects
            </a>
          </div>

          {featuredUnitsWithProject.length > 0 ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {featuredUnitsWithProject.map((unit) => (
  <a
    key={unit.id}
    href={`/units/${unit.id}`}
    className="block rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4 transition hover:border-cyan-500"
  >
    <h3 className="text-lg font-semibold text-cyan-400">
      {unit.name}
    </h3>

    {unit.primaryImage && (
      <div className="mt-3 overflow-hidden rounded-xl border border-neutral-800">
        <img
          src={unit.primaryImage.image_url}
          alt={unit.name}
          className="h-40 w-full object-cover"
        />
      </div>
    )}

    <p className="mt-1 text-sm text-neutral-400">
      {unit.notes || 'No notes'}
    </p>

    <div className="mt-4 space-y-1 text-sm text-neutral-500">
      <p>Project: {unit.projectName}</p>
      <p>Models: {unit.model_count}</p>
    </div>
  </a>
))}
            </div>
          ) : (
            <p className="mt-4 text-neutral-400">
              No featured units yet. Open a project and mark a unit as featured.
            </p>
          )}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <a
            href="/"
            className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 transition hover:border-cyan-500"
          >
            <p className="text-sm text-neutral-400">Manage</p>
            <h3 className="mt-1 text-lg font-semibold">Projects</h3>
            <p className="mt-2 text-sm text-neutral-500">
              Add armies, units, and update painting progress.
            </p>
          </a>

          <a
            href="/vault"
            className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 transition hover:border-cyan-500"
          >
            <p className="text-sm text-neutral-400">Organize</p>
            <h3 className="mt-1 text-lg font-semibold">Paint Vault</h3>
            <p className="mt-2 text-sm text-neutral-500">
              Browse your paints with search, filters, and swatches.
            </p>
          </a>

          <a
            href="/recipes"
            className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 transition hover:border-cyan-500"
          >
            <p className="text-sm text-neutral-400">Guide</p>
            <h3 className="mt-1 text-lg font-semibold">Recipes</h3>
            <p className="mt-2 text-sm text-neutral-500">
              Save paint recipes and step-by-step miniature workflows.
            </p>
          </a>
        </section>
      </div>
    </main>
  )
}