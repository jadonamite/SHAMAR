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
    <div className="min-h-screen bg-canvas text-label flex flex-col justify-between">
      <TopNav title="Privacy Policy" />

      <main className="flex-1 px-4 sm:px-6 py-10 md:py-12 max-w-3xl w-full mx-auto">
        <header className="mb-10 pb-6 border-b border-separator/80">
          <h1 className="type-title-1 font-[600] text-label tracking-tight mb-2">
            Privacy policy
          </h1>
          <p className="type-caption text-label-3 font-mono">
            Last updated: 22 September 2026. This document has not had formal
            legal review.
          </p>
        </header>

        <div className="space-y-8 type-callout leading-relaxed text-label-2">
          <section>
            <h2 className="type-headline font-semibold text-label mb-2">
              Data we collect and why
            </h2>
            <p>
              SHAMAR accesses only what is necessary to detect subscriptions and
              protect you from unintended charges:
            </p>
            <ul className="list-disc pl-5 mt-2 space-y-2">
              <li>
                <strong className="text-label">
                  Gmail receipts (read-only):
                </strong>{' '}
                When you connect Google, we request the gmail.readonly scope.
                Our scanner filters exclusively for messages matching domains in
                our subscription registry. We do not download or store personal
                emails or contact lists.
              </li>
              <li>
                <strong className="text-label">
                  Google Calendar (events):
                </strong>{' '}
                We request calendar.events permission solely to add upcoming
                renewal warnings and post-cancellation verification reminders.
              </li>
              <li>
                <strong className="text-label">Account identity:</strong> Your
                Privy DID or EVM wallet address is used to associate your active
                subscriptions and policy grants.
              </li>
              <li>
                <strong className="text-label">Audit signatures:</strong> When
                SHAMAR executes an action, the agent signs an EIP-191
                cryptographic hash containing the merchant, amount, and
                timestamp, preserving a verifiable log.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="type-headline font-semibold text-label mb-2">
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
            <h2 className="type-headline font-semibold text-label mb-2">
              Third-party services
            </h2>
            <p>We interface with specific service providers:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <strong className="text-label">Neon:</strong> Managed PostgreSQL
                hosting for database state.
              </li>
              <li>
                <strong className="text-label">Resend:</strong> Transactional
                email dispatch for cancellation requests.
              </li>
              <li>
                <strong className="text-label">Telegram:</strong> Delivery of
                approval buttons and emergency halt messages.
              </li>
              <li>
                <strong className="text-label">Base RPC:</strong> Reading
                on-chain policy authorizations on Base mainnet.
              </li>
            </ul>
            <p className="mt-2">
              We do not sell user data, share personal records with advertisers,
              or use third-party behavioral analytics.
            </p>
          </section>

          <section>
            <h2 className="type-headline font-semibold text-label mb-2">
              Google API Limited Use Disclosure
            </h2>
            <p>
              SHAMAR&apos;s use and transfer of information received from Google
              APIs to any other app will adhere to the{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline font-medium"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
            <p className="mt-2">Specifically:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                We only use Gmail data to detect active recurring subscriptions
                and billing receipts matching our vetted merchant registry.
              </li>
              <li>
                We do not transfer or disclose your Google user data to third
                parties, except as strictly necessary to operate subscription
                tracking or as required by law.
              </li>
              <li>
                We do not use your Google data for serving advertisements,
                retargeting, or personalized marketing.
              </li>
              <li>
                We do not allow humans to read your email messages unless you
                have given explicit consent for debugging specific issues, or
                where required for security investigation or legal compliance.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="type-headline font-semibold text-label mb-2">
              Account deletion (R28)
            </h2>
            <p>
              You can trigger full deletion of your account and all associated
              data directly from the Agent Governance page or via API. Calling
              the deletion endpoint permanently removes all detected
              subscriptions, recommendations, action signatures, policy rules,
              and encrypted tokens.
            </p>
          </section>

          <section className="pt-6 border-t border-separator/80">
            <p className="type-caption text-label-3">
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
