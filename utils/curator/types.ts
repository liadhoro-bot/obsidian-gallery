export type DashboardCuratorState = {
  projectsCount: number
  unitsCount: number
  sessionsCount: number
  sessionsThisWeek: number
  daysSinceLastSession: number | null
  deadlineWithinDays: number | null
  unitProgress: number | null
}

export type DashboardCuratorPrompt = {
  ruleKey: string
  category: string
  templateId: string
  templateKey: string
  title: string
  body: string
  bodyLines?: string[]
  ctaLabel: string
  ctaHref: string
  autoOpen: boolean
  state: DashboardCuratorState
}

export type CuratorMessageEventType = 'shown' | 'dismissed' | 'cta_clicked'
