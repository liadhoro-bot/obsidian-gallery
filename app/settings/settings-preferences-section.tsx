export default async function SettingsPreferencesSection() {
  return (
    <section className="rounded-3xl border border-white/5 bg-white/[0.04] p-5">
      <h2 className="mb-4 flex items-center gap-3 text-base font-bold">
        <span className="text-orange-400">☷</span>
        App Preferences
      </h2>

      <div className="flex items-center justify-between py-3">
        <span className="text-sm font-semibold text-slate-200">Dark Mode</span>

        <button
          type="button"
          className="relative h-7 w-12 rounded-full bg-cyan-400"
          title="Theme toggle placeholder"
        >
          <span className="absolute right-1 top-1 h-5 w-5 rounded-full bg-slate-900" />
        </button>
      </div>

      <div className="flex items-center justify-between py-3">
        <span className="text-sm font-semibold text-slate-200">Language</span>
        <span className="text-sm text-slate-400">English</span>
      </div>

      <div className="flex items-center justify-between py-3">
        <span className="text-sm font-semibold text-slate-200">
          Units of Measure
        </span>
        <span className="text-sm text-slate-400">Metric</span>
      </div>
    </section>
  )
}