export type RankedTotal = {
  id: string
  totalPoints: number
}

export function assignDenseRanks<T extends RankedTotal>(rows: T[]) {
  const sorted = [...rows].sort((a, b) => b.totalPoints - a.totalPoints)
  let currentRank = 0
  let previousPoints: number | null = null

  return sorted.map((row, index) => {
    if (previousPoints === null || row.totalPoints !== previousPoints) {
      currentRank = index + 1
      previousPoints = row.totalPoints
    }

    return {
      ...row,
      finalRank: currentRank,
      isTied: sorted.some(
        (candidate) =>
          candidate.id !== row.id && candidate.totalPoints === row.totalPoints
      ),
    }
  })
}

export function getRankedPoints(maximumSelections: number, rank: number) {
  return Math.max(0, maximumSelections - rank + 1)
}
