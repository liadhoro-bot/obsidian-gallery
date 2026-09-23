type QueryError = { code?: string; message: string }

// Difficulty is optional metadata introduced by 20260923200000_add_difficulty.
// Keep reads working while application and database releases are out of sync.
export async function selectDifficultyCompatible<T extends { error: QueryError | null }>(
  selection: string,
  query: (selection: string) => PromiseLike<T>
): Promise<T> {
  const result = await query(selection)
  const error = result.error
  const missingDifficulty = error && (
    (error.code === '42703' && /\b(?:recipes|guides)(?:_\d+)?\.difficulty\b.*does not exist/i.test(error.message)) ||
    (error.code === 'PGRST204' && /Could not find the 'difficulty' column of '(?:recipes|guides)'/i.test(error.message))
  )
  if (!missingDifficulty) return result

  return query(selection.replace(/\bdifficulty\s*,\s*/g, ''))
}
