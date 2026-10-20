'use client'

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import styles from './browse-tags-panel.module.css'
import { matchesTagFilters, TAG_CATEGORIES, type TagCategory, type TagDirectoryEntry } from './tag-directory'

// How many packed rows a section shows, with no tab open, before "Show more".
const COLLAPSED_ROWS = 2
const CHIP_GAP = 8
// A last row filled less than this keeps its chips at natural width: one
// stretched chip reads as a button, not a tag.
const MIN_LAST_ROW_FILL = 0.55

export type BrowseTagSection = {
  id: TagCategory | 'other'
  title: string
  tags: string[]
}

type TagRow = { tags: string[]; fill: number }

// Directory tags grouped into Browse Tags sections. Tags some guide uses come
// first, so collapsed sections show what can actually be found; then the
// directory's sort_order, then how many guides use the tag. Tags guides
// use that the directory doesn't know (and directory tags with no category)
// land in "Other", which only appears when something there is in use.
export function buildBrowseTagSections(
  directory: TagDirectoryEntry[],
  usage: Map<string, number>
): BrowseTagSection[] {
  const isUsed = (entry: TagDirectoryEntry) => ((usage.get(entry.name) ?? 0) > 0 ? 0 : 1)
  const byOrder = (left: TagDirectoryEntry, right: TagDirectoryEntry) =>
    isUsed(left) - isUsed(right) ||
    left.sortOrder - right.sortOrder ||
    (usage.get(right.name) ?? 0) - (usage.get(left.name) ?? 0) ||
    left.name.localeCompare(right.name)

  const sections: BrowseTagSection[] = TAG_CATEGORIES.map((category) => ({
    id: category.id,
    title: category.title,
    tags: directory.filter((entry) => entry.category === category.id).sort(byOrder).map((entry) => entry.name),
  }))

  const known = new Set(directory.map((entry) => entry.name))
  const other = [
    ...directory.filter((entry) => entry.category === null).map((entry) => entry.name),
    ...[...usage.keys()].filter((tag) => !known.has(tag)),
  ].filter((tag) => (usage.get(tag) ?? 0) > 0)
  if (other.length) {
    sections.push({ id: 'other', title: 'Other', tags: other.sort((a, b) => a.localeCompare(b)) })
  }

  return sections.filter((section) => section.tags.length)
}

// Packs chips into full rows: each row starts with the next tag in order,
// then takes any later tag that still fits, so short tags fill the gaps long
// ones leave. The directory's order holds as far as the widths allow.
export function packTagRows(tags: string[], widths: Map<string, number>, rowWidth: number): TagRow[] {
  const rows: TagRow[] = []
  const left = [...tags]
  while (left.length) {
    const row: string[] = []
    let used = 0
    for (let index = 0; index < left.length; ) {
      const width = widths.get(left[index]) ?? 0
      const needed = row.length ? width + CHIP_GAP : width
      if (!row.length || used + needed <= rowWidth) {
        row.push(left[index])
        used += needed
        left.splice(index, 1)
      } else {
        index += 1
      }
    }
    rows.push({ tags: row, fill: rowWidth ? used / rowWidth : 1 })
  }
  return rows
}

export function BrowseTagsPanel({
  sections,
  applied,
  onApply,
  guideTags,
  lookup,
}: {
  sections: BrowseTagSection[]
  applied: string[]
  onApply: (tags: string[]) => void
  // Canonical tags (plus difficulty) of every guide the panel filters, for
  // the live counts.
  guideTags: Set<string>[]
  lookup: Map<string, TagDirectoryEntry>
}) {
  const [draft, setDraft] = useState(applied)
  // null = every section. Tapping the open tab again returns here.
  const [activeTab, setActiveTab] = useState<TagCategory | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const draftKeys = useMemo(() => new Set(draft.map((tag) => tag.toLocaleLowerCase())), [draft])

  // Each chip counts the guides carrying that tag, whatever else is
  // selected. Apply shows what the whole draft leaves.
  const resultCount = guideTags.filter((tags) => matchesTagFilters(tags, draft, lookup)).length
  const chipCounts = new Map(
    sections.flatMap((section) => section.tags).map((tag) => [tag, guideTags.filter((tags) => tags.has(tag)).length])
  )

  const toggleTag = (tag: string) =>
    setDraft((current) =>
      draftKeys.has(tag.toLocaleLowerCase())
        ? current.filter((value) => value.toLocaleLowerCase() !== tag.toLocaleLowerCase())
        : [...current, tag]
    )

  const visibleSections =
    activeTab === null ? sections : sections.filter((section) => section.id === activeTab)
  const tabs = TAG_CATEGORIES.filter((category) => sections.some((section) => section.id === category.id))

  return (
    <div className={styles.panel} data-v3-guides-indicator="browse-tags">
      <div className={styles.heading}>
        <h2>Browse Tags</h2>
        <span className={styles.rule} aria-hidden="true" />
      </div>

      {draft.length ? (
        <div className={styles.selected} aria-label="Selected tags">
          {draft.map((tag) => (
            <button key={tag} type="button" className={styles.selectedChip} onClick={() => toggleTag(tag)}>
              {tag}
              <XIcon />
              <span className="sr-only">Remove {tag}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className={styles.tabs} role="tablist" aria-label="Tag categories">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab((current) => (current === tab.id ? null : tab.id))}
          >
            {tab.tab}
          </button>
        ))}
      </div>

      <div className={styles.sections}>
        {visibleSections.map((section) => (
          <TagSection
            key={section.id}
            section={section}
            // A single-category tab always lists everything.
            collapsible={activeTab === null}
            expanded={expanded.has(section.id)}
            onToggleExpanded={() =>
              setExpanded((current) => {
                const next = new Set(current)
                if (next.has(section.id)) next.delete(section.id)
                else next.add(section.id)
                return next
              })
            }
            isSelected={(tag) => draftKeys.has(tag.toLocaleLowerCase())}
            countOf={(tag) => chipCounts.get(tag) ?? 0}
            onToggleTag={toggleTag}
          />
        ))}
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.clear} onClick={() => setDraft([])} disabled={!draft.length}>
          <ClearIcon />
          Clear all
        </button>
        <button
          type="button"
          className={styles.apply}
          onClick={() => onApply(draft)}
          disabled={Boolean(draft.length) && resultCount === 0}
        >
          <FunnelIcon />
          {draft.length ? `Show ${resultCount} ${resultCount === 1 ? 'guide' : 'guides'}` : 'Apply filters'}
        </button>
      </div>
    </div>
  )
}

function TagSection({
  section,
  collapsible,
  expanded,
  onToggleExpanded,
  isSelected,
  countOf,
  onToggleTag,
}: {
  section: BrowseTagSection
  collapsible: boolean
  expanded: boolean
  onToggleExpanded: () => void
  isSelected: (tag: string) => boolean
  countOf: (tag: string) => number
  onToggleTag: (tag: string) => void
}) {
  const chipsRef = useRef<HTMLDivElement>(null)
  const measureRef = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState<TagRow[] | null>(null)
  const tagsKey = section.tags.join('\n')

  // Chips are measured once, hidden, with a two-digit count. A selected
  // chip's check is no wider, so selecting never reshuffles the rows under
  // the viewer's finger.
  useLayoutEffect(() => {
    const chips = chipsRef.current
    const measure = measureRef.current
    if (!chips || !measure) return
    const pack = () => {
      const widths = new Map<string, number>()
      measure.querySelectorAll<HTMLElement>('[data-measure-tag]').forEach((element) => {
        widths.set(element.dataset.measureTag ?? '', Math.ceil(element.getBoundingClientRect().width))
      })
      setRows(packTagRows(tagsKey.split('\n'), widths, chips.clientWidth))
    }
    pack()
    const observer = new ResizeObserver(pack)
    observer.observe(chips)
    return () => observer.disconnect()
  }, [tagsKey])

  const isCollapsible = collapsible && (rows?.length ?? 0) > COLLAPSED_ROWS
  const isExpanded = !isCollapsible || expanded
  const shownRows = rows && !isExpanded ? rows.slice(0, COLLAPSED_ROWS) : rows

  const renderChip = (tag: string) => {
    const selected = isSelected(tag)
    const count = countOf(tag)
    return (
      <button
        key={tag}
        type="button"
        aria-pressed={selected}
        className={styles.chip}
        disabled={!selected && count === 0}
        onClick={() => onToggleTag(tag)}
      >
        {tag}
        {selected ? <CheckIcon /> : <span className={styles.count}>{count}</span>}
      </button>
    )
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon}>{sectionIcons[section.id]}</span>
        <h3>{section.title}</h3>
        <span className={styles.rule} aria-hidden="true" />
        {isCollapsible ? (
          <button type="button" className={styles.showMore} aria-expanded={isExpanded} onClick={onToggleExpanded}>
            {isExpanded ? 'Show less' : 'Show more'}
            <ChevronIcon flipped={isExpanded} />
          </button>
        ) : null}
      </div>
      <div ref={chipsRef} className={styles.chips} data-packed={shownRows ? 'true' : undefined}>
        {shownRows && rows
          ? shownRows.map((row, index) => (
              <div
                key={index}
                className={styles.chipRow}
                data-stretch={index < rows.length - 1 || row.fill >= MIN_LAST_ROW_FILL ? 'true' : undefined}
              >
                {row.tags.map(renderChip)}
              </div>
            ))
          : section.tags.map(renderChip)}
        <div ref={measureRef} className={styles.measure} aria-hidden="true">
          {section.tags.map((tag) => (
            <span key={tag} className={styles.chip} data-measure-tag={tag}>
              {tag}
              <span className={styles.count}>00</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

const svgProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function FunnelIcon() {
  return (
    <svg {...svgProps} width="18" height="18" fill="currentColor" stroke="none">
      <path d="M3 4.5h18l-7 8.2V19l-4 2v-8.3z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg {...svgProps} strokeWidth={2.6}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <span className={styles.check}>
      <svg {...svgProps} strokeWidth={3.2}>
        <path d="M5.5 12.5l4 4 9-9" />
      </svg>
    </span>
  )
}

function ChevronIcon({ flipped }: { flipped: boolean }) {
  return (
    <svg {...svgProps} style={flipped ? { transform: 'rotate(180deg)' } : undefined}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function ClearIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  )
}

const sectionIcons: Record<BrowseTagSection['id'], ReactNode> = {
  game: (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
    </svg>
  ),
  faction: (
    <svg {...svgProps}>
      <path d="M12 3l8 3v5.5c0 4.6-3.3 8.4-8 9.5-4.7-1.1-8-4.9-8-9.5V6z" />
      <path d="M12 7.5v9M8.5 11h7" />
    </svg>
  ),
  subject: (
    <svg {...svgProps} fill="currentColor" stroke="none">
      <path d="M12 2.5c4.4 0 8 3.3 8 7.6 0 2.4-1 4.2-2.6 5.4V19a2.5 2.5 0 0 1-2.5 2.5H9.1A2.5 2.5 0 0 1 6.6 19v-3.5C5 14.3 4 12.5 4 10.1 4 5.8 7.6 2.5 12 2.5zm-3.3 7.2a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8zm6.6 0a1.9 1.9 0 1 0 0 3.8 1.9 1.9 0 0 0 0-3.8z" />
    </svg>
  ),
  skill: (
    <svg {...svgProps} fill="currentColor" stroke="none">
      <rect x="3" y="13" width="4.5" height="8" rx="1" />
      <rect x="9.75" y="8" width="4.5" height="13" rx="1" />
      <rect x="16.5" y="3" width="4.5" height="18" rx="1" />
    </svg>
  ),
  technique: (
    <svg {...svgProps}>
      <path d="M14.5 6.5l3-3 3 3-3 3M17.5 9.5L5 22l-3-3L14.5 6.5" />
      <path d="M4 4l7 7M3 7l4-4 4 4-4 4zM13 13l7 7" />
    </svg>
  ),
  brand: (
    <svg {...svgProps} fill="currentColor" stroke="none">
      <path d="M21.4 2.6c.8.8-5.4 8.8-8.3 11.4l-3.1-3.1C12.6 8 20.6 1.8 21.4 2.6zM8.9 12.3l2.8 2.8c-.4 2.9-2.7 6.4-8.7 6.4 1.6-1.6 1.2-3.5 2-5.5.7-1.8 2.2-3.2 3.9-3.7z" />
    </svg>
  ),
  other: (
    <svg {...svgProps}>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8" r="1.5" />
    </svg>
  ),
}
