export function isContestSchemaMissing(
  error: { code?: string; message?: string } | null
) {
  if (!error) return false

  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    Boolean(
      error.message?.includes('contest_') ||
        error.message?.includes('contests') ||
        error.message?.includes('schema cache')
    )
  )
}
