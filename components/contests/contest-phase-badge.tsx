import { getPhaseLabel } from '../../lib/contests/phases'
import type { ContestPhase } from '../../lib/contests/types'

const phaseClassName: Record<ContestPhase, string> = {
  draft: 'border-slate-400/30 bg-slate-400/10 text-slate-200',
  upcoming: 'border-blue-300/30 bg-blue-300/10 text-blue-100',
  submissions_open: 'border-cyan-300/40 bg-cyan-300/12 text-cyan-100',
  moderation: 'border-amber-300/35 bg-amber-300/10 text-amber-100',
  voting_open: 'border-emerald-300/40 bg-emerald-300/10 text-emerald-100',
  voting_closed: 'border-white/20 bg-white/10 text-white/75',
  results_published: 'border-fuchsia-300/35 bg-fuchsia-300/10 text-fuchsia-100',
  cancelled: 'border-red-300/35 bg-red-300/10 text-red-100',
  archived: 'border-white/15 bg-white/[0.04] text-white/50',
}

export default function ContestPhaseBadge({ phase }: { phase: ContestPhase }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${phaseClassName[phase]}`}
    >
      {getPhaseLabel(phase)}
    </span>
  )
}
