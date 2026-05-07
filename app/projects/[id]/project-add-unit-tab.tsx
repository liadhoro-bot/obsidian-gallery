import SubmitButton from '../../components/SubmitButton'

type Props = {
  projectId: string
  addUnitAction: (formData: FormData) => Promise<void>
}

export default function ProjectAddUnitTab({
  projectId,
  addUnitAction,
}: Props) {
  return (
    <section className="mt-5 rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 to-neutral-950 p-5 shadow-sm">
      <p className="text-sm uppercase tracking-wider text-cyan-400">
        Add Unit
      </p>
      <h2 className="mt-1 text-xl font-semibold">Create a New Unit</h2>
      <p className="mt-2 text-sm text-neutral-400">
        Add a unit, squad, character, vehicle, or display piece to this project.
      </p>

      <form action={addUnitAction} className="mt-5 space-y-4">
        <input type="hidden" name="projectId" value={projectId} />

        <div>
          <label className="mb-1 block text-sm text-neutral-300">
            Unit Name
          </label>
          <input
            name="name"
            type="text"
            required
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-white outline-none transition focus:border-cyan-500"
            placeholder="e.g. Skeleton Warriors"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-neutral-300">
            Model Count
          </label>
          <input
            name="modelCount"
            type="number"
            min="1"
            defaultValue="1"
            className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-white outline-none transition focus:border-cyan-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-neutral-300">
            Notes
          </label>
          <textarea
            name="notes"
            rows={4}
            className="w-full resize-none rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3 text-white outline-none transition focus:border-cyan-500"
            placeholder="Optional notes"
          />
        </div>

        <SubmitButton
          idleText="Add Unit"
          pendingText="Adding unit..."
          className="w-full rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-black shadow-lg shadow-cyan-500/20"
        />
      </form>
    </section>
  )
}