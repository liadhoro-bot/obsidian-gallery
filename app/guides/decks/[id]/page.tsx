import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import V3PerfIndicator from '../../../components/v3-perf-indicator'
import { hasV3PreviewSession } from '../../../../lib/v3-preview-server'
import { createPerfTimer } from '../../../../utils/perf/server'
import { createClient, getSessionUser } from '../../../../utils/supabase/server'
import { getGuidesV3DeckDetail } from '../../guides-v3-detail-data'

type DeckDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ preview?: string }>
}

export default async function DeckDetailPage({
  params,
  searchParams,
}: DeckDetailPageProps) {
  const perf = createPerfTimer('/guides/decks/[id]')
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as { preview?: string }),
  ])
  const isPreview = await hasV3PreviewSession(resolvedSearchParams.preview)

  if (!isPreview) {
    redirect(`/recipes/${id}`)
  }

  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/guides/decks/${id}?preview=1`)}&preview=1`
    )
  }

  const deck = await perf.measure('v3 deck detail data', () =>
    getGuidesV3DeckDetail(id, user.id)
  )
  perf.total()

  if (!deck) notFound()

  return (
    <main className="min-h-screen bg-[#05090b] text-white">
      <V3PerfIndicator surface="deck-detail" detail="main" />
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-3 pb-28 pt-5">
        <header className="flex items-center justify-between">
          <Link
            href="/guides?preview=1"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-xl text-white/70"
            aria-label="Back to guides"
          >
            &lt;
          </Link>
          <span className="text-[9px] font-black uppercase tracking-[0.28em] text-cyan-300">
            Deck
          </span>
        </header>

        <section className="overflow-hidden rounded-[8px] border border-white/[0.06] bg-[#111821]">
          <div className="relative h-56 bg-black">
            <Image
              src={deck.image}
              alt=""
              fill
              sizes="(max-width: 480px) 100vw, 420px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/90" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
                Deck Detail
              </p>
              <h1 className="mt-1 text-3xl font-black leading-tight">
                {deck.title}
              </h1>
              <p className="mt-2 text-xs font-black text-white/42">
                {deck.category} - {deck.ownerLabel}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 border-t border-white/[0.06] text-center text-[10px] font-black text-white/46">
            <span className="p-3">{deck.cards} cards</span>
            <span className="border-x border-white/[0.06] p-3">
              {deck.paints} paints
            </span>
            <span className="p-3">{deck.isPublic ? 'Public' : 'Private'}</span>
          </div>
        </section>

        <section className="rounded-[8px] border border-white/[0.06] bg-[#111821] p-4">
          <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-white/28">
            Description
          </h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-white/62">
            {deck.description}
          </p>
        </section>

        <section className="rounded-[8px] border border-white/[0.06] bg-[#111821] p-4">
          <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-white/28">
            Paints
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {deck.paintList.length ? (
              deck.paintList.map((paint) => (
                <span
                  key={paint.id}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] py-1 pl-1 pr-3 text-[10px] font-black text-white/52"
                >
                  <span
                    className="h-5 w-5 rounded-full border border-white/10"
                    style={{ backgroundColor: paint.color }}
                  />
                  {paint.name}
                </span>
              ))
            ) : (
              <span className="text-xs font-semibold text-white/42">
                No paints linked yet.
              </span>
            )}
          </div>
        </section>

        <section className="grid gap-3">
          <h2 className="px-1 text-[10px] font-black uppercase tracking-[0.24em] text-white/28">
            Cards
          </h2>
          {deck.steps.length ? (
            deck.steps.map((step) => (
              <article
                key={step.id}
                className="overflow-hidden rounded-[8px] border border-white/[0.06] bg-[#111821]"
              >
                {step.image ? (
                  <div className="relative h-36 bg-black">
                    <Image
                      src={step.image}
                      alt=""
                      fill
                      sizes="(max-width: 480px) 100vw, 420px"
                      className="object-cover"
                    />
                  </div>
                ) : null}
                <div className="p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
                    Card {step.number}
                  </p>
                  <h3 className="mt-1 text-lg font-black">{step.title}</h3>
                  <p className="mt-3 text-sm font-semibold leading-6 text-white/58">
                    {step.instructions}
                  </p>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[8px] border border-dashed border-white/10 bg-[#111821] p-5 text-center text-sm font-semibold text-white/42">
              No cards have been added to this deck yet.
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
