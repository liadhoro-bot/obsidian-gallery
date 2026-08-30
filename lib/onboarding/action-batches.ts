export function selectVisibleOnboardingActionBatch<
  TAction extends { completedAt: string | null },
>(actions: TAction[], batchSize = 3) {
  const actionBatches = Array.from(
    { length: Math.ceil(actions.length / batchSize) },
    (_, index) => actions.slice(index * batchSize, index * batchSize + batchSize)
  )

  return (
    actionBatches.find((batch) =>
      batch.some((action) => !action.completedAt)
    ) ??
    actionBatches.at(-1) ??
    []
  )
}
