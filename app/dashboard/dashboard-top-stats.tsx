import Link from 'next/link'
import { createClient } from '../../utils/supabase/server'

export default async function DashboardTopStats() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const [projectsResult, unitsResult, recipesResult] = await Promise.all([
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),

    supabase
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),

    supabase
      .from('recipes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ])

  const projectCount = projectsResult.count ?? 0
  const unitCount = unitsResult.count ?? 0
  const recipeCount = recipesResult.count ?? 0

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-white/60">Projects</p>
          <p className="mt-2 text-2xl font-semibold">{projectCount}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-white/60">Units</p>
          <p className="mt-2 text-2xl font-semibold">{unitCount}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm text-white/60">Recipes</p>
          <p className="mt-2 text-2xl font-semibold">{recipeCount}</p>
        </div>

        <Link
          href="/projects"
          className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
        >
          <p className="text-sm text-white/60">Go to</p>
          <p className="mt-2 text-lg font-semibold">Projects →</p>
        </Link>
      </div>
    </section>
  )
}