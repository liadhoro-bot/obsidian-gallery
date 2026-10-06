type QueryError = { code?: string; message: string }

// Guide/deck metadata is deployed separately from the application. Keep reads
// working while an older local or preview database catches up with migrations.
export async function selectDifficultyCompatible<T extends { error: QueryError | null }>(
  selection: string,
  query: (selection: string) => PromiseLike<T>
): Promise<T> {
  let compatibleSelection = selection
  let result = await query(compatibleSelection)

  const optionalFields = ['difficulty', 'tags'] as const
  for (let attempt = 0; attempt < optionalFields.length; attempt += 1) {
    const error = result.error
    const field = optionalFields.find((candidate) => error && (
      (error.code === '42703' && new RegExp(`\\b(?:recipes|guides)(?:_\\d+)?\\.${candidate}\\b.*does not exist`, 'i').test(error.message)) ||
      (error.code === 'PGRST204' && new RegExp(`Could not find the '${candidate}' column of '(?:recipes|guides)'`, 'i').test(error.message))
    ))
    if (!field) break

    const nextSelection = compatibleSelection.replace(new RegExp(`\\b${field}\\s*,\\s*`, 'g'), '')
    if (nextSelection === compatibleSelection) break
    compatibleSelection = nextSelection
    result = await query(compatibleSelection)
  }

  return result
}
