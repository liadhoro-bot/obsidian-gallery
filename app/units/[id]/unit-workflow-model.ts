// Shared (client + server) shape of a unit's guide-driven workflow.

export type UnitWorkflowGuide = {
  // `guide:<id>` or `deck:<id>` - steps point back to it through guideKey.
  key: string
  type: 'guide' | 'deck'
  id: string
  title: string
  image: string
  href: string
  stepCount: number
}

export type UnitWorkflowStep = {
  // recipe_steps.id - the guide card this step is.
  id: string
  guideKey: string
  title: string
  done: boolean
  completedAt: string | null
}

export type UnitWorkflow = {
  guides: UnitWorkflowGuide[]
  steps: UnitWorkflowStep[]
  completed: number
  total: number
  // False until the unit_guide_step_completions migration is applied.
  trackingAvailable: boolean
}

export const EMPTY_UNIT_WORKFLOW: UnitWorkflow = {
  guides: [],
  steps: [],
  completed: 0,
  total: 0,
  trackingAvailable: true,
}

/**
 * past -> current -> next. Current is the first unfinished step in order;
 * last completed is the finished step right before it (or, when everything
 * before it is open, the most recently ticked step anywhere).
 */
export function summarizeWorkflow(steps: UnitWorkflowStep[], upcomingCount = 1) {
  const currentIndex = steps.findIndex((step) => !step.done)
  const current = currentIndex === -1 ? null : steps[currentIndex]
  const before = currentIndex === -1 ? steps : steps.slice(0, currentIndex)
  const lastInOrder = [...before].reverse().find((step) => step.done) ?? null
  const lastCompleted =
    lastInOrder ??
    [...steps]
      .filter((step) => step.done && step.completedAt)
      .sort((a, b) => Date.parse(b.completedAt ?? '') - Date.parse(a.completedAt ?? ''))[0] ??
    null
  const upcoming =
    currentIndex === -1
      ? []
      : steps.slice(currentIndex + 1).filter((step) => !step.done).slice(0, upcomingCount)

  return { lastCompleted, current, upcoming }
}

export function withStepDone(workflow: UnitWorkflow, stepId: string, done: boolean): UnitWorkflow {
  const steps = workflow.steps.map((step) =>
    step.id === stepId
      ? { ...step, done, completedAt: done ? new Date().toISOString() : null }
      : step
  )
  return { ...workflow, steps, completed: steps.filter((step) => step.done).length }
}
