import { VaultFiltersSkeleton, VaultGridSkeleton } from './vault-skeletons'

export default function VaultLoading() {
  return (
    <main className="min-h-screen bg-[#081018] text-white">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-24 pt-5">
        <div className="h-12 animate-pulse rounded-full bg-white/10" />

        <section>
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-cyan-400">
            Inventory Management
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white">
            The Paint Vault
          </h1>
          <p className="mt-4 text-base leading-7 text-neutral-400">
            Your curated collection of premium pigments and mediums. Organised
            for high-speed reference and palette synchronization.
          </p>
        </section>

        <div className="grid grid-cols-3 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          <div className="h-10 rounded-xl bg-white/10" />
          <div className="h-10 rounded-xl bg-white/10" />
          <div className="h-10 rounded-xl bg-white/10" />
        </div>

        <VaultFiltersSkeleton />
        <VaultGridSkeleton />
      </div>
    </main>
  )
}
