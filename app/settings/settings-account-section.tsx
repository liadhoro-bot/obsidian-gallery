function SettingsRow({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between py-3 text-left text-sm font-semibold text-slate-200"
    >
      <span>{label}</span>
      <span className="text-lg text-slate-500">›</span>
    </button>
  )
}

export default async function SettingsAccountSection() {
  return (
    <section className="rounded-3xl border border-white/5 bg-white/[0.04] p-5">
      <h2 className="mb-4 flex items-center gap-3 text-base font-bold">
        <span className="text-cyan-400">◉</span>
        Account Settings
      </h2>

      <SettingsRow label="Change Password" />
      <SettingsRow label="Notification Preferences" />
      <SettingsRow label="Privacy & Data" />
    </section>
  )
}