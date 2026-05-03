import Link from 'next/link'
import MobileNav from '../components/MobileNav'
import FeedbackCard from './feedback-card'

const payboxLink = 'https://links.payboxapp.com/oPJxbFBZM2b'
const bitPhone = '054-4459145'

// Best-effort Bit app opener.
// Test this on your phone after deploy.
const bitLink = `https://bitpay.co.il/app/`

const amounts = [25, 50, 100, 200]

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-[#061012] pb-24 text-slate-100">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-5">
        <div className="flex items-center justify-between">
          <Link
  href="/dashboard"
  className="inline-flex items-center gap-2 text-sm text-slate-300"
>
  ← Back
</Link>

          <div className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold text-cyan-200">
            Support
          </div>
        </div>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/20">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-200">
              ❤️
            </div>
          </div>

          <h1 className="text-center text-2xl font-bold">
            Support Obsidian Gallery
          </h1>

          <div className="mt-3 text-center text-sm leading-6 text-slate-300 space-y-3">
  <p>
    <strong>Obsidian Gallery is a passion project.</strong><br />
    Built by a hobbyist who wanted a better way to manage painting and wargaming.
  </p>

  <p>
    As the app grows, so do the costs — hosting, storage, and development.
  </p>

  <p>
    Any support helps keep it running and improving. But more than that, it shows that the app is truly useful to someone out there.
  </p>

  <p>
    Thanks for using Obsidian Gallery, and for considering supporting it. ❤️
  </p>
</div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-sm font-semibold text-slate-100">
            Suggested amounts
          </h2>

          <p className="mt-1 text-xs leading-5 text-slate-400">
            These are suggestions only. We can't reliably pre-fill
            the payment amount from the app.
          </p>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {amounts.map((amount) => (
              <div
                key={amount}
                className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 py-3 text-center text-sm font-bold text-cyan-200"
              >
                ₪{amount}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400 text-sm font-black text-slate-950">
              bit
            </div>

            <div>
              <h2 className="font-semibold">Pay with Bit</h2>
              <p className="text-xs text-slate-400">
                If Bit does not fill the recipient automatically, search/send to
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-cyan-400/20 bg-[#061018] p-4">
            <div className="text-xs text-slate-400">Bit phone number</div>
            <div className="mt-1 text-xl font-bold text-cyan-200">
              {bitPhone}
            </div>
          </div>

          <a
            href={bitLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-4 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-950/40 transition hover:bg-cyan-300"
          >
          Open Bit to Pay
            ↗
          </a>

        </section>

<div className="h-px bg-white/10 my-2" />

<section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
  <div className="flex items-center gap-3">
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400 text-xs font-black text-slate-950">
      PB
    </div>

    <div>
      <h2 className="font-semibold">Pay with PayBox</h2>
      <p className="text-xs text-slate-400">
        Opens the Obsidian Gallery PayBox payment group.
      </p>
    </div>
  </div>

  <a
    href={payboxLink}
    target="_blank"
    rel="noopener noreferrer"
    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-4 text-sm font-bold text-slate-950 shadow-lg shadow-black/20 transition hover:bg-emerald-300"
  >
    Open PayBox ↗
  </a>

  <p className="mt-3 text-center text-xs leading-5 text-slate-400">
    Recommended for Israeli users who prefer PayBox.
  </p>
</section>

        <FeedbackCard />
      </div>

      <MobileNav />
    </main>
  )
}