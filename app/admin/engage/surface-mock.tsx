import type { RenderedMessage } from '../../../lib/engage/types'

// How a message looks on its surface: a phone notification, the parchment
// popup, the one-line topper strip, or an email.
export default function SurfaceMock({ rendered }: { rendered: RenderedMessage }) {
  if (rendered.surface === 'push') {
    return (
      <div className="rounded-2xl bg-[#e9edf1] p-3 text-[#1b1f24] shadow-inner">
        <div className="flex items-center gap-2 text-[0.7rem] text-[#5a6470]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="h-4 w-4 rounded" />
          Obsidian Gallery · now
        </div>
        <div className="mt-1 text-sm font-bold">{rendered.title}</div>
        <div className="text-sm leading-snug">{rendered.body}</div>
      </div>
    )
  }

  if (rendered.surface === 'email') {
    return (
      <div className="rounded-2xl bg-[#f6f1e7] p-4 text-[#2a2118]">
        <div className="text-[0.7rem] text-[#7a6a55]">Subject</div>
        <div className="font-bold">{rendered.title}</div>
        <p className="mt-2 text-sm leading-snug">{rendered.body}</p>
        <span className="mt-3 inline-block rounded-lg bg-[#b08a3e] px-3 py-1.5 text-sm font-bold text-[#1d160e]">
          {rendered.ctaLabel}
        </span>
      </div>
    )
  }

  if (rendered.surface === 'topper') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[#b08a3e]/70 bg-[#f6f1e7] py-1.5 pl-3 pr-1.5 text-[#2a2118]">
        <span className="min-w-0 flex-1 font-serif text-[0.92rem] font-bold leading-tight">{rendered.title}</span>
        <span className="whitespace-nowrap rounded-lg bg-[#c9a24e] px-2.5 py-1.5 text-xs font-extrabold text-[#1d160e]">
          {rendered.ctaLabel}
        </span>
        <span aria-hidden className="px-1 text-sm text-[#5a4a38]">
          ✕
        </span>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-[#b08a3e]/70 bg-[#f6f1e7] p-5 text-[#2a2118]">
      <div className="text-[0.62rem] font-extrabold uppercase tracking-[0.16em] text-[#8a6a2a]">Obsidian Gallery</div>
      <div className="mt-1 font-serif text-xl font-bold leading-tight">{rendered.title}</div>
      <p className="mt-2 text-sm leading-snug text-[#5a4a38]">{rendered.body}</p>
      <span className="mt-3 block w-full rounded-lg bg-[#c9a24e] px-3 py-2 text-center text-sm font-extrabold text-[#1d160e]">
        {rendered.ctaLabel}
      </span>
      <div className="mt-2 text-center text-sm font-bold text-[#5a4a38]">Not now</div>
    </div>
  )
}
