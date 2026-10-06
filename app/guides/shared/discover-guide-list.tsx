'use client'

import ViewCardsLink from './view-cards-link'
import Image from 'next/image'
import Link from '@/app/components/navigation-feedback/navigation-link'
import type { ReactNode } from 'react'
import type { GuidesV3GuideFile } from '../guides-v3-data'
import GuideSocialActions from './guide-social-actions'

export function CompactGuideCard({ guide }: { guide: GuidesV3GuideFile }) {
  return <article data-v3-guides-indicator="compact-guide-card" className="overflow-hidden rounded-[12px] border px-3 py-3 shadow-sm">
    <Link href={`/guides/${guide.id}?preview=1&view=1`} className="grid grid-cols-[76px_minmax(0,1fr)] gap-3" data-feature-guide-target="guides.tabs.library">
      <span className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[9px]"><Image unoptimized src={guide.image} alt="" fill sizes="76px" className="object-cover" /></span>
      <span className="flex h-[76px] min-w-0 flex-col overflow-hidden"><span className="block break-words font-serif text-base font-black leading-tight">{guide.title}</span><span className="mt-1 line-clamp-3 block text-xs leading-[1.3]">{guide.subtitle}</span></span>
    </Link>
    <div className="mt-2 flex min-w-0 items-center gap-2 border-t border-black/10 pt-2" data-v3-guides-indicator="list-card-actions">
      <ViewCardsLink href={`/guides/${guide.id}?preview=1&view=1`} title={guide.title} />
      <span className="h-6 w-px shrink-0 bg-black/12" aria-hidden="true" />
      <Link href={`/guides/${guide.id}?preview=1`} className="inline-flex min-h-9 items-center gap-1 px-1 text-xs font-bold"><InfoIcon /> Info</Link>
      {guide.isOwner ? <Link href={`/guides/${guide.id}?preview=1&edit=1`} className="inline-flex min-h-9 items-center gap-1 px-1 text-xs font-bold"><EditIcon /> Edit</Link> : null}
      {guide.deckId ? <><span className="ml-auto h-6 w-px shrink-0 bg-black/12" aria-hidden="true" /><GuideSocialActions recipeId={guide.deckId} likeCount={guide.likeCount} saveCount={guide.saveCount} viewerHasLiked={guide.viewerHasLiked} viewerHasSaved={guide.viewerHasSaved} size="sm" /></> : null}
    </div>
  </article>
}
function EditIcon() {
  return <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /><path d="m14 7 3 3" /></svg>
}

function InfoIcon() {
  return <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></svg>
}

export function LibrarySection({
  action,
  children,
  title,
}: {
  action?: string
  children: ReactNode
  title: string
}) {
  return (
    <section
      className="overflow-hidden rounded-[8px] border border-white/[0.06] bg-[#111821]"
      data-v3-guides-indicator="library-section"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-white/28">
          {title}
        </h2>
        {action ? (
          <button
            type="button"
            className="text-[10px] font-black text-cyan-300 transition hover:text-cyan-200"
          >
            {action}
          </button>
        ) : null}
      </div>
      <div className="grid gap-2 p-2">{children}</div>
    </section>
  )
}

