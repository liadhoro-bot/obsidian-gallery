'use client'

import Image from 'next/image'
import { FormEvent, useMemo, useState } from 'react'
import AppHamburgerMenu from '../components/app-hamburger-menu'
import FeatureGuideTour from '../components/feature-guide-tour'
import { findVisibleFeatureGuideIndex } from '../components/feature-guide-navigation'
import V3PerfIndicator from '../components/v3-perf-indicator'
import type { FeatureGuideEntry } from '../components/feature-guide-types'
import styles from './projects-v3-silver.module.css'
import type {
  ProjectsV3Project,
  ProjectsV3Unit,
} from './projects-v3-data'

type ProjectsTab = 'projects' | 'units'
type ProjectsSort = 'name-asc' | 'name-desc' | 'deadline' | 'recent' | 'status'
type ViewMode = 'cards' | 'grid'

type PreviewProject = ProjectsV3Project
type PreviewUnit = ProjectsV3Unit

const initialProjects: PreviewProject[] = [
  {
    id: 'gloomhaven',
    name: 'Gloomhaven 2nd ed.',
    description: 'Campaign enemies, bosses, and table-ready display forces.',
    type: 'Board Game',
    due: 'May 30, 2026',
    image: '/onboarding/pains/fragmentation.jpeg',
    palette: ['#173235', '#264a56', '#d7c399', '#8f9fd9', '#111417'],
  },
  {
    id: 'desert-table',
    name: 'Desert Table',
    description: 'Scenery, basing tests, and terrain pieces for a dry battlefield.',
    type: 'Terrain',
    image: '/onboarding/pains/pile-of-shame.jpeg',
    palette: ['#37665b', '#d6a73a', '#e1c58d', '#7a5d37', '#171815'],
  },
  {
    id: 'samurai-pizza-cats',
    name: 'Samurai Pizza Cats',
    description: 'Hero models, mascot tests, and bright character work.',
    type: 'Display Force',
    due: 'May 23, 2026',
    image: '/onboarding/first-project-bg.jpeg',
    palette: ['#8f9fd9', '#17b9c2', '#a92322', '#d8bd83', '#111417'],
  },
  {
    id: 'golden-automaton',
    name: 'Golden Automaton',
    description: 'Warm metal experiments and clockwork centerpiece units.',
    type: 'Warband',
    image: '/onboarding/pains/tough-choices.jpeg',
    palette: ['#d6a73a', '#d29631', '#243447', '#17b9c2', '#111417'],
  },
]

const initialUnits: PreviewUnit[] = [
  {
    id: 'guido',
    name: 'Guido',
    projectId: 'samurai-pizza-cats',
    image: '/onboarding/first-project-bg.jpeg',
    status: 'Active',
    progress: 40,
    stage: 'Stage 2/6',
    deadline: '2026-05-23',
    logged: '2h 58m',
    updatedAt: '2026-07-21',
    modelCount: 1,
    palette: ['#a92322', '#d6b84d', '#171821', '#e1c58d', '#72c888'],
  },
  {
    id: 'storm-chapel',
    name: 'Storm Chapel',
    projectId: 'gloomhaven',
    image: '/onboarding/pains/tough-choices.jpeg',
    status: 'Active',
    progress: 15,
    stage: 'Stage 1/5',
    deadline: '2026-06-04',
    logged: '38m',
    updatedAt: '2026-07-18',
    modelCount: 4,
    palette: ['#1e2834', '#9aafbd', '#d8bd83', '#22d3ee', '#a92322'],
  },
  {
    id: 'ashen-patrol',
    name: 'Ashen Patrol',
    projectId: 'desert-table',
    image: '/onboarding/pains/paint-management.jpeg',
    status: 'Active',
    progress: 28,
    stage: 'Stage 2/5',
    deadline: '2026-06-11',
    logged: '1h 12m',
    updatedAt: '2026-07-16',
    modelCount: 3,
    palette: ['#171815', '#7a5d37', '#efe3c5', '#4eb282', '#5aa7c9'],
  },
  {
    id: 'copper-warden',
    name: 'Copper Warden',
    projectId: 'golden-automaton',
    image: '/onboarding/pains/scheme-loss.jpeg',
    status: 'Active',
    progress: 52,
    stage: 'Stage 3/6',
    deadline: '2026-06-20',
    logged: '3h 24m',
    updatedAt: '2026-07-24',
    modelCount: 1,
    palette: ['#d29631', '#7a5d37', '#111417', '#17b9c2', '#efe3c5'],
  },
  {
    id: 'night-market',
    name: 'Night Market',
    projectId: 'samurai-pizza-cats',
    image: '/onboarding/pains/pile-of-shame.jpeg',
    status: 'Active',
    progress: 63,
    stage: 'Stage 4/6',
    deadline: '2026-07-02',
    logged: '4h 06m',
    updatedAt: '2026-07-26',
    modelCount: 2,
    palette: ['#111417', '#5943a7', '#5aa7c9', '#d8bd83', '#b51d20'],
  },
  {
    id: 'mindthief',
    name: 'Mindthief',
    projectId: 'gloomhaven',
    image: '/onboarding/pains/fragmentation.jpeg',
    status: 'Bench',
    progress: 8,
    stage: 'Planning',
    deadline: '2026-08-14',
    logged: '12m',
    updatedAt: '2026-07-10',
    modelCount: 1,
    palette: ['#173235', '#8f9fd9', '#d7c399', '#111417', '#22d3ee'],
  },
]

export default function ProjectsV3Preview({
  featureGuides = [],
  initialProjects: liveProjects,
  initialUnits: liveUnits,
}: {
  featureGuides?: FeatureGuideEntry[]
  initialProjects?: PreviewProject[]
  initialUnits?: PreviewUnit[]
}) {
  const defaultUnitProjectId = liveProjects
    ? liveProjects[0]?.id ?? 'unfiled'
    : initialProjects[0].id
  const [activeTab, setActiveTab] = useState<ProjectsTab>('projects')
  const [projects, setProjects] = useState(
    liveProjects ?? initialProjects
  )
  const [units, setUnits] = useState(
    liveUnits ?? initialUnits
  )
  const [activeGuideIndex, setActiveGuideIndex] = useState<number | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [projectType, setProjectType] = useState('Warband')
  const [projectDueDate, setProjectDueDate] = useState('')
  const [unitName, setUnitName] = useState('')
  const [unitProjectId, setUnitProjectId] = useState(defaultUnitProjectId)
  const [unitDeadline, setUnitDeadline] = useState('')
  const [projectSearch, setProjectSearch] = useState('')
  const [projectSort, setProjectSort] = useState<ProjectsSort>('recent')
  const [projectView, setProjectView] = useState<ViewMode>('cards')
  const [projectPageIndex, setProjectPageIndex] = useState(0)
  const [unitSearch, setUnitSearch] = useState('')
  const [unitSort, setUnitSort] = useState<ProjectsSort>('recent')
  const [unitView, setUnitView] = useState<ViewMode>('grid')
  const [unitPageIndex, setUnitPageIndex] = useState(0)

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  )

  const unitsByProjectId = useMemo(() => {
    const grouped = new Map<string, PreviewUnit[]>()
    for (const unit of units) {
      grouped.set(unit.projectId, [...(grouped.get(unit.projectId) ?? []), unit])
    }
    return grouped
  }, [units])

  const sortedProjects = useMemo(() => {
    const normalizedSearch = projectSearch.trim().toLowerCase()
    const filteredProjects = projects.filter((project) => {
      const childUnitNames = (unitsByProjectId.get(project.id) ?? [])
        .map((unit) => unit.name)
        .join(' ')

      return `${project.name} ${childUnitNames}`
        .toLowerCase()
        .includes(normalizedSearch)
    })

    return [...filteredProjects].sort((first, second) => {
      const firstUnits = unitsByProjectId.get(first.id) ?? []
      const secondUnits = unitsByProjectId.get(second.id) ?? []

      if (projectSort === 'name-asc') return first.name.localeCompare(second.name)
      if (projectSort === 'name-desc') return second.name.localeCompare(first.name)
      if (projectSort === 'deadline') {
        return getProjectDeadlineTime(first, firstUnits) - getProjectDeadlineTime(second, secondUnits)
      }
      if (projectSort === 'status') {
        return getStatusRank(getProjectStatusLabel(firstUnits)) - getStatusRank(getProjectStatusLabel(secondUnits))
      }

      return getLatestUnitUpdateTime(secondUnits) - getLatestUnitUpdateTime(firstUnits)
    })
  }, [projectSearch, projectSort, projects, unitsByProjectId])

  const sortedUnits = useMemo(() => {
    const normalizedSearch = unitSearch.trim().toLowerCase()
    const filteredUnits = units.filter((unit) => {
      const projectName = projectById.get(unit.projectId)?.name ?? ''
      return `${unit.name} ${projectName}`
        .toLowerCase()
        .includes(normalizedSearch)
    })

    return [...filteredUnits].sort((first, second) => {
      if (unitSort === 'name-asc') return first.name.localeCompare(second.name)
      if (unitSort === 'name-desc') return second.name.localeCompare(first.name)
      if (unitSort === 'deadline') {
        return getDateTime(first.deadline) - getDateTime(second.deadline)
      }
      if (unitSort === 'status') return getStatusRank(first.status) - getStatusRank(second.status)
      return getDateTime(second.updatedAt) - getDateTime(first.updatedAt)
    })
  }, [projectById, unitSearch, unitSort, units])

  const projectPageSize = getPageSize('projects', projectView)
  const projectPageCount = Math.max(1, Math.ceil(sortedProjects.length / projectPageSize))
  const normalizedProjectPageIndex = Math.min(projectPageIndex, projectPageCount - 1)
  const visibleProjects = sortedProjects.slice(
    normalizedProjectPageIndex * projectPageSize,
    normalizedProjectPageIndex * projectPageSize + projectPageSize
  )
  const unitPageSize = getPageSize('units', unitView)
  const unitPageCount = Math.max(1, Math.ceil(sortedUnits.length / unitPageSize))
  const normalizedUnitPageIndex = Math.min(unitPageIndex, unitPageCount - 1)
  const visibleUnits = sortedUnits.slice(
    normalizedUnitPageIndex * unitPageSize,
    normalizedUnitPageIndex * unitPageSize + unitPageSize
  )

  const projectPreviewName = projectName.trim() || 'New Project'
  const unitPreviewName = unitName.trim() || 'New Unit'
  const activeGuide =
    activeGuideIndex === null ? null : featureGuides[activeGuideIndex] ?? null

  function openCreate() {
    setActiveGuideIndex(null)
    setIsCreateOpen(true)
  }

  function startFeatureTour() {
    if (!featureGuides.length) return
    setIsCreateOpen(false)
    setActiveGuideIndex(findVisibleFeatureGuideIndex(featureGuides, null, 1) ?? 0)
  }

  function closeFeatureTour() {
    setActiveGuideIndex(null)
  }

  function showPreviousGuide() {
    setActiveGuideIndex((current) =>
      findVisibleFeatureGuideIndex(featureGuides, current, -1) ?? current ?? 0
    )
  }

  function showNextGuide() {
    setActiveGuideIndex((current) =>
      findVisibleFeatureGuideIndex(featureGuides, current, 1) ?? current ?? 0
    )
  }

  function showPreviousProjectsPage() {
    setProjectPageIndex((current) =>
      current === 0 ? projectPageCount - 1 : current - 1
    )
  }

  function showNextProjectsPage() {
    setProjectPageIndex((current) =>
      current + 1 >= projectPageCount ? 0 : current + 1
    )
  }

  function showPreviousUnitsPage() {
    setUnitPageIndex((current) => (current === 0 ? unitPageCount - 1 : current - 1))
  }

  function showNextUnitsPage() {
    setUnitPageIndex((current) => (current + 1 >= unitPageCount ? 0 : current + 1))
  }

  function createPreviewProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextProject: PreviewProject = {
      id: `preview-project-${Date.now()}`,
      name: projectPreviewName,
      description: `${projectType} collection ready for units.`,
      type: projectType,
      due: projectDueDate || undefined,
      image: '/onboarding/pains/paint-management.jpeg',
      palette: ['#22d3ee', '#d6a73a', '#111417', '#8f9fd9', '#37665b'],
    }

    setProjects((currentProjects) => [nextProject, ...currentProjects])
    setProjectName('')
    setProjectType('Warband')
    setProjectDueDate('')
    setUnitProjectId(nextProject.id)
    setIsCreateOpen(false)
  }

  function createPreviewUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextUnit: PreviewUnit = {
      id: `preview-unit-${Date.now()}`,
      name: unitPreviewName,
      projectId: unitProjectId,
      image: '/onboarding/pains/paint-management.jpeg',
      status: 'Active',
      progress: 0,
      stage: 'Planning',
      deadline: unitDeadline || '2026-08-01',
      logged: '0m',
      updatedAt: '2026-07-31',
      modelCount: 1,
      palette: ['#22d3ee', '#111417', '#d6a73a', '#8f9fd9', '#37665b'],
    }

    setUnits((currentUnits) => [nextUnit, ...currentUnits])
    setUnitName('')
    setUnitDeadline('')
    setActiveTab('units')
    setIsCreateOpen(false)
  }

  return (
    <main
      className={styles.projectsSilver}
      data-v3-projects-indicator="root"
      data-v3-projects-source={liveProjects || liveUnits ? 'live' : 'fallback'}
    >
      <V3PerfIndicator surface="projects" detail={activeTab} />
      <div
        className="mx-auto flex w-full max-w-md flex-col gap-3 px-3 pb-28 pt-6"
      >
        <ProjectsHeader
          activeTab={activeTab}
          isHelpOpen={activeGuide !== null}
          onCreate={openCreate}
          onHelpToggle={startFeatureTour}
        />

        <Tabs activeTab={activeTab} onTabChange={setActiveTab} />

        {activeTab === 'projects' ? (
          <ProjectsTab
            onNextPage={showNextProjectsPage}
            onPreviousPage={showPreviousProjectsPage}
            onSearchChange={(query) => {
              setProjectSearch(query)
              setProjectPageIndex(0)
            }}
            onSortChange={(nextSort) => {
              setProjectSort(nextSort)
              setProjectPageIndex(0)
            }}
            onViewChange={(nextView) => {
              setProjectView(nextView)
              setProjectPageIndex(0)
            }}
            pageCount={projectPageCount}
            pageIndex={normalizedProjectPageIndex}
            projects={visibleProjects}
            search={projectSearch}
            sort={projectSort}
            totalCount={sortedProjects.length}
            unitsByProjectId={unitsByProjectId}
            view={projectView}
          />
        ) : null}

        {activeTab === 'units' ? (
          <UnitsTab
            onNextPage={showNextUnitsPage}
            onPreviousPage={showPreviousUnitsPage}
            onSearchChange={(query) => {
              setUnitSearch(query)
              setUnitPageIndex(0)
            }}
            onSortChange={(nextSort) => {
              setUnitSort(nextSort)
              setUnitPageIndex(0)
            }}
            onViewChange={(nextView) => {
              setUnitView(nextView)
              setUnitPageIndex(0)
            }}
            pageCount={unitPageCount}
            pageIndex={normalizedUnitPageIndex}
            projectById={projectById}
            projects={projects}
            search={unitSearch}
            sort={unitSort}
            totalCount={sortedUnits.length}
            units={visibleUnits}
            view={unitView}
          />
        ) : null}
      </div>

      {isCreateOpen ? (
        activeTab === 'projects' ? (
          <CreateProjectSheet
            dueDate={projectDueDate}
            name={projectName}
            previewName={projectPreviewName}
            projectType={projectType}
            onClose={() => setIsCreateOpen(false)}
            onDueDateChange={setProjectDueDate}
            onNameChange={setProjectName}
            onProjectTypeChange={setProjectType}
            onSubmit={createPreviewProject}
          />
        ) : (
          <CreateUnitSheet
            deadline={unitDeadline}
            name={unitName}
            previewName={unitPreviewName}
            projectId={unitProjectId}
            projects={projects}
            onClose={() => setIsCreateOpen(false)}
            onDeadlineChange={setUnitDeadline}
            onNameChange={setUnitName}
            onProjectChange={setUnitProjectId}
            onSubmit={createPreviewUnit}
          />
        )
      ) : null}

      {activeGuide !== null && activeGuideIndex !== null ? (
        <FeatureGuideTour
          activeIndex={activeGuideIndex}
          guide={activeGuide}
          onClose={closeFeatureTour}
          onNext={showNextGuide}
          onPrevious={showPreviousGuide}
          totalGuides={featureGuides.length}
        />
      ) : null}
    </main>
  )
}

function HelpIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M9.6 9a2.6 2.6 0 0 1 4.95 1.15c0 1.75-1.55 2.25-2.25 3.3-.22.33-.3.68-.3 1.05" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M12 18h.01" stroke="currentColor" strokeLinecap="round" strokeWidth="2.6" />
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  )
}

function ProjectsHeader({
  activeTab,
  isHelpOpen,
  onCreate,
  onHelpToggle,
}: {
  activeTab: ProjectsTab
  isHelpOpen: boolean
  onCreate: () => void
  onHelpToggle: () => void
}) {
  return (
    <header data-v3-projects-indicator="app-header">
      <AppHamburgerMenu
        data-v3-projects-indicator="menu-control"
        aria-label="Open projects menu"
      />

      <h1
        data-v3-projects-indicator="app-title"
        data-feature-guide-target="projects.page"
      >
        Projects
      </h1>

      <div data-v3-projects-indicator="app-header-actions">
        <button
          type="button"
          aria-expanded={isHelpOpen}
          aria-controls="projects-help"
          aria-label="About projects and units"
          onClick={onHelpToggle}
          data-feature-guide-target="projects.help"
        >
          <HelpIcon />
        </button>
        <button
          type="button"
          aria-label={activeTab === 'projects' ? 'Create project' : 'Create unit'}
          onClick={onCreate}
          data-feature-guide-target="projects.create_button"
        >
          <PlusIcon />
        </button>
      </div>
    </header>
  )
}

function Tabs({
  activeTab,
  onTabChange,
}: {
  activeTab: ProjectsTab
  onTabChange: (tab: ProjectsTab) => void
}) {
  return (
    <div
      className="grid grid-cols-2 rounded-[8px] border border-white/[0.04] bg-white/[0.055] p-0.5"
      role="tablist"
      aria-label="Project sections"
    >
      {(['projects', 'units'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={activeTab === tab}
          data-feature-guide-target={
            tab === 'projects' ? 'projects.tabs.projects' : 'projects.tabs.units'
          }
          onClick={() => onTabChange(tab)}
          className={[
            'h-9 rounded-[6px] text-xs font-black capitalize transition',
            activeTab === tab
              ? 'bg-[#101822] text-cyan-300 shadow-[inset_0_0_24px_rgba(34,211,238,0.06)]'
              : 'text-white/38 hover:text-white/70',
          ].join(' ')}
        >
          {tab}
        </button>
      ))}
    </div>
  )
}

const sortOptions: Array<{ label: string; value: ProjectsSort }> = [
  { label: 'Name A-Z', value: 'name-asc' },
  { label: 'Name Z-A', value: 'name-desc' },
  { label: 'Deadline', value: 'deadline' },
  { label: 'Recently updated', value: 'recent' },
  { label: 'Status', value: 'status' },
]

function SearchSortToolbar({
  children,
  onSearchChange,
  onSortChange,
  onViewChange,
  search,
  searchLabel,
  searchPlaceholder,
  sort,
  view,
}: {
  children?: React.ReactNode
  onSearchChange: (query: string) => void
  onSortChange: (sort: ProjectsSort) => void
  onViewChange: (view: ViewMode) => void
  search: string
  searchLabel: string
  searchPlaceholder: string
  sort: ProjectsSort
  view: ViewMode
}) {
  const [isSortOpen, setIsSortOpen] = useState(false)

  return (
    <div className="grid gap-2" data-v3-projects-indicator="search-sort-toolbar">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <label
          className="relative block min-w-0"
          data-feature-guide-target="projects.search"
        >
          <span className="sr-only">{searchLabel}</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/28"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-11 w-full rounded-[8px] border border-white/10 bg-[#111821] pl-10 pr-3 text-sm font-semibold text-white outline-none transition placeholder:text-white/28 focus:border-cyan-300/70"
          />
        </label>

        <button
          type="button"
          aria-expanded={isSortOpen}
          aria-label="Open sorting controls"
          onClick={() => setIsSortOpen((open) => !open)}
          className="grid h-11 grid-cols-[auto_auto] items-center gap-2 rounded-[8px] border border-white/10 bg-[#111821] px-3 text-xs font-black text-white/70 transition hover:border-cyan-300/45 hover:text-cyan-300"
          data-feature-guide-target="projects.sort"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 7h16M7 12h10M10 17h4" />
          </svg>
          Sort
        </button>
      </div>

      {isSortOpen ? (
        <div
          className="grid gap-2 rounded-[8px] border border-white/[0.06] bg-[#111821] p-2"
          data-v3-projects-indicator="sort-panel"
        >
          <div className="flex items-center gap-3">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Sort projects and units</span>
              <select
                value={sort}
                onChange={(event) => onSortChange(event.target.value as ProjectsSort)}
                className="h-10 w-full rounded-[8px] border border-cyan-300/70 bg-black/24 px-3 text-xs font-black text-white outline-none transition focus:border-cyan-300"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div
              className="grid grid-cols-2 overflow-hidden rounded-[8px] border border-white/10"
              data-v3-projects-indicator="view-toggle"
            >
              <button
                type="button"
                aria-label="Grid view"
                onClick={() => onViewChange('grid')}
                data-active={view === 'grid'}
                className={[
                  'grid h-10 w-10 place-items-center text-sm font-black transition',
                  view === 'grid' ? 'bg-cyan-300 text-black' : 'text-white/42 hover:text-white',
                ].join(' ')}
              >
                #
              </button>
              <button
                type="button"
                aria-label="Card view"
                onClick={() => onViewChange('cards')}
                data-active={view === 'cards'}
                className={[
                  'grid h-10 w-10 place-items-center border-l border-white/10 text-sm font-black transition',
                  view === 'cards' ? 'bg-cyan-300 text-black' : 'text-white/42 hover:text-white',
                ].join(' ')}
              >
                =
              </button>
            </div>
          </div>

          {children}
        </div>
      ) : children ? (
        <div>{children}</div>
      ) : null}
    </div>
  )
}

function PaginatedResultFrame({
  children,
  itemCount,
  nextLabel,
  onNextPage,
  onPreviousPage,
  pageCount,
  pageIndex,
  previousLabel,
}: {
  children: React.ReactNode
  itemCount: number
  nextLabel: string
  onNextPage: () => void
  onPreviousPage: () => void
  pageCount: number
  pageIndex: number
  previousLabel: string
}) {
  const hasPages = itemCount > 0 && pageCount > 1

  return (
    <section className={hasPages ? 'relative pr-8' : 'relative'}>
      {children}

      {hasPages ? (
        <div
          className="absolute bottom-0 right-0 top-0 flex w-6 flex-col items-center justify-between rounded-full border border-white/10 bg-[#111821]/92 py-2"
          data-v3-projects-indicator="pagination-rail"
        >
          <button
            type="button"
            aria-label={previousLabel}
            onClick={onPreviousPage}
            className="grid h-8 w-5 place-items-center text-white/42 transition hover:text-cyan-300"
          >
            ^
          </button>
          <span className="text-[10px] font-black text-white/30">
            {pageIndex + 1}/{pageCount}
          </span>
          <button
            type="button"
            aria-label={nextLabel}
            onClick={onNextPage}
            className="grid h-8 w-5 place-items-center text-white/42 transition hover:text-cyan-300"
          >
            v
          </button>
        </div>
      ) : null}
    </section>
  )
}

function ProjectsTab({
  onNextPage,
  onPreviousPage,
  onSearchChange,
  onSortChange,
  onViewChange,
  pageCount,
  pageIndex,
  projects,
  search,
  sort,
  totalCount,
  unitsByProjectId,
  view,
}: {
  onNextPage: () => void
  onPreviousPage: () => void
  onSearchChange: (query: string) => void
  onSortChange: (sort: ProjectsSort) => void
  onViewChange: (view: ViewMode) => void
  pageCount: number
  pageIndex: number
  projects: PreviewProject[]
  search: string
  sort: ProjectsSort
  totalCount: number
  unitsByProjectId: Map<string, PreviewUnit[]>
  view: ViewMode
}) {
  return (
    <section className="grid gap-4">
      <SearchSortToolbar
        search={search}
        searchLabel="Search projects and units"
        searchPlaceholder="Search by project or unit name..."
        sort={sort}
        view={view}
        onSearchChange={onSearchChange}
        onSortChange={onSortChange}
        onViewChange={onViewChange}
      />

      <PaginatedResultFrame
        itemCount={totalCount}
        pageCount={pageCount}
        pageIndex={pageIndex}
        previousLabel="Previous projects"
        nextLabel="Next projects"
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
      >
        {projects.length === 0 ? (
          <section
            className="rounded-[8px] border border-white/[0.06] bg-[#111821] p-5 text-center"
            aria-label="Project collections"
            data-v3-projects-indicator="projects-empty"
          >
            <h2 className="text-lg font-black">No projects found</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-white/48">
              Adjust the search or create a project to group units into a file.
            </p>
          </section>
        ) : view === 'grid' ? (
          <section
            className="grid grid-cols-2 gap-3"
            aria-label="Project collections"
            data-v3-projects-indicator="projects-grid"
          >
            {projects.map((project) => (
              <ProjectGridCard
                key={project.id}
                project={project}
                units={unitsByProjectId.get(project.id) ?? []}
              />
            ))}
          </section>
        ) : (
          <section
            className="grid gap-3"
            aria-label="Project collections"
            data-v3-projects-indicator="projects-list"
          >
            {projects.map((project) => (
              <ProjectFileCard
                key={project.id}
                project={project}
                units={unitsByProjectId.get(project.id) ?? []}
              />
            ))}
          </section>
        )}
      </PaginatedResultFrame>
    </section>
  )
}

function ProjectFileCard({
  project,
  units,
}: {
  project: PreviewProject
  units: PreviewUnit[]
}) {
  const totalProgress = units.length
    ? Math.round(units.reduce((sum, unit) => sum + unit.progress, 0) / units.length)
    : 0

  return (
    <a
      href={`/projects/${project.id}?preview=1`}
      data-v3-projects-indicator="project-card"
      data-feature-guide-target="projects.card"
      className="block overflow-hidden rounded-[8px] border border-white/[0.055] bg-[#111821] shadow-[0_14px_40px_rgba(0,0,0,0.22)] transition hover:border-cyan-300/35"
    >
      <div className="grid grid-cols-[110px_1fr] gap-3 p-3">
        <div className="relative min-h-[116px] overflow-hidden rounded-[8px] bg-black">
          <Image
            src={project.image}
            alt=""
            fill
            sizes="110px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/48" />
        </div>
        <div className="min-w-0 py-1">
          <h2 className="line-clamp-2 text-lg font-black leading-tight text-white">
            {project.name}
          </h2>
          <p className="mt-2 line-clamp-2 text-xs font-semibold leading-4 text-white/52">
            {project.description}
          </p>
          <div
            className="mt-3 flex flex-wrap items-center gap-2"
            data-v3-projects-indicator="project-card-stats"
          >
            <span>{units.length} Units</span>
            <span>{totalProgress}% Avg</span>
          </div>
        </div>
      </div>
    </a>
  )
}

function ProjectGridCard({
  project,
  units,
}: {
  project: PreviewProject
  units: PreviewUnit[]
}) {
  const totalProgress = getAverageProgress(units)

  return (
    <a
      href={`/projects/${project.id}?preview=1`}
      data-v3-projects-indicator="project-grid-card"
      data-feature-guide-target="projects.card"
      className="block overflow-hidden rounded-[8px] border border-white/[0.055] bg-[#111821] transition hover:border-cyan-300/35"
    >
      <div className="relative aspect-[1.08] overflow-hidden bg-black">
        <Image
          src={project.image}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, 216px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/22 to-black/86" />
        <div className="absolute bottom-3 left-3 right-3">
          <h2 className="line-clamp-2 text-sm font-black leading-tight text-white">
            {project.name}
          </h2>
        </div>
      </div>
      <div className="grid gap-2 p-3">
        <div className="flex items-center justify-between gap-2 text-[10px] font-black text-white/38">
          <span>{units.length} Units</span>
          <span>{totalProgress}% Avg</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-cyan-300"
            style={{ width: `${Math.max(totalProgress, units.length ? 4 : 0)}%` }}
          />
        </div>
      </div>
    </a>
  )
}

function UnitsTab({
  onNextPage,
  onPreviousPage,
  onSearchChange,
  onSortChange,
  onViewChange,
  pageCount,
  pageIndex,
  projectById,
  projects,
  search,
  sort,
  totalCount,
  units,
  view,
}: {
  onNextPage: () => void
  onPreviousPage: () => void
  onSearchChange: (query: string) => void
  onSortChange: (sort: ProjectsSort) => void
  onViewChange: (view: ViewMode) => void
  pageCount: number
  pageIndex: number
  projectById: Map<string, PreviewProject>
  projects: PreviewProject[]
  search: string
  sort: ProjectsSort
  totalCount: number
  units: PreviewUnit[]
  view: ViewMode
}) {
  return (
    <section className="grid gap-4">
      <SearchSortToolbar
        search={search}
        searchLabel="Search units and projects"
        searchPlaceholder="Search by unit or project name..."
        sort={sort}
        view={view}
        onSearchChange={onSearchChange}
        onSortChange={onSortChange}
        onViewChange={onViewChange}
      >
        <div
          className="flex flex-wrap gap-2"
          data-v3-projects-indicator="project-filter-chips"
        >
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => onSearchChange(project.name)}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-black text-white/48 transition hover:border-cyan-300/45 hover:text-cyan-300"
            >
              {project.name}
            </button>
          ))}
        </div>
      </SearchSortToolbar>

      <PaginatedResultFrame
        itemCount={totalCount}
        pageCount={pageCount}
        pageIndex={pageIndex}
        previousLabel="Previous units"
        nextLabel="Next units"
        onPreviousPage={onPreviousPage}
        onNextPage={onNextPage}
      >
        {units.length === 0 ? (
          <section
            className="rounded-[8px] border border-white/[0.06] bg-[#111821] p-5 text-center"
            aria-label="Units"
            data-v3-projects-indicator="units-empty"
          >
            <h2 className="text-lg font-black">No units found</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-white/48">
              Adjust the search or add a unit to start tracking models.
            </p>
          </section>
        ) : view === 'grid' ? (
          <section
            className="grid grid-cols-2 gap-3"
            aria-label="Units"
            data-v3-projects-indicator="units-grid"
          >
            {units.map((unit) => (
              <UnitCard
                key={unit.id}
                project={projectById.get(unit.projectId)}
                unit={unit}
              />
            ))}
          </section>
        ) : (
          <section
            className="overflow-hidden rounded-[8px] border border-white/[0.06] bg-[#111821]"
            aria-label="Units"
            data-v3-projects-indicator="units-list"
          >
            <div className="divide-y divide-white/[0.06]">
              {units.map((unit) => (
                <UnitListRow
                  key={unit.id}
                  project={projectById.get(unit.projectId)}
                  unit={unit}
                />
              ))}
            </div>
          </section>
        )}
      </PaginatedResultFrame>
    </section>
  )
}

function UnitCard({
  project,
  unit,
}: {
  project?: PreviewProject
  unit: PreviewUnit
}) {
  return (
    <a
      href={`/units/${unit.id}?preview=1`}
      data-v3-projects-indicator="unit-card"
      className="block overflow-hidden rounded-[8px] border border-white/[0.055] bg-[#111821] transition hover:border-cyan-300/35"
    >
      <div className="relative aspect-[0.92] overflow-hidden bg-black">
        <Image
          src={unit.image}
          alt=""
          fill
          sizes="(max-width: 640px) 50vw, 216px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/12 to-black/82" />
        <div className="absolute bottom-3 left-3 right-3">
          <h2 className="line-clamp-2 text-base font-black leading-tight">
            {unit.name}
          </h2>
          <p className="mt-1 truncate text-[10px] font-black text-cyan-300">
            {project?.name ?? 'No Project'}
          </p>
        </div>
        <ProgressRing progress={unit.progress} />
      </div>
      <div className="p-3">
        <div className="h-1 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-cyan-300"
            style={{ width: `${Math.max(unit.progress, 4)}%` }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-black text-white/36">
          <span>{unit.stage}</span>
          <span>{formatShortDate(unit.deadline)}</span>
        </div>
      </div>
    </a>
  )
}

function UnitListRow({
  project,
  unit,
}: {
  project?: PreviewProject
  unit: PreviewUnit
}) {
  return (
    <a
      href={`/units/${unit.id}?preview=1`}
      data-v3-projects-indicator="unit-row"
      className="grid grid-cols-[58px_1fr_auto] items-center gap-3 px-4 py-3 transition hover:bg-white/[0.035]"
    >
      <span className="relative h-14 w-14 overflow-hidden rounded-[8px] bg-black">
        <Image src={unit.image} alt="" fill sizes="56px" className="object-cover" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black text-white">
          {unit.name}
        </span>
        <span className="mt-1 block truncate text-[10px] font-semibold text-white/38">
          {project?.name ?? 'No Project'} - {unit.stage} - {unit.logged}
        </span>
      </span>
      <span className="grid h-10 w-10 place-items-center rounded-full border border-cyan-300/20 bg-cyan-300/8 text-[10px] font-black text-cyan-300">
        {unit.progress}%
      </span>
    </a>
  )
}

function ProgressRing({ progress }: { progress: number }) {
  return (
    <div
      className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full bg-black/48"
      data-v3-projects-indicator="progress-ring"
    >
      <div
        className="grid h-8 w-8 place-items-center rounded-full text-[9px] font-black text-white"
        style={{
          background: `conic-gradient(#22d3ee 0 ${progress}%, rgba(255,255,255,0.14) ${progress}% 100%)`,
        }}
        aria-label={`Progress ${progress} percent`}
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-[#070b0f]">
          {progress}%
        </span>
      </div>
    </div>
  )
}

function CreateProjectSheet({
  dueDate,
  name,
  onClose,
  onDueDateChange,
  onNameChange,
  onProjectTypeChange,
  onSubmit,
  previewName,
  projectType,
}: {
  dueDate: string
  name: string
  onClose: () => void
  onDueDateChange: (date: string) => void
  onNameChange: (name: string) => void
  onProjectTypeChange: (projectType: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  previewName: string
  projectType: string
}) {
  return (
    <Sheet title="Create project" eyebrow="New Project" onClose={onClose}>
      <form
        onSubmit={onSubmit}
        className="grid gap-4"
        data-feature-guide-target="projects.create_form"
      >
        <TextField
          label="Project name"
          placeholder="e.g. Winter Warband"
          value={name}
          onChange={onNameChange}
        />
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
            Type
          </span>
          <select
            value={projectType}
            onChange={(event) => onProjectTypeChange(event.target.value)}
            className="h-12 rounded-[8px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/70"
          >
            <option>Warband</option>
            <option>Army</option>
            <option>Display Force</option>
            <option>Terrain Table</option>
          </select>
        </label>
        <DateField label="Due date" value={dueDate} onChange={onDueDateChange} />
        <PreviewCard
          image="/onboarding/pains/paint-management.jpeg"
          title={previewName}
          subtitle={projectType}
        />
        <PrimaryButton>Create preview project</PrimaryButton>
      </form>
    </Sheet>
  )
}

function CreateUnitSheet({
  deadline,
  name,
  onClose,
  onDeadlineChange,
  onNameChange,
  onProjectChange,
  onSubmit,
  previewName,
  projectId,
  projects,
}: {
  deadline: string
  name: string
  onClose: () => void
  onDeadlineChange: (date: string) => void
  onNameChange: (name: string) => void
  onProjectChange: (projectId: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  previewName: string
  projectId: string
  projects: PreviewProject[]
}) {
  const project = projects.find((item) => item.id === projectId) ?? null

  return (
    <Sheet title="Create unit" eyebrow="New Unit" onClose={onClose}>
      <form
        onSubmit={onSubmit}
        className="grid gap-4"
        data-feature-guide-target="projects.create_form"
      >
        <TextField
          label="Unit name"
          placeholder="e.g. Skeleton Captain"
          value={name}
          onChange={onNameChange}
        />
        <label className="grid gap-2">
          <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
            Project
          </span>
          <select
            value={projectId}
            onChange={(event) => onProjectChange(event.target.value)}
            className="h-12 rounded-[8px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/70"
          >
            {projects.length === 0 ? (
              <option value="unfiled">No project</option>
            ) : null}
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <DateField label="Deadline" value={deadline} onChange={onDeadlineChange} />
        <PreviewCard
          image="/onboarding/pains/paint-management.jpeg"
          title={previewName}
          subtitle={project?.name ?? 'No Project'}
        />
        <PrimaryButton>Create preview unit</PrimaryButton>
      </form>
    </Sheet>
  )
}

function Sheet({
  children,
  eyebrow,
  onClose,
  title,
}: {
  children: React.ReactNode
  eyebrow: string
  onClose: () => void
  title: string
}) {
  return (
    <div className="fixed inset-0 z-[60] grid place-items-end bg-black/65 px-3 py-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-title"
        className="w-full max-w-md rounded-[8px] border border-white/10 bg-[#10161d] p-4 shadow-2xl shadow-black/50"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
              {eyebrow}
            </p>
            <h2 id="create-title" className="mt-1 text-2xl font-black leading-tight">
              {title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close create panel"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-lg font-black text-white/48 transition hover:text-white"
          >
            x
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}

function TextField({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string
  onChange: (value: string) => void
  placeholder: string
  value: string
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-12 rounded-[8px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/70"
      />
    </label>
  )
}

function DateField({
  label,
  onChange,
  value,
}: {
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-black uppercase tracking-[0.18em] text-white/42">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-[8px] border border-white/10 bg-black/24 px-4 text-sm font-semibold text-white outline-none transition focus:border-cyan-300/70"
      />
    </label>
  )
}

function PreviewCard({
  image,
  subtitle,
  title,
}: {
  image: string
  subtitle: string
  title: string
}) {
  return (
    <div
      className="overflow-hidden rounded-[8px] border border-cyan-300/20 bg-black/24"
      data-v3-projects-indicator="preview-card"
    >
      <div className="relative h-28">
        <Image
          src={image}
          alt=""
          fill
          sizes="(max-width: 640px) 100vw, 448px"
          className="object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-black/15" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
            Preview
          </p>
          <p className="mt-1 truncate text-xl font-black">{title}</p>
          <p className="mt-1 text-xs font-bold text-white/44">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

function PrimaryButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="h-12 rounded-[8px] bg-cyan-300 text-sm font-black text-black transition hover:bg-cyan-200"
    >
      {children}
    </button>
  )
}

function getAverageProgress(units: PreviewUnit[]) {
  if (units.length === 0) return 0
  return Math.round(units.reduce((sum, unit) => sum + unit.progress, 0) / units.length)
}

function getPageSize(tab: ProjectsTab, view: ViewMode) {
  if (tab === 'projects') return view === 'grid' ? 4 : 3
  return view === 'grid' ? 4 : 5
}

function getProjectStatusLabel(units: PreviewUnit[]) {
  if (units.length === 0) return 'Other'
  if (units.some((unit) => unit.status.toLowerCase() === 'active')) return 'Active'
  if (units.every((unit) => unit.status.toLowerCase() === 'complete')) return 'Complete'
  return units[0]?.status ?? 'Other'
}

function getStatusRank(status: string) {
  const normalizedStatus = status.toLowerCase()
  if (normalizedStatus === 'active') return 0
  if (normalizedStatus === 'bench') return 1
  if (normalizedStatus === 'complete') return 2
  if (normalizedStatus === 'pile' || normalizedStatus === 'pile of shame') return 3
  return 4
}

function getDateTime(value: string | undefined) {
  if (!value || value === 'No deadline') return Number.POSITIVE_INFINITY

  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`)
    : new Date(value)

  const timestamp = parsedDate.getTime()
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp
}

function getLatestUnitUpdateTime(units: PreviewUnit[]) {
  if (units.length === 0) return 0
  return Math.max(...units.map((unit) => getDateTime(unit.updatedAt)))
}

function getProjectDeadlineTime(project: PreviewProject, units: PreviewUnit[]) {
  const unitDeadlines = units.map((unit) => getDateTime(unit.deadline))
  return Math.min(getDateTime(project.due), ...unitDeadlines)
}

function formatShortDate(date: string) {
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? new Date(`${date}T00:00:00`)
    : new Date(date)

  if (Number.isNaN(parsedDate.getTime())) {
    return date
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(parsedDate)
}
