export default function VaultDiscoveryEmptyState() {
  return (
    <section className="rounded-3xl border border-dashed border-cyan-300/20 bg-[linear-gradient(180deg,rgba(8,16,24,0.96),rgba(8,16,24,0.88))] p-6 shadow-[0_0_32px_rgba(34,211,238,0.08)]">
      <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300/75">
        Start Narrow
      </p>

      <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
        Search for a paint or choose a filter
      </h2>

      <p className="mt-3 max-w-sm text-sm leading-6 text-white/65">
        Enter a paint name, scan a barcode, or narrow by brand and line before
        we load results. This keeps the first Paints view light and focused.
      </p>

      <div className="mt-5 grid gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/45 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
          Try a name
          <div className="mt-1 text-[11px] normal-case tracking-normal text-white/60">
            Mephiston Red, Ivory, Gunmetal
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
          Pick a brand
          <div className="mt-1 text-[11px] normal-case tracking-normal text-white/60">
            Narrow to one catalog line first
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
          Or scan
          <div className="mt-1 text-[11px] normal-case tracking-normal text-white/60">
            Barcode lookup jumps straight to a paint
          </div>
        </div>
      </div>
    </section>
  )
}
