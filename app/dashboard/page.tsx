import { supabase } from '../../lib/supabase'
import NavBar from '../components/NavBar'

export default async function DashboardPage() {
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: units } = await supabase
    .from('units')
    .select('*')

  const { data: recipes } = await supabase
    .from('recipes')
    .select('*')

  const { data: paints } = await supabase
    .from('paints')
    .select('*')

  const featuredProject =
    projects?.find((project) => project.is_featured) || projects?.[0] || null

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <div className="mx-auto max-w-3xl">
        <NavBar />

        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Your studio at a glance
        </p>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border border-neutral-700 p-4">
            <p className="text-sm text-neutral-400">Projects</p>
            <p className="mt-2 text-2xl font-bold">{projects?.length || 0}</p>
          </div>

          <div className="rounded border border-neutral-700 p-4">
            <p className="text-sm text-neutral-400">Units</p>
            <p className="mt-2 text-2xl font-bold">{units?.length || 0}</p>
          </div>

          <div className="rounded border border-neutral-700 p-4">
            <p className="text-sm text-neutral-400">Recipes</p>
            <p className="mt-2 text-2xl font-bold">{recipes?.length || 0}</p>
          </div>

          <div className="rounded border border-neutral-700 p-4">
            <p className="text-sm text-neutral-400">Paints</p>
            <p className="mt-2 text-2xl font-bold">{paints?.length || 0}</p>
          </div>
        </section>

        <section className="mt-6 rounded border border-neutral-700 p-4">
          <h2 className="text-xl font-semibold">Featured Project</h2>

          {featuredProject ? (
            <div className="mt-3">
              <h3 className="text-lg font-semibold text-cyan-400">
                {featuredProject.name}
              </h3>
              <p className="mt-1 text-neutral-400">
                {featuredProject.description || 'No description'}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-neutral-400">No projects yet.</p>
          )}
        </section>
      </div>
    </main>
  )
}