import Link from '@/app/components/navigation-feedback/navigation-link'
export default function ViewCardsLink({ href, title }: { href: string; title: string }) {
  return <Link href={href} aria-label={`View cards: ${title}`} title="View cards" data-v3-guides-indicator="view-cards-link" className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-[7px] border px-3 text-xs font-black">
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
    <span>View</span>
  </Link>
}
