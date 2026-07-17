'use client'

type Props = {
  onClose: () => void
}

export default function TermsModal({ onClose }: Props) {
  return (
    <div className="mobile-sheet-overlay fixed inset-0 z-50 flex justify-center bg-black/80 backdrop-blur-sm">
      <div className="mobile-sheet max-w-lg rounded-[2rem] border border-cyan-300/20 bg-[#081018] shadow-2xl shadow-cyan-950/40">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              Legal
            </p>
            <h3 className="mt-1 text-xl font-black text-white">
              Terms & Conditions
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="tap-press mobile-close-button rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm font-bold text-white/60 hover:bg-white/[0.08] hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="mobile-scroll terms-scroll min-h-0 overflow-y-auto px-5 py-5 pr-6 text-sm leading-7 text-white/85">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
              Legal
            </p>
            <h4 className="mt-3 text-2xl font-black text-white">
              Terms & Conditions
            </h4>
            <p className="mt-2 text-sm text-white/60">
              Last Updated: May 13, 2026
            </p>
<a
  href="/legal/obsidian-gallery-terms-and-conditions.pdf"
  target="_blank"
  rel="noopener noreferrer"
  className="tap-press tap-target mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-black text-black shadow-[0_0_24px_rgba(34,211,238,0.24)]"
>
  Download PDF
</a>
          </div>

          <section className="mt-5 space-y-4">
            <h4 className="text-lg font-black text-white">1. Introduction</h4>
            <p>
              Welcome to Obsidian Gallery. Obsidian Gallery is a miniature
              painting and hobby companion platform that allows users to manage
              painting projects, track paint collections, create and share paint
              guides, upload images, and participate in community features
              related to tabletop gaming and miniature painting.
            </p>
            <p>
              By accessing or using Obsidian Gallery, you agree to these Terms &
              Conditions. If you do not agree to these Terms, you may not use the
              Service.
            </p>

            <h4 className="text-lg font-black text-white">2. Eligibility</h4>
            <p>
              You must be at least 13 years old to use the Service. If you are
              using the Service on behalf of another person or organization, you
              confirm that you have authority to accept these Terms on their
              behalf.
            </p>

            <h4 className="text-lg font-black text-white">3. User Accounts</h4>
            <p>
              You are responsible for maintaining the security of your account
              and for all activity that occurs under it. You agree to provide
              accurate information and to keep your account credentials secure.
            </p>

            <h4 className="text-lg font-black text-white">
              4. User Content
            </h4>
            <p>
              You may upload images, project data, guides, paint information,
              profile details, and other hobby-related content. You retain
              ownership of your content, but grant Obsidian Gallery the right to
              store, process, display, and transmit it as needed to provide the
              Service.
            </p>
            <p>
              You must only upload content that you own or have permission to
              use. You may not upload illegal, hateful, harassing, explicit,
              abusive, infringing, or disruptive material.
            </p>

            <h4 className="text-lg font-black text-white">
              5. Community Standards
            </h4>
            <p>
              Obsidian Gallery is built to support a respectful, hobby-focused
              community. Political extremism, harassment, hateful content,
              explicit material, spam, impersonation, and malicious behavior are
              prohibited.
            </p>

            <h4 className="text-lg font-black text-white">
              6. Public Sharing
            </h4>
            <p>
              Some features may allow you to publish guides, themes, images, or
              other content publicly. Public content may be visible to other
              users. You are responsible for anything you choose to make public.
            </p>

            <h4 className="text-lg font-black text-white">
              7. Service Changes
            </h4>
            <p>
              Obsidian Gallery may change, suspend, or discontinue features as
              the product evolves. During beta, features may change frequently
              and some data or functionality may be experimental.
            </p>

            <h4 className="text-lg font-black text-white">
              8. Termination
            </h4>
            <p>
              We may suspend or remove access to the Service if a user violates
              these Terms, misuses the platform, uploads prohibited content, or
              harms the community or operation of the Service.
            </p>

            <h4 className="text-lg font-black text-white">
              9. Disclaimer
            </h4>
            <p>
              The Service is provided “as is” without warranties of any kind.
              Obsidian Gallery does not guarantee uninterrupted access, error-free
              operation, or permanent availability of any specific feature.
            </p>

            <h4 className="text-lg font-black text-white">
              10. Contact
            </h4>
            <p>
              For questions about these Terms, contact the Obsidian Gallery team
              through the support channels provided in the app.
            </p>
          </section>
        </div>
      </div>

      <style jsx>{`
        .terms-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(34, 211, 238, 0.9) transparent;
        }

        .terms-scroll::-webkit-scrollbar {
          width: 6px;
        }

        .terms-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .terms-scroll::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: linear-gradient(
            180deg,
            rgba(103, 232, 249, 0.98),
            rgba(34, 211, 238, 0.78)
          );
          box-shadow: 0 0 12px rgba(34, 211, 238, 0.35);
        }

        .terms-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(103, 232, 249, 1);
        }
      `}</style>
    </div>
  )
}
