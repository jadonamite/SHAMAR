import type { Metadata } from 'next'
import TopNav from '@/components/app/TopNav'
import AppFooter from '@/components/app/AppFooter'

export const metadata: Metadata = {
  title: 'Cookie policy — SHAMAR',
  description: 'Details on local storage and essential cookies used by SHAMAR.',
}

export default function CookiesPage() {
  return (
    <div
      className="min-h-screen flex flex-col justify-between"
      style={{
        backgroundColor: 'var(--bg-void)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <TopNav title="Cookie Policy" />

      <main className="flex-1 px-6 py-12 md:px-12 max-w-3xl w-full mx-auto">
        <header className="mb-10 pb-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h1
            className="text-3xl font-bold tracking-tight mb-2"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Cookie policy
          </h1>
          <p className="text-xs text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
            Last updated: 22 September 2026. This document has not had formal legal review.
          </p>
        </header>

        <div className="space-y-8 text-sm leading-relaxed text-secondary">
          <section>
            <h2
              className="text-lg font-semibold text-white mb-2"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              How SHAMAR uses browser storage
            </h2>
            <p>
              SHAMAR uses browser local storage and essential cookies strictly to maintain your session and
              remember user preferences. We do not use third-party analytics trackers, marketing pixels, or
              behavioral advertising cookies.
            </p>
          </section>

          <section>
            <h2
              className="text-lg font-semibold text-white mb-2"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Storage items we use
            </h2>
            <div className="space-y-4">
              <div className="p-4 rounded border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
                <div className="font-semibold text-white mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
                  shamar-theme
                </div>
                <p className="text-xs text-muted">
                  Stores your display theme selection (dark, light, or system default) so your visual preference
                  is remembered across visits.
                </p>
              </div>

              <div className="p-4 rounded border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
                <div className="font-semibold text-white mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
                  shamar_cookie_consent
                </div>
                <p className="text-xs text-muted">
                  Remembers your acknowledgment of this notice so you are not prompted repeatedly.
                </p>
              </div>

              <div className="p-4 rounded border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
                <div className="font-semibold text-white mb-1" style={{ fontFamily: 'var(--font-mono)' }}>
                  privy:* (session tokens)
                </div>
                <p className="text-xs text-muted">
                  Managed by Privy to maintain your authenticated login state across browser refreshes without
                  requiring you to re-sign each page request.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2
              className="text-lg font-semibold text-white mb-2"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Managing your storage
            </h2>
            <p>
              You can clear cookies and local storage data at any time through your browser settings. Note that
              clearing storage will log you out of your current session and reset your theme selection to dark.
            </p>
          </section>

          <section className="pt-6 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs text-muted">
              For questions about our storage practices, contact privacy@shamar.namite.xyz.
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  )
}
