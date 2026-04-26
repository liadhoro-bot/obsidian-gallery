function SupportCard({
  title,
  description,
  icon,
}: {
  title: string
  description: string
  icon: string
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-4 rounded-2xl bg-black/20 p-4 text-left"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg">
        {icon}
      </div>

      <div>
        <div className="text-sm font-bold text-slate-200">{title}</div>
        <div className="mt-1 text-xs text-slate-500">{description}</div>
      </div>
    </button>
  )
}

export default async function SettingsSupportSection() {
  return (
    <section className="rounded-3xl border border-white/5 bg-white/[0.04] p-5">
      <h2 className="mb-4 flex items-center gap-3 text-base font-bold">
        <span className="text-yellow-300">?</span>
        Help & Support
      </h2>

      <div className="space-y-3">
        <SupportCard
          icon="?"
          title="Frequently Asked Questions"
          description="Find quick answers to common issues"
        />

        <SupportCard
          icon="☏"
          title="Contact Support"
          description="Send feedback or request help"
        />
      </div>
    </section>
  )
}