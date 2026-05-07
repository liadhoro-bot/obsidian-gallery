import SubmitButton from '../components/SubmitButton'

type ProjectCreateFormProps = {
  addProjectAction: (formData: FormData) => Promise<void>
}

export default function ProjectCreateForm({
  addProjectAction,
}: ProjectCreateFormProps) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
      <div>
        <p className="text-sm uppercase tracking-wider text-cyan-400">
          New Project
        </p>
        <h2 className="mt-1 text-xl font-semibold">Create Project</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Start a new army, warband, display project, or painting collection.
        </p>
      </div>

      <form action={addProjectAction} className="mt-5 grid gap-4">
        <div>
          <label className="text-sm font-medium text-neutral-300">
            Project name
          </label>
          <input
            name="name"
            required
            placeholder="Example: Tomb Kings Army"
            className="mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-cyan-500"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-neutral-300">
            Description
          </label>
          <textarea
            name="description"
            rows={4}
            placeholder="What are you building or painting?"
            className="mt-2 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-cyan-500"
          />
        </div>

        <SubmitButton
          idleText="Create project"
          pendingText="Creating project..."
          className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-neutral-950 shadow-lg shadow-cyan-500/20"
        />
      </form>
    </section>
  )
}