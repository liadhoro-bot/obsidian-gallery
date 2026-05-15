import Link from 'next/link'

function SupportCard({
  title,
  description,
  icon,
  href,
}: {
  title: string
  description: string
  icon: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="flex w-full items-center gap-4 rounded-2xl bg-black/20 p-4 text-left transition hover:bg-white/[0.06]"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg">
        {icon}
      </div>

      <div className="flex-1">
        <div className="text-sm font-bold text-slate-200">{title}</div>
        <div className="mt-1 text-xs text-slate-500">{description}</div>
      </div>

      <span className="text-slate-600">›</span>
    </Link>
  )
}

export default async function SettingsSupportSection() {
  return (
    <section className="rounded-3xl border border-white/5 bg-white/[0.04] p-5">
      <h2 className="mb-1 flex items-center gap-3 text-base font-bold">
        <span className="text-cyan-300">ⓘ</span>
        App Info & Support
      </h2>

      <p className="mb-4 text-sm text-slate-500">
        Legal details, community rules, and ways to reach us.
      </p>

      <div className="space-y-3">
        <SupportCard
          icon="📜"
          title="Terms & Conditions"
          description="Rules for using Obsidian Gallery"
          href="/settings/terms"
        />

        <SupportCard
          icon="🔒"
          title="Privacy Policy"
          description="How your data and content are handled"
          href="/privacy"
        />

        <SupportCard
          icon="✉️"
          title="Contact Us"
          description="Send feedback or request help"
          href="/support"
        />
      </div>
    </section>
  )
}