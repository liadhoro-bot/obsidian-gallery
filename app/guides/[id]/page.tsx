import Image from 'next/image'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import V3PerfIndicator from '../../components/v3-perf-indicator'
import { hasV3PreviewSession } from '../../../lib/v3-preview-server'
import { createPerfTimer } from '../../../utils/perf/server'
import { createClient, getSessionUser } from '../../../utils/supabase/server'
import { getGuidesV3GuideDetail } from '../guides-v3-detail-data'

type GuideDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams?: Promise<{ preview?: string }>
}

export default async function GuideDetailPage({
  params,
  searchParams,
}: GuideDetailPageProps) {
  const perf = createPerfTimer('/guides/[id]')
  const [{ id }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as { preview?: string }),
  ])
  const isPreview = await hasV3PreviewSession(resolvedSearchParams.preview)

  if (!isPreview) {
    redirect('/recipes')
  }

  const supabase = await createClient()
  const user = await getSessionUser(supabase)
  perf.mark('auth/session fetch')

  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/guides/${id}?preview=1`)}&preview=1`
    )
  }

  const guide = await perf.measure('v3 guide detail data', () =>
    getGuidesV3GuideDetail(id, user.id)
  )
  perf.total()

  if (!guide) notFound()

  return (
    <main className="min-h-screen bg-[#05090b] text-white">
      <V3PerfIndicator surface="guide-detail" detail="main" />
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
            Guide
          </span>
        </header>

        <section className="overflow-hidden rounded-[8px] border border-white/[0.06] bg-[#111821]">
          <div className="relative h-48 bg-black">
            <Image
              src={guide.image}
              alt=""
              fill
              sizes="(max-width: 480px) 100vw, 420px"
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/88" />
            <div className="absolute inset-x-0 bottom-0 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-300">
                Guide Detail
              </p>
              <h1 className="mt-1 text-3xl font-black leading-tight">
                {guide.title}
              </h1>
            </div>
          </div>
          <div className="grid grid-cols-3 border-t border-white/[0.06] text-center text-[10px] font-black text-white/46">
            <span className="p-3">{guide.decks} decks</span>
            <span className="border-x border-white/[0.06] p-3">
              {guide.cards} cards
            </span>
            <span className="p-3">{guide.level}</span>
          </div>
        </section>

        <section className="rounded-[8px] border border-white/[0.06] bg-[#111821] p-4">
          <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-white/28">
            Description
          </h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-white/62">
            {guide.subtitle}
          </p>
          <div className="mt-4 flex gap-2">
            {guide.palette.map((color, index) => (
              <span
                key={`${guide.id}-${color}-${index}`}
                className="h-5 w-5 rounded-full border border-white/10"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-[8px] border border-white/[0.06] bg-[#111821]">
          <div className="px-4 py-4">
            <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-white/28">
              Decks In This Guide
            </h2>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {guide.decksList.length ? (
              guide.decksList.map((deck) => (
                <Link
                  key={deck.id}
                  href={`/guides/decks/${deck.id}?preview=1`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.035]"
                >
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-black">
                    <Image
                      src={deck.image}
                      alt=""
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black">
                      {deck.title}
                    </span>
                    <span className="mt-1 block text-[10px] font-semibold text-white/38">
                      {deck.cards} cards - {deck.paints} paints
                    </span>
                  </span>
                  <span className="text-white/24">&gt;</span>
                </Link>
              ))
            ) : (
              <div className="p-4 text-sm font-semibold text-white/42">
                No decks have been added yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
