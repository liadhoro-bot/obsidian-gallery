'use client'

import Image from 'next/image'
import Link from '@/app/components/navigation-feedback/navigation-link'
import type { ReactNode } from 'react'
import type { GuidesV3GuideFile } from '../guides-v3-data'
import GuideSocialActions from './guide-social-actions'

export function CompactGuideCard({ guide }: { guide: GuidesV3GuideFile }) {
  return (
    <Link
      href={`/guides/${guide.id}?preview=1`}
      data-v3-guides-indicator="compact-guide-card"
      data-feature-guide-target="guides.tabs.library"
      className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.035]"
    >
      <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[8px] bg-black">
        <Image unoptimized src={guide.image} alt="" fill sizes="56px" className="object-cover" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-white">
          {guide.title}
        </span>
        <span className="mt-1 block truncate text-[10px] font-semibold text-white/38">
          {guide.subtitle}
        </span>
      </span>
      {guide.deckId ? (
        <GuideSocialActions
          recipeId={guide.deckId}
          likeCount={guide.likeCount}
          saveCount={guide.saveCount}
          viewerHasLiked={guide.viewerHasLiked}
          viewerHasSaved={guide.viewerHasSaved}
          size="sm"
          stopClickPropagation
        />
      ) : null}
    </Link>
  )
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
      <div className="divide-y divide-white/[0.06]">{children}</div>
    </section>
  )
}

