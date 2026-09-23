import type { Metadata } from 'next'
import TopNav from '@/components/app/TopNav'
import AppFooter from '@/components/app/AppFooter'

export const metadata: Metadata = {
  title: 'Privacy policy — SHAMAR',
  description:
    'How SHAMAR handles Gmail tokens, subscription data, calendar events, and on-chain records.',
}

export default function PrivacyPage() {
  return (
    <div
      className="min-h-screen flex flex-col justify-between"
      style={{
        backgroundColor: 'var(--bg-void)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <TopNav title="Privacy Policy" />

      <main className="flex-1 px-6 py-12 md:px-12 max-w-3xl w-full mx-auto">
        <header
          className="mb-10 pb-6 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <h1
            className="text-3xl font-bold tracking-tight mb-2"
            style={{ fontFamily: 'var(--font-heading)' }}
          >
            Privacy policy
          </h1>
          <p
            className="text-xs text-muted"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Last updated: 22 September 2026. This document has not had formal
            legal review.
          </p>
        </header>

        <div className="space-y-8 text-sm leading-relaxed text-secondary">
          <section>
            <h2
              className="text-lg font-semibold text-white mb-2"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Data we collect and why
            </h2>
            <p>
              SHAMAR accesses only what is necessary to detect subscriptions and
              protect you from unintended charges:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>
                <strong>Gmail receipts (read-only):</strong> When you connect
                Google, we request the gmail.readonly scope. Our scanner filters
                exclusively for messages matching domains in our subscription
                registry. We do not download or store personal emails or contact
                lists.
              </li>
              <li>
                <strong>Google Calendar (events):</strong> We request
                calendar.events permission solely to add upcoming renewal
                warnings and post-cancellation verification reminders.
              </li>
              <li>
                <strong>Account identity:</strong> Your Privy DID or EVM wallet
                address is used to associate your active subscriptions and
                policy grants.
              </li>
              <li>
                <strong>Audit signatures:</strong> When SHAMAR executes an
                action, the agent signs an EIP-191 cryptographic hash containing
                the merchant, amount, and timestamp, preserving a verifiable
                log.
              </li>
            </ul>
          </section>

          <section>
            <h2
              className="text-lg font-semibold text-white mb-2"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Token storage and security
            </h2>
            <p>
              OAuth refresh tokens are encrypted and kept strictly server-side
              in our Postgres database. Tokens are never transmitted to
              client-side browsers. You can disconnect your Google account at
              any time via your Google Security dashboard or from the SHAMAR
              dashboard.
            </p>
          </section>

          <section>
            <h2
              className="text-lg font-semibold text-white mb-2"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Third-party services
            </h2>
            <p>We interface with specific service providers:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong>Neon:</strong> Managed PostgreSQL hosting for database
                state.
              </li>
              <li>
                <strong>Resend:</strong> Transactional email dispatch for
                cancellation requests.
              </li>
              <li>
                <strong>Telegram:</strong> Delivery of approval buttons and
                emergency halt messages.
              </li>
              <li>
                <strong>Base RPC:</strong> Reading on-chain policy
                authorizations on Base mainnet.
              </li>
            </ul>
            <p className="mt-2">
              We do not sell user data, share personal records with advertisers,
              or use third-party behavioral analytics.
            </p>
          </section>

          <section>
            <h2
              className="text-lg font-semibold text-white mb-2"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Account deletion
            </h2>
            <p>
              You can request full deletion of your account and all associated
              data, including detected subscriptions, token records, and
              recommendations. Contact support or use the account settings
              interface to purge your records permanently.
            </p>
          </section>

          <section
            className="pt-6 border-t"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <p className="text-xs text-muted">
              For privacy inquiries or deletion requests, write to
              privacy@shamar.namite.xyz.
            </p>
          </section>
        </div>
      </main>

      <AppFooter />
    </div>
  )
}
