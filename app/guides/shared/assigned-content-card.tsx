'use client'

import Image from 'next/image'
import Link from '@/app/components/navigation-feedback/navigation-link'
import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import {
  getTargetAssignmentLibrary,
  setTargetAssignments,
  type AssignableContent,
  type AssignmentTargetType,
} from '../assignment-actions'
import projectStyles from '../../projects/[id]/project-detail-silver.module.css'
import editorStyles from '../decks/[id]/deck-editor-client.module.css'
import guidesStyles from '../guides-v3-silver.module.css'
import ViewCardsLink from './view-cards-link'
import GuideSocialActions from './guide-social-actions'

export default function AssignedContentCard({ targetType, targetId }: { targetType: AssignmentTargetType; targetId: string }) {
  const isProject = targetType === 'project'
  const [assigned, setAssigned] = useState<AssignableContent[]>([])
  const [choices, setChoices] = useState<AssignableContent[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function load(openAfter = false) {
    startTransition(async () => {
      setError(null)
      try {
        const data = await getTargetAssignmentLibrary(targetType, targetId)
        setAssigned(data.assigned)
        setChoices(data.choices)
        setSelected(new Set(data.assigned.map((item) => `${item.type}:${item.id}`)))
        setError(null)
        if (openAfter) setOpen(true)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load assigned guides.')
      }
    })
  }

  useEffect(() => { load() }, [targetId, targetType]) // eslint-disable-line react-hooks/exhaustive-deps

  function save() {
    setError(null)
    startTransition(async () => {
      try {
        const content = choices.filter((item) => selected.has(`${item.type}:${item.id}`)).map(({ type, id }) => ({ type, id }))
        await setTargetAssignments({ targetType, targetId, content })
        setAssigned(choices.filter((item) => selected.has(`${item.type}:${item.id}`)))
        setError(null)
        setOpen(false)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not update assigned guides.')
      }
    })
  }

  return (
    <section className={isProject ? `${projectStyles.panel} overflow-hidden !p-0` : 'rounded-[10px] border border-white/[0.08] bg-[#111821] text-white'}>
      <div className="flex items-center justify-between px-4 py-4">
        <div>
          <p className={isProject ? projectStyles.eyebrow : 'text-[10px] font-black uppercase tracking-[0.24em] text-white/35'}>Guides</p>
          <p className={`mt-1 text-xs ${isProject ? '' : 'text-white/45'}`}>{assigned.length} assigned to this {targetType}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => load(true)} disabled={pending} className={isProject ? `${projectStyles.primaryButton} min-h-9 px-4 text-xs font-black disabled:opacity-45` : 'rounded-full px-3 py-2 text-xs font-black text-cyan-300 transition hover:bg-cyan-300/10 disabled:opacity-45'}>Add</button>
          <button type="button" onClick={() => setExpanded((current) => !current)} aria-expanded={expanded} aria-label={expanded ? 'Hide assigned guides' : 'Show assigned guides'} className={`${editorStyles.editButton} !min-h-9 !min-w-0 !px-3`}><span aria-hidden="true">{expanded ? '▴' : '▾'}</span>{expanded ? 'Hide' : 'Show'}</button>
        </div>
      </div>
      {expanded ? <div className={`${guidesStyles.guidesSilver} grid gap-3 border-t p-3 ${isProject ? 'border-black/10' : 'border-white/[0.06]'}`}>
        {assigned.map((item) => (
          <article key={`${item.type}:${item.id}`} className="relative overflow-hidden rounded-[12px] border border-white/[0.055] bg-[#111821] p-3 shadow-[0_8px_22px_rgba(0,0,0,0.18)] transition hover:border-cyan-300/45" data-v3-guides-indicator="guide-card" data-feature-guide-target="guides.tabs.guides">
            <Link href={item.type === 'guide' ? `/guides/${item.id}?preview=1&view=1` : `/guides/decks/${item.id}?preview=1`} className="block w-full text-left transition">
              <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-3">
                <div className="relative h-[76px] w-[76px] overflow-hidden rounded-[9px] bg-black">
                  <Image unoptimized src={item.image} alt="" fill sizes="76px" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/42" />
                </div>
                <div className="flex h-[76px] min-w-0 flex-col overflow-hidden">
                  <h2 className="break-words font-serif text-base font-black leading-tight text-white">{item.title}</h2>
                  <p className="mt-1 line-clamp-3 text-xs font-semibold leading-[1.3] text-white/52">{item.subtitle}</p>
                </div>
              </div>
            </Link>
            <div className="mt-2 flex min-w-0 items-center gap-2 border-t border-black/10 pt-2" data-v3-guides-indicator="list-card-actions">
              <ViewCardsLink href={item.type === 'guide' ? `/guides/${item.id}?preview=1&view=1` : `/guides/decks/${item.id}?preview=1`} title={item.title} />
              <span className="h-6 w-px shrink-0 bg-black/12" aria-hidden="true" />
              <Link href={item.type === 'guide' ? `/guides/${item.id}?preview=1` : `/guides/decks/${item.id}?preview=1`} className="inline-flex min-h-9 items-center gap-1 px-1 text-xs font-bold"><InfoIcon /> Info</Link>
              {item.isOwner ? <Link href={item.type === 'guide' ? `/guides/${item.id}?preview=1&edit=1` : `/guides/decks/${item.id}?preview=1&edit=1`} data-v3-guides-indicator="guide-edit-link" className="inline-flex min-h-9 items-center gap-1 px-1 text-xs font-bold"><EditIcon /> Edit</Link> : null}
              {item.recipeId ? <><span className="ml-auto h-6 w-px shrink-0 bg-black/12" aria-hidden="true" /><GuideSocialActions recipeId={item.recipeId} likeCount={item.likeCount} saveCount={item.saveCount} viewerHasLiked={item.viewerHasLiked} viewerHasSaved={item.viewerHasSaved} assignContentType={item.type} assignContentId={item.id} assignTitle={item.title} size="sm" /></> : null}
            </div>
          </article>
        ))}
        {!pending && assigned.length === 0 ? <p className={`px-4 py-4 text-sm font-semibold ${isProject ? '' : 'text-white/42'}`}>No guides assigned yet.</p> : null}
        {pending && assigned.length === 0 ? <p className={`px-4 py-4 text-sm ${isProject ? '' : 'text-white/42'}`}>Loading…</p> : null}
      </div> : null}
      {error && !open ? <p role="alert" className={`px-4 pb-4 text-xs font-bold ${isProject ? 'text-red-700' : 'text-red-300'}`}>{error}</p> : null}

      {open && typeof document !== 'undefined' ? createPortal(
        <div className={`${projectStyles.dialogOverlay} fixed inset-0 z-[1100] grid place-items-center p-4 backdrop-blur-sm`} onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby={`${targetType}-assignment-title`} className={`${projectStyles.dialogPanel} w-full max-w-lg p-5`}>
            <div className="flex items-start justify-between gap-4"><div><p className={projectStyles.eyebrow}>Guides</p><h2 id={`${targetType}-assignment-title`} className="mt-1 text-xl font-black">Assign to {targetType}</h2></div><button type="button" aria-label="Close" onClick={() => setOpen(false)} className={`${projectStyles.iconControl} !h-9 !w-9`}><span>×</span></button></div>
            <div className="mt-4 max-h-[56dvh] space-y-2 overflow-y-auto pr-1">
              {choices.map((item) => { const key = `${item.type}:${item.id}`; return <label key={key} className={`${projectStyles.paintPickerRow} flex cursor-pointer items-center gap-3 p-2 transition`}>
                <input type="checkbox" checked={selected.has(key)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next })} className="h-4 w-4 accent-amber-700" />
                <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[7px] bg-black"><Image src={item.image} alt="" fill sizes="44px" className="object-cover" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{item.title}</span><span className="block text-[10px] uppercase tracking-wide opacity-55">{item.type}</span></span>
              </label> })}
              {!pending && choices.length === 0 ? <p className="py-6 text-center text-sm">Create or save a guide first.</p> : null}
            </div>
            <div className="mt-5 flex gap-2"><button type="button" onClick={() => setOpen(false)} className={`${projectStyles.secondaryAction} h-11 px-4 text-sm font-black`}>Cancel</button><button type="button" onClick={save} disabled={pending} className={`${projectStyles.primaryButton} h-11 flex-1 text-sm font-black disabled:opacity-50`}>{pending ? 'Saving…' : 'Save assignments'}</button></div>
            {error ? <p role="alert" className="mt-3 text-xs font-bold text-red-700">{error}</p> : null}
          </section>
        </div>, document.body) : null}
    </section>
  )
}

function EditIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
}

function InfoIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></svg>
}
