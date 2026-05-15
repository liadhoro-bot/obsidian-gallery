import Link from 'next/link'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#061012] px-4 py-6 text-slate-100">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <Link href="/settings" className="text-sm font-bold text-cyan-300">
  ← Back to Settings
</Link>

        <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300">
            Legal
          </p>

          <h1 className="mt-2 text-2xl font-black">
            Terms & Conditions
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Last Updated: May 13, 2026
          </p>

          <a
            href="/legal/obsidian-gallery-terms-and-conditions.pdf"
            download
            className="mt-5 block rounded-2xl bg-cyan-400 px-5 py-3 text-center text-sm font-black text-slate-950"
          >
            Download PDF
          </a>
        </section>

        <section className="max-h-[62vh] overflow-y-auto rounded-3xl border border-white/10 bg-black/20 p-5 text-sm leading-7 text-slate-300">
          <h2 className="text-lg font-bold text-white">1. Introduction</h2>
          <p className="mt-2">
            Welcome to Obsidian Gallery. Obsidian Gallery is a miniature painting
            and hobby companion platform that allows users to manage painting
            projects, track paint collections, create and share paint recipes,
            upload images, and participate in community features related to
            tabletop gaming and miniature painting.
          </p>
          <p className="mt-3">
            By accessing or using Obsidian Gallery, you agree to these Terms &
            Conditions. If you do not agree to these Terms, you may not use the
            Service.
          </p>

          <h2 className="mt-6 text-lg font-bold text-white">2. Eligibility</h2>
          <p className="mt-2">
            You must be at least 13 years old to use the Service. If you are
            under the age required to consent to digital services in your
            jurisdiction, you may only use the Service with the consent of a
            parent or legal guardian.
          </p>

          <h2 className="mt-6 text-lg font-bold text-white">3. User Accounts</h2>
          <p className="mt-2">
            To access certain features, you may be required to create an account.
            You agree to provide accurate information, maintain the security of
            your account, keep login credentials confidential, and accept
            responsibility for all activity under your account.
          </p>

          <h2 className="mt-6 text-lg font-bold text-white">4. Description of the Service</h2>
          <p className="mt-2">
            Obsidian Gallery provides tools for miniature painting project
            tracking, paint collection management, custom paint creation, recipe
            and workflow creation, image uploads, public and private recipe
            sharing, community discovery, analytics, progress tracking, and
            optional subscription or premium features.
          </p>

          <h2 className="mt-6 text-lg font-bold text-white">5. User Content</h2>
          <p className="mt-2">
            You retain ownership of the content you create or upload, including
            images, paint recipes, project information, comments, text, and other
            user-generated content.
          </p>
          <p className="mt-3">
            By uploading content, you grant Obsidian Gallery a worldwide,
            non-exclusive, royalty-free license to host, store, reproduce,
            display, distribute, modify for technical purposes, and promote your
            content solely for operating, improving, marketing, and providing the
            Service.
          </p>

          <h2 className="mt-6 text-lg font-bold text-white">6. Acceptable Use</h2>
          <p className="mt-2">
            You agree not to use the Service to upload unlawful, abusive,
            hateful, sexually explicit, graphic, spam, deceptive, malicious,
            infringing, or disruptive content. Public-facing areas must remain
            relevant to miniature painting, tabletop gaming, hobby creativity,
            and related community activities.
          </p>

          <h2 className="mt-6 text-lg font-bold text-white">6A. Community Standards & Moderation</h2>
          <p className="mt-2">
            Obsidian Gallery is intended to remain a hobby-focused platform. We
            may use automated systems, manual review, community reports, or
            third-party moderation tools to detect inappropriate content.
            Content may be removed, restricted, hidden, or rejected if it
            violates community standards.
          </p>

          <h2 className="mt-6 text-lg font-bold text-white">7. Intellectual Property</h2>
          <p className="mt-2">
            The Service, including its software, interface, branding, logos,
            design, text, graphics, and functionality, is owned by Obsidian
            Gallery and protected by intellectual property laws.
          </p>

          <h2 className="mt-6 text-lg font-bold text-white">8. Third-Party Brands</h2>
          <p className="mt-2">
            Obsidian Gallery may reference third-party paint manufacturers,
            miniature brands, or hobby products. All trademarks and brand names
            are the property of their respective owners. Obsidian Gallery is an
            independent platform.
          </p>

          <h2 className="mt-6 text-lg font-bold text-white">9. Subscriptions and Payments</h2>
          <p className="mt-2">
            Certain features may require payment, subscriptions, or in-app
            purchases. Payments may be processed through Apple, Google, Stripe,
            or other payment providers.
          </p>

          <h2 className="mt-6 text-lg font-bold text-white">10. Service Availability</h2>
          <p className="mt-2">
            The Service is provided on an “as is” and “as available” basis. We do
            not guarantee uninterrupted availability, permanent storage,
            error-free operation, or compatibility with all devices.
          </p>

          <h2 className="mt-6 text-lg font-bold text-white">11. Limitation of Liability</h2>
          <p className="mt-2">
            To the maximum extent permitted by law, Obsidian Gallery and its
            operators shall not be liable for indirect damages, lost data, loss
            of profits, service interruptions, content loss, or damages arising
            from use of the Service.
          </p>

          <h2 className="mt-6 text-lg font-bold text-white">12. Indemnification</h2>
          <p className="mt-2">
            You agree to indemnify and hold harmless Obsidian Gallery from
            claims, damages, liabilities, and expenses arising from your use of
            the Service, your User Content, or your violation of these Terms.
          </p>

          <h2 className="mt-6 text-lg font-bold text-white">13. Termination</h2>
          <p className="mt-2">
            We reserve the right to suspend or terminate access to the Service
            for violations of these Terms, abusive behavior, unlawful activity,
            or conduct harmful to the community or platform.
          </p>

          <h2 className="mt-6 text-lg font-bold text-white">14. Privacy</h2>
          <p className="mt-2">
            Your use of the Service is also governed by our Privacy Policy, which
            explains how we collect, use, and protect your information.
          </p>

          <h2 className="mt-6 text-lg font-bold text-white">15. Changes to These Terms</h2>
          <p className="mt-2">
            We may update these Terms from time to time. Continued use of the
            Service after changes become effective constitutes acceptance of the
            updated Terms.
          </p>

          <h2 className="mt-6 text-lg font-bold text-white">16. Governing Law</h2>
          <p className="mt-2">
            These Terms shall be governed by the laws of the State of Israel.
            Disputes shall be subject to the exclusive jurisdiction of the courts
            located in Tel Aviv, Israel.
          </p>

          <h2 className="mt-6 text-lg font-bold text-white">17. Contact</h2>
          <p className="mt-2">
            For questions regarding these Terms, please contact Liad from
            Obsidian Gallery at liadhoro@gmail.com.
          </p>
        </section>
      </div>
    </main>
  )
}