import type { ContestResult } from '../../lib/contests/types'
import NomineeCard from './nominee-card'

export default function ResultsPodium({ results }: { results: ContestResult[] }) {
  const winners = results.filter((result) => result.final_rank === 1)

  if (winners.length === 0) return null

  return (
    <section className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">
        Winner{winners.length > 1 ? 's' : ''}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {winners.map((result) =>
          result.nomination ? (
            <NomineeCard key={result.id} nomination={result.nomination} />
          ) : null
        )}
      </div>
    </section>
  )
}
