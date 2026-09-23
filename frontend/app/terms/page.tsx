import type { Metadata } from 'next'
import TopNav from '@/components/app/TopNav'
import AppFooter from '@/components/app/AppFooter'

export const metadata: Metadata = {
  title: 'Terms of service — SHAMAR',
  description: 'Terms and conditions governing the use of the SHAMAR subscription management agent.',
}

export default function TermsPage() {
  return (
    <div
      className="min-h-screen flex flex-col justify-between"
      style={{
        backgroundColor: 'var(--bg-void)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <TopNav title="Terms of Service" />

      <main className="flex-1 px-6 py-12 md:px-12 max-w-3xl w-full mx-auto">
        <header className="mb-10 pb-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <h1
            className="text-3xl font-bold tracking-tight mb-2"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Terms of service
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
              What SHAMAR is
            </h2>
            <p>
              SHAMAR is an autonomous software agent designed to track recurring billing receipts, evaluate
              the trade-offs of cancelling active subscriptions, notify you prior to scheduled renewals,
              and execute authorized cancellations.
            </p>
          </section>

          <section>
            <h2
              className="text-lg font-semibold text-white mb-2"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              How the default email tier works
            </h2>
            <p>
              In the default tier, cancellation requests are sent by email via Resend to the merchant billing
              address retrieved from our subscription registry. This action is best-effort. Merchants are not
              legally obligated to honour an email cancellation request immediately or at all. SHAMAR logs a
              follow-up event on your Google Calendar to remind you to verify written confirmation from the merchant.
              You remain responsible for checking that your provider ceased billing.
            </p>
          </section>

          <section>
            <h2
              className="text-lg font-semibold text-white mb-2"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              On-chain policy and authorization
            </h2>
            <p>
              SHAMAR verifies permission before executing any cancellation or pause action. This permission is
              governed by the SHAMARPolicy smart contract on Base. You hold sole authority to grant,
              scope, or revoke these permissions using your connected wallet. If the blockchain network is
              unreachable, SHAMAR refuses to act unless the operator has set a temporary local grant with a
            fixed expiry, and every action taken under one is recorded as locally authorized.
            </p>
          </section>

          <section>
            <h2
              className="text-lg font-semibold text-white mb-2"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Emergency halt controls
            </h2>
            <p>
              You can halt all agent operations at any time by sending /stop to the connected Telegram bot. Once
              halted, no cancellations or automated dispatches will occur until you explicitly issue /resume.
            </p>
          </section>

          <section>
            <h2
              className="text-lg font-semibold text-white mb-2"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Limitation of liability
            </h2>
            <p>
              SHAMAR is provided on an as-is basis without warranties of any kind. We are not liable for charges
              incurred if a merchant ignores an email cancellation request, nor for incidental data loss resulting
              from a cancellation that you authorized or permitted to proceed through silence.
            </p>
          </section>

          <section className="pt-6 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs text-muted">
              Questions regarding these terms may be directed to team@shamar.namite.xyz or via GitHub issues.
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  )
}
