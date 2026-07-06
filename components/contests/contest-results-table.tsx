import type { Contest, ContestResult } from '../../lib/contests/types'

export default function ContestResultsTable({
  contest,
  results,
}: {
  contest: Contest
  results: ContestResult[]
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10">
      <table className="w-full text-left text-sm">
        <thead className="bg-white/[0.06] text-xs uppercase tracking-[0.12em] text-white/45">
          <tr>
            <th className="px-3 py-3">Rank</th>
            <th className="px-3 py-3">Nominee</th>
            <th className="px-3 py-3">
              {contest.voting_method === 'ranked' ? 'Points' : 'Votes'}
            </th>
            <th className="px-3 py-3">Selections</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10">
          {results.map((result) => (
            <tr key={result.id}>
              <td className="px-3 py-3 font-black">
                {result.final_rank}
                {result.is_tied ? ' T' : ''}
              </td>
              <td className="px-3 py-3">
                <div className="font-bold">
                  {result.nomination?.snapshot_title || 'Nominee'}
                </div>
                <div className="text-xs text-white/40">
                  {result.nomination?.snapshot_owner_display_name}
                </div>
              </td>
              <td className="px-3 py-3">{result.total_points}</td>
              <td className="px-3 py-3">{result.selection_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
