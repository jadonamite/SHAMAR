import type { Metadata } from 'next'
import TopNav from '@/components/app/TopNav'
import AppFooter from '@/components/app/AppFooter'

export const metadata: Metadata = {
  title: 'Cookie policy — SHAMAR',
  description: 'Details on local storage and essential cookies used by SHAMAR.',
}

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-canvas text-label flex flex-col justify-between">
      <TopNav title="Cookie Policy" />

      <main className="flex-1 px-4 sm:px-6 py-10 md:py-12 max-w-3xl w-full mx-auto">
        <header className="mb-10 pb-6 border-b border-separator/80">
          <h1 className="type-title-1 font-[600] text-label tracking-tight mb-2">
            Cookie policy
          </h1>
          <p className="type-caption text-label-3 font-mono">
            Last updated: 22 September 2026. This document has not had formal
            legal review.
          </p>
        </header>

        <div className="space-y-8 type-callout leading-relaxed text-label-2">
          <section>
            <h2 className="type-headline font-semibold text-label mb-2">
              How SHAMAR uses browser storage
            </h2>
            <p>
              SHAMAR uses browser local storage and essential cookies strictly
              to maintain your session and remember user preferences. We do not
              use third-party analytics trackers, marketing pixels, or
              behavioral advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="type-headline font-semibold text-label mb-3">
              Storage items we use
            </h2>
            <div className="space-y-3">
              <div className="p-4 rounded-[var(--radius-card)] bg-surface border border-separator/80 shadow-2xs">
                <div className="font-mono text-xs font-semibold text-label mb-1">
                  shamar-theme
                </div>
                <p className="type-caption text-label-3">
                  Stores your display preferences so your session remains
                  consistent across visits.
                </p>
              </div>

              <div className="p-4 rounded-[var(--radius-card)] bg-surface border border-separator/80 shadow-2xs">
                <div className="font-mono text-xs font-semibold text-label mb-1">
                  shamar_cookie_consent
                </div>
                <p className="type-caption text-label-3">
                  Remembers your acknowledgment of this notice so you are not
                  prompted repeatedly.
                </p>
              </div>

              <div className="p-4 rounded-[var(--radius-card)] bg-surface border border-separator/80 shadow-2xs">
                <div className="font-mono text-xs font-semibold text-label mb-1">
                  privy:* (session tokens)
                </div>
                <p className="type-caption text-label-3">
                  Managed by Privy to maintain your authenticated login state
                  across browser refreshes without requiring you to re-sign each
                  page request.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="type-headline font-semibold text-label mb-2">
              Managing your storage
            </h2>
            <p>
              You can clear cookies and local storage data at any time through
              your browser settings. Note that clearing storage will log you out
              of your current session and require you to sign in again.
            </p>
          </section>

          <section className="pt-6 border-t border-separator/80">
            <p className="type-caption text-label-3">
              For questions about our storage practices, contact
              privacy@shamar.namite.xyz.
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  )
}
