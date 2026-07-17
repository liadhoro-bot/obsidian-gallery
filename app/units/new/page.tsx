import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import DashboardTopBar from '../../dashboard/dashboard-top-bar'
import { createClient } from '../../../utils/supabase/server'
import NewUnitForm from './new-unit-form'

export default async function NewUnitPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: projects, error: projectsError } = await supabase
    .from('projects')
    .select('id, name')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (projectsError) {
    throw new Error(projectsError.message)
  }

  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <Suspense fallback={null}>
          <DashboardTopBar userId={user.id} />
        </Suspense>

        <header>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
            Start Project / Unit
          </p>
          <h1 className="mt-2 text-3xl font-black leading-tight">
            Create a new unit
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-400">
            Start from the model on your table. This creates a project and its
            first unit in one pass.
          </p>
        </header>

        <NewUnitForm projects={projects ?? []} />
      </div>
    </main>
  )
}
