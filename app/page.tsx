import { supabase } from '../lib/supabase'
import MobileNav from './components/MobileNav'
import { revalidatePath } from 'next/cache'

async function addProject(formData: FormData) {
  'use server'

  const name = formData.get('name')?.toString().trim()
  const description = formData.get('description')?.toString().trim() || null

  if (!name) return

  const { error } = await supabase.from('projects').insert([
    {
      name,
      description,
    },
  ])

  if (error) {
    console.error('Error adding project:', error)
    return
  }

  revalidatePath('/')
}

export default async function Home() {
  const { data: projects, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: false })

  return (
<main className="min-h-screen bg-neutral-950 p-6 pb-28 text-white">
      <div className="mx-auto max-w-xl">
<MobileNav />
        <h1 className="text-3xl font-bold">Obsidian Gallery</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Projects V1
        </p>

        <section className="mt-8 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
          <h2 className="text-xl font-semibold">Add Project</h2>

          <form action={addProject} className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Project Name
              </label>
              <input
                name="name"
                type="text"
                required
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none"
                placeholder="e.g. Tomb Kings Army"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-neutral-300">
                Description
              </label>
              <textarea
                name="description"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-white outline-none"
                placeholder="Optional notes"
                rows={3}
              />
            </div>

            <button
              type="submit"
              className="rounded-lg bg-cyan-500 px-4 py-2 font-medium text-black"
            >
              Add Project
            </button>
          </form>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold">Your Projects</h2>
{error ? (
  <pre className="mt-4 whitespace-pre-wrap rounded bg-red-100 p-4 text-sm text-black">
    {JSON.stringify(error, null, 2)}
  </pre>
) : projects && projects.length > 0 ? (
  <div className="mt-4 space-y-3">
    {projects.map((project) => (
      <div
        key={project.id}
        className="rounded-xl border border-neutral-800 bg-neutral-900 p-4"
      >
        <a href={`/projects/${project.id}`} className="block">
          <h3 className="text-lg font-semibold text-cyan-400">
            {project.name}
          </h3>
          <p className="mt-1 text-sm text-neutral-400">
            {project.description || 'No description'}
          </p>
        </a>
      </div>
    ))}
  </div>
) : (
  <p className="mt-4 text-neutral-400">No projects yet.</p>
)}
        </section>
      </div>
    </main>
  )
}