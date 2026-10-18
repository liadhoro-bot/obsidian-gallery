'use client'

import {
  ObsidianShareCardFrame,
  ObsidianShareOrnament,
  ObsidianShareTitle,
} from '@/components/share/ObsidianShareCardFrame'
import type { GuideIndexEntry } from './guide-card-layout'
import { useGuideCardNavigation } from './guide-card-navigation'

// Guide-owned table of contents. Entries are derived from the guide's resolved
// card layout (see guideIndexEntries), never stored.
export function GuideIndexCard({ entries }: { entries: GuideIndexEntry[] }) {
  const navigation = useGuideCardNavigation()

  return (
    <ObsidianShareCardFrame>
      <div className="guide-index-head shrink-0 text-center">
        <ObsidianShareOrnament />
        <ObsidianShareTitle title="Guide Index" compact />
        <div className="guide-index-subhead flex items-center gap-2">
          <span className="recipe-guide-divider-rule h-px flex-1" />
          <p className="guide-index-tagline font-serif italic">
            {navigation ? 'Tap a section to jump' : 'Sections in this guide'}
          </p>
          <span className="recipe-guide-divider-rule h-px flex-1" />
        </div>
        <ObsidianShareOrnament />
      </div>
      {entries.length ? (
        <ol className="guide-index-list min-h-0 flex-1" data-dense={entries.length > 8 || undefined}>
          {entries.map((entry, index) => {
            const content = (
              <>
                <span className="guide-index-medallion font-serif" aria-hidden="true">{index + 1}</span>
                <span className="guide-index-rule" aria-hidden="true" />
                <span className="guide-index-copy min-w-0">
                  <span className="guide-index-kicker uppercase">Guide</span>
                  <strong className="guide-index-title font-serif">{entry.title}</strong>
                  {entry.subtitle ? <span className="guide-index-subtitle font-serif">{entry.subtitle}</span> : null}
                </span>
                <svg className="guide-index-chevron" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </>
            )
            return (
              <li key={entry.deckId}>
                {navigation ? (
                  <button
                    type="button"
                    className="guide-index-row"
                    aria-label={`${index + 1}. ${entry.title}`}
                    onClick={() => navigation.goToCard(entry.targetKey)}
                  >
                    {content}
                  </button>
                ) : (
                  <div className="guide-index-row">{content}</div>
                )}
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="guide-index-empty grid flex-1 place-items-center text-center font-serif">
          Add guides with visible cards to build this index.
        </p>
      )}
    </ObsidianShareCardFrame>
  )
}
