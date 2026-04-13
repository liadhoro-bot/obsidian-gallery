'use client'

import { useState } from 'react'

type Props = {
  addProjectAction: (formData: FormData) => Promise<void>
}

export default function ProjectsPageClient({ addProjectAction }: Props) {
  const [isAddingProject, setIsAddingProject] = useState(false)

  return (
    <div>
      {!isAddingProject ? (
        <button
          type="button"
          onClick={() => setIsAddingProject(true)}
          className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-cyan-400"
        >
          Add Project
        </button>
      ) : (
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4 shadow-sm">
          <form action={addProjectAction} className="space-y-4">
            <div>
              <label
                htmlFor="name"
                className="mb-1 block text-sm font-medium text-neutral-200"
              >
                Project name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="For example: Tomb Kings"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500"
              />
            </div>

            <div>
              <label
                htmlFor="description"
                className="mb-1 block text-sm font-medium text-neutral-200"
              >
                Description (optional)
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                placeholder="Optional short description"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-cyan-400"
              >
                Create Project
              </button>

              <button
                type="button"
                onClick={() => setIsAddingProject(false)}
                className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-white transition hover:bg-neutral-700"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}