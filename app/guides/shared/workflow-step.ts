// Whether a guide card becomes a step in a unit's Workflow checklist.
// recipe_steps.workflow_step holds the creator's choice; null means "use the
// default for this card type": paint lists (and covers, which are not steps)
// are reference cards, everything else is work to tick off.

const OFF_BY_DEFAULT = new Set(['cover', 'paints'])

export function isWorkflowStepByDefault(template: string | null | undefined) {
  return !OFF_BY_DEFAULT.has(template ?? 'step')
}

export function resolveWorkflowStep(
  flag: boolean | null | undefined,
  template: string | null | undefined
) {
  return typeof flag === 'boolean' ? flag : isWorkflowStepByDefault(template)
}
